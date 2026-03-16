/**
 * Bot evaluation system for Trick or Treat.
 * Rule-based scoring of legal actions. No AI APIs or external services.
 *
 * Modular structure:
 * - Action generation: collect all legal moves, go home, item plays
 * - Action scoring: heuristic scores based on game state
 * - Action selection: pick best action by score
 *
 * Supports personality profiles via heuristic weight overrides.
 */

import type { GameState, Player, ItemCard } from '../game/types';
import { getTotalCandy } from '../game/types';
import { formatTileLocation } from '../game/boardLabels';
import { isAdjacent } from '../game/movement';
import { GAME_RULES } from '../game/gameRules';
import type { BotAction, BotMoveHistory, BotPathHistory } from './botLogic';

// --- Personality profiles: heuristic weight overrides ---

export type BotProfile = 'greedy' | 'cautious' | 'aggressive' | 'comeback';

export interface BotWeights {
  /** Multiplier for candy gain (higher = prefer candy) */
  candyWeight: number;
  /** Multiplier for point gain (higher = prefer items/King Size Bar) */
  pointWeight: number;
  /** Multiplier for monster risk penalty (higher = more risk-averse) */
  monsterRiskWeight: number;
  /** Multiplier for exploration (unflipped tiles) (higher = explore more) */
  explorationWeight: number;
  /** Multiplier for positional progress toward Mansion (higher = push toward mansion) */
  positionWeight: number;
  /** Multiplier for banking when ahead (higher = bank sooner when leading) */
  bankWhenAheadWeight: number;
  /** Multiplier for risk-taking when behind (higher = take more risks when losing) */
  riskWhenBehindWeight: number;
}

const DEFAULT_WEIGHTS: BotWeights = {
  candyWeight: 1,
  pointWeight: 1,
  monsterRiskWeight: 1,
  explorationWeight: 1,
  positionWeight: 1,
  bankWhenAheadWeight: 1,
  riskWhenBehindWeight: 1,
};

export const BOT_PROFILES: Record<BotProfile, Partial<BotWeights>> = {
  greedy: {
    candyWeight: 1.4,
    pointWeight: 1.2,
    monsterRiskWeight: 0.7,
    explorationWeight: 1.1,
    bankWhenAheadWeight: 0.8,
  },
  cautious: {
    candyWeight: 0.9,
    monsterRiskWeight: 1.5,
    explorationWeight: 0.7,
    bankWhenAheadWeight: 1.4,
    riskWhenBehindWeight: 0.6,
  },
  aggressive: {
    candyWeight: 1.2,
    monsterRiskWeight: 0.6,
    explorationWeight: 1.3,
    positionWeight: 1.3,
    riskWhenBehindWeight: 1.2,
  },
  comeback: {
    candyWeight: 1.3,
    pointWeight: 1.2,
    monsterRiskWeight: 0.5,
    explorationWeight: 1.2,
    bankWhenAheadWeight: 0.5,
    riskWhenBehindWeight: 1.5,
  },
};

function getWeights(profile: BotProfile): BotWeights {
  const overrides = BOT_PROFILES[profile] ?? {};
  return { ...DEFAULT_WEIGHTS, ...overrides };
}

// --- Game phase (early / mid / late round) ---

export type RoundPhase = 'early' | 'mid' | 'late';

export function getRoundPhase(state: GameState): RoundPhase {
  const total = state.totalRounds ?? 3;
  const r = state.roundNumber;
  if (r === 0) return 'early';
  if (r >= total - 1) return 'late';
  return 'mid';
}

// --- Standing (ahead / even / behind) ---

export type Standing = 'ahead' | 'even' | 'behind';

export function getStanding(state: GameState, player: Player): Standing {
  const myTotal = getTotalCandy(player);
  const others = state.players
    .filter((p) => p.id !== player.id)
    .map((p) => getTotalCandy(p));
  if (others.length === 0) return 'even';
  const avg = others.reduce((a, b) => a + b, 0) / others.length;
  const diff = myTotal - avg;
  if (diff > 2) return 'ahead';
  if (diff < -2) return 'behind';
  return 'even';
}

// --- Context for scoring ---

export type StrategicMode = 'Explore' | 'PushMansion' | 'GoHome';

export interface BotContext {
  state: GameState;
  player: Player;
  playerIdx: number;
  lastMoveFrom: BotMoveHistory | null;
  pathHistory: BotPathHistory | null;
  roundPhase: RoundPhase;
  standing: Standing;
  strategicMode: StrategicMode;
  weights: BotWeights;
  /** Count of unflipped tiles (excluding closed) */
  unflippedCount: number;
  /** Count of productive tiles (buckets with candy, unclaimed items, etc.) */
  productiveTileCount: number;
}

function getStrategicMode(
  _state: GameState,
  player: Player,
  roundPhase: RoundPhase,
  standing: Standing,
  productiveTileCount: number,
  prevMode: StrategicMode | null
): StrategicMode {
  const roundCandy = player.roundCandy ?? 0;
  const pos = player.pawnPosition;

  if (roundPhase === 'late' && roundCandy >= 5) return 'GoHome';
  if (roundPhase === 'late' && standing === 'ahead' && roundCandy >= 3) return 'GoHome';
  if (roundPhase === 'mid' && roundCandy >= 10) return 'GoHome';
  if (roundPhase === 'late' && standing === 'behind' && pos && pos.row < 4) return 'PushMansion';
  if (standing === 'behind' && pos && pos.row >= 2 && productiveTileCount <= 4) return 'PushMansion';
  if (roundPhase === 'early' && roundCandy < 8 && productiveTileCount >= 4) return 'Explore';
  return prevMode ?? 'Explore';
}

function buildContext(
  state: GameState,
  player: Player,
  lastMoveFrom: BotMoveHistory | null,
  pathHistory: BotPathHistory | null,
  profile: BotProfile
): BotContext {
  let unflipped = 0;
  let productive = 0;
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (!t || t.isClosed) continue;
      if (!t.isFlipped) unflipped++;
      if (t.card?.type === 'CandyBucket' && (t.candyTokensOnTile ?? 0) > 0) productive++;
      else if ((t.card?.type === 'Item' || t.card?.type === 'CandyItem') && !t.itemCollected) productive++;
      else if (t.card?.type === 'KingSizeBar' && !t.itemCollected) productive++;
    }
  }

  const roundPhase = getRoundPhase(state);
  const standing = getStanding(state, player);
  const prevMode = pathHistory?.moves?.length ? inferModeFromPath(pathHistory) : null;
  const strategicMode = getStrategicMode(state, player, roundPhase, standing, productive, prevMode);

  return {
    state,
    player,
    playerIdx: state.players.findIndex((p) => p.id === player.id),
    lastMoveFrom,
    pathHistory,
    roundPhase,
    standing,
    strategicMode,
    weights: getWeights(profile),
    unflippedCount: unflipped,
    productiveTileCount: productive,
  };
}

function inferModeFromPath(ph: BotPathHistory): StrategicMode | null {
  if (!ph.moves.length) return null;
  const last = ph.moves[ph.moves.length - 1];
  const avgRow = ph.moves.reduce((s, m) => s + m.to.row, 0) / ph.moves.length;
  if (last.to.row >= 3) return 'PushMansion';
  if (avgRow < 1.5 && ph.moves.length >= 2) return 'GoHome';
  return 'Explore';
}

// --- Monster risk scores (negative = bad). Monsters are obstacles; avoid unless justified. ---

const MONSTER_RISK: Record<string, number> = {
  Ghost: -3,
  Zombie: -6,
  Witch: -2,
  Skeleton: -1,
  Werewolf: -4, // Direction reversal causes loops - strong penalty
  Goblin: -3,
  Vampire: -2.5,
};

function getMonsterRisk(card: { monsterType?: string }): number {
  return MONSTER_RISK[card.monsterType ?? ''] ?? -2;
}

// --- Loop detection ---

const PATH_HISTORY_MAX = 6;

function getLoopPenalty(ctx: BotContext, targetRow: number, targetCol: number): number {
  const ph = ctx.pathHistory?.moves;
  if (!ph || ph.length < 2) return 0;

  const key = (r: number, c: number) => `${r},${c}`;
  const targetKey = key(targetRow, targetCol);

  const recentTos = ph.slice(-PATH_HISTORY_MAX).map((m) => key(m.to.row, m.to.col));
  const recentFroms = ph.slice(-PATH_HISTORY_MAX).map((m) => key(m.from.row, m.from.col));

  let penalty = 0;
  if (recentTos.includes(targetKey)) {
    penalty -= 12;
  }
  if (recentFroms.includes(targetKey) && ph.length >= 1) {
    const lastFrom = ph[ph.length - 1].from;
    if (lastFrom.row === targetRow && lastFrom.col === targetCol) {
      penalty -= 15;
    } else {
      penalty -= 8;
    }
  }

  const tile = ctx.state.board[targetRow]?.[targetCol];
  if (tile?.card?.type === 'Monster') {
    const visitedThisMonster = ph.some(
      (m) => m.to.row === targetRow && m.to.col === targetCol
    );
    if (visitedThisMonster) penalty -= 20;
  }

  return penalty;
}

function isProductiveMove(
  ctx: BotContext,
  _targetRow: number,
  _targetCol: number,
  tile: { card?: { type: string; monsterType?: string } | null; isFlipped?: boolean; itemCollected?: boolean; candyTokensOnTile?: number; bucketVisits?: Record<string, number> }
): boolean {
  const { player } = ctx;
  if (!tile.card) return false;
  if (tile.card.type === 'CandyBucket') {
    const visits = tile.bucketVisits?.[player.id] ?? 0;
    return visits < 1 && (tile.candyTokensOnTile ?? 0) > 0;
  }
  if (tile.card.type === 'Item' || tile.card.type === 'CandyItem') return !tile.itemCollected;
  if (tile.card.type === 'KingSizeBar') return !tile.itemCollected;
  if (!tile.isFlipped) return true;
  return false;
}

function getProgressTowardHome(row: number): number {
  return (4 - row) * 2;
}

function getProgressTowardMansion(row: number): number {
  return row * 2;
}

// --- Action types for scoring ---

export interface ScoredMove {
  type: 'move';
  row: number;
  col: number;
  score: number;
  reason?: string;
}

export interface ScoredGoHome {
  type: 'goHome';
  score: number;
  reason?: string;
}

export interface ScoredItemPlay {
  type: 'playItem';
  item: ItemCard;
  targetTile?: { row: number; col: number };
  /** For Binoculars: 2 tiles to peek at */
  targetTiles?: { row: number; col: number }[];
  score: number;
  reason?: string;
}

export type ScoredAction = ScoredMove | ScoredGoHome | ScoredItemPlay;

// --- Move scoring ---

function scoreMove(ctx: BotContext, targetRow: number, targetCol: number): number {
  const { state, player, lastMoveFrom, roundPhase, standing, weights, strategicMode } = ctx;
  const tile = state.board[targetRow]?.[targetCol];
  if (!tile || tile.isClosed) return -100;

  const pos = player.pawnPosition;
  const isSameTile = pos !== null && pos.row === targetRow && pos.column === targetCol;
  const isAdjacentTile = pos === null || isAdjacent(pos.row, pos.column, targetRow, targetCol);

  if (!isAdjacentTile && !(isSameTile && !tile.isFlipped)) return -100;

  let score = 0;

  score += getLoopPenalty(ctx, targetRow, targetCol);

  if (lastMoveFrom && lastMoveFrom.roundNumber === state.roundNumber) {
    if (lastMoveFrom.from.row === targetRow && lastMoveFrom.from.col === targetCol) {
      score -= 12 * weights.monsterRiskWeight;
    }
  }

  const productive = isProductiveMove(ctx, targetRow, targetCol, tile);
  const progressHome = pos ? getProgressTowardHome(targetRow) - getProgressTowardHome(pos.row) : 0;
  const progressMansion = pos ? getProgressTowardMansion(targetRow) - getProgressTowardMansion(pos.row) : 0;

  if (!productive && tile.card?.type === 'Monster') {
    score -= 8;
  }
  if (!productive && progressHome < 0 && progressMansion < 0) {
    score -= 10;
  }
  if (strategicMode === 'GoHome' && progressHome < 0) score -= 8;
  if (strategicMode === 'PushMansion' && progressMansion < 0) score -= 8;
  if (strategicMode === 'GoHome' && progressHome > 0) score += 5;
  if (strategicMode === 'PushMansion' && progressMansion > 0) score += 5;

  if (isSameTile && !tile.isFlipped) {
    return 12 * weights.explorationWeight + score;
  }

  // Unflipped tile: use peeked info if we have it (from Binoculars), else expected value
  if (!tile.isFlipped) {
    const peeked = state.botPeekedTiles?.[player.id]?.[`${targetRow},${targetCol}`];
    if (peeked) {
      // We know what's under (from Binoculars) - score using actual card type
      const card = peeked;
      if (card.type === 'CandyBucket') {
        const tokens = tile.candyTokensOnTile || GAME_RULES.candyBucketTokens(state.players.length);
        const visits = tile.bucketVisits?.[player.id] ?? 0;
        if (visits >= 1) return -3;
        score += (tokens * 2.5) * weights.candyWeight;
      } else if (card.type === 'Item' || card.type === 'CandyItem') {
        score += tile.itemCollected ? -3 : 5 * weights.pointWeight;
      } else if (card.type === 'Monster') {
        score += getMonsterRisk(card) * weights.monsterRiskWeight;
        if (standing === 'behind') score += 1 * weights.riskWhenBehindWeight;
        if (standing === 'ahead') score -= 1 * weights.bankWhenAheadWeight;
      } else if (card.type === 'KingSizeBar') {
        score += tile.itemCollected ? -3 : 6 * weights.pointWeight;
      } else if (card.type === 'OldManJohnson') {
        score -= 3 * weights.monsterRiskWeight;
        if (standing === 'behind' && player.roundCandy < 3) score += 2;
      }
      return score;
    }

    // Unknown: expected value
    const baseExplore = 10;
    const mansionPenalty = targetRow >= 4 ? 4 : 0;
    const dist = pos
      ? Math.abs(pos.row - targetRow) + Math.abs(pos.column - targetCol)
      : 0;
    const distPenalty = dist * 0.2;
    score += (baseExplore - mansionPenalty - distPenalty) * weights.explorationWeight;
    if (roundPhase === 'early') score += 2;
    if (roundPhase === 'late') score -= 2;
    if (standing === 'behind') score += 2 * weights.riskWhenBehindWeight;
    if (standing === 'ahead') score -= 1 * weights.bankWhenAheadWeight;
    return score;
  }

  // Known tile types
  const card = tile.card;
  if (!card) return score - 2;

  if (card.type === 'CandyBucket') {
    const tokens = tile.candyTokensOnTile ?? 0;
    const visits = tile.bucketVisits?.[player.id] ?? 0;
    if (visits >= 1) return -3; // Already collected
    const candyValue = tokens * 2.5;
    score += candyValue * weights.candyWeight;
    return score;
  }

  if (card.type === 'Item' || card.type === 'CandyItem') {
    if (tile.itemCollected) return -3;
    const itemValue = 5; // Expected value of drawing
    score += itemValue * weights.pointWeight;
    return score;
  }

  if (card.type === 'Monster') {
    const risk = getMonsterRisk(card);
    score += risk * weights.monsterRiskWeight;
    if (standing === 'behind') score += 1 * weights.riskWhenBehindWeight;
    if (standing === 'ahead') score -= 2 * weights.bankWhenAheadWeight;
    if (card.monsterType === 'Werewolf') score -= 3;
    return score;
  }

  if (card.type === 'KingSizeBar') {
    if (tile.itemCollected) return -3;
    const pts = 6; // ~avg of 5–7
    score += pts * weights.pointWeight;
    if (targetRow >= 4) score += 2; // Mansion = high value
    return score;
  }

  if (card.type === 'OldManJohnson') {
    score -= 3 * weights.monsterRiskWeight; // Round ends, lose round candy
    if (standing === 'behind' && player.roundCandy < 3) score += 2; // Desperate
    return score;
  }

  return score - 1;
}

// Positional value: progress toward Mansion Row (row 4)
function getPositionBonus(row: number): number {
  return row * 0.5; // Higher row = closer to mansion
}

// --- Go Home scoring ---

function scoreGoHome(ctx: BotContext): number {
  const { player, roundPhase, standing, weights, productiveTileCount, strategicMode } = ctx;
  const roundCandy = player.roundCandy ?? 0;

  let score = 0;

  score += roundCandy * 1.5 * weights.candyWeight;

  if (roundPhase === 'late') score += 6 * weights.bankWhenAheadWeight;
  if (roundPhase === 'early') score -= 3;

  if (standing === 'ahead') score += 5 * weights.bankWhenAheadWeight;
  if (standing === 'behind') score -= 4 * weights.riskWhenBehindWeight;

  if (productiveTileCount <= 2) score += 5;
  if (productiveTileCount <= 4 && roundPhase === 'late') score += 3;

  if (roundCandy <= 2) score -= 2;

  if (strategicMode === 'GoHome') score += 4;

  return score;
}

// --- Item play scoring ---

function scoreIntrusiveThoughts(ctx: BotContext, bucket: { row: number; col: number }): number {
  const { state, weights } = ctx;
  const tile = state.board[bucket.row]?.[bucket.col];
  if (!tile || tile.card?.type !== 'CandyBucket' || !tile.isFlipped) return -10;
  const tokens = tile.candyTokensOnTile ?? 0;
  const bonus = Math.min(GAME_RULES.intrusiveThoughtsBonusTokens, state.candySupply);
  const totalGain = tokens + bonus;
  return totalGain * 2 * weights.candyWeight;
}

function scoreShortcut(ctx: BotContext, target: { row: number; col: number }): number {
  const { state, player, weights } = ctx;
  const tile = state.board[target.row]?.[target.col];
  if (!tile || tile.isClosed || target.row >= 4) return -10;
  let s = 0;
  if (!tile.isFlipped) s = 12 * weights.explorationWeight;
  else if (tile.card?.type === 'CandyBucket' && (tile.candyTokensOnTile ?? 0) > 0) {
    const visits = tile.bucketVisits?.[player.id] ?? 0;
    if (visits < 1) s = 10 * weights.candyWeight;
  } else if (tile.card?.type === 'Item' || tile.card?.type === 'CandyItem') {
    s = !tile.itemCollected ? 6 * weights.pointWeight : -2;
  } else if (tile.card?.type === 'KingSizeBar' && !tile.itemCollected) {
    s = 10 * weights.pointWeight;
  }
    s += getPositionBonus(target.row) * weights.positionWeight;
  return s;
}

function scoreFlashlight(ctx: BotContext, target: { row: number; col: number }): number {
  const { state, player, weights } = ctx;
  const tile = state.board[target.row]?.[target.col];
  if (!tile || tile.isClosed || !tile.card) return -10;

  const pos = player.pawnPosition;
  if (!pos || !isAdjacent(pos.row, pos.column, target.row, target.col)) return -10;

  // Only use when it helps: clears a blocking monster, or reveals unknown that blocks path
  if (tile.card.type === 'Monster' && tile.isFlipped) {
    const blocksValuablePath = tileBlocksValuablePath(ctx, target.row, target.col);
    const base = 6 * weights.monsterRiskWeight;
    return blocksValuablePath ? base + 4 : base;
  }
  if (!tile.isFlipped) {
    const blocksPath = tileBlocksValuablePath(ctx, target.row, target.col);
    return blocksPath ? 5 * weights.explorationWeight : 2;
  }
  return -2;
}

function tileBlocksValuablePath(ctx: BotContext, row: number, col: number): boolean {
  const { state, player } = ctx;
  const pos = player.pawnPosition;
  if (!pos) return false;
  const tile = state.board[row]?.[col];
  if (!tile || tile.isClosed) return false;
  const isMonster = tile.card?.type === 'Monster';
  const isFaceDown = !tile.isFlipped;
  if (!isMonster && !isFaceDown) return false;
  const rowProgress = row > pos.row;
  const nearMansion = row >= 3;
  const hasUnflippedBeyond = ctx.unflippedCount > 0;
  return rowProgress || nearMansion || hasUnflippedBeyond;
}

function scoreItemDiscard(item: ItemCard): number {
  // Negative-point items: prefer to discard
  if (item.points < 0) return 5;
  if (item.type === 'Toothbrush' || item.type === 'Pennies' || item.type === 'RottenApple') return 4;
  return -2; // Don't discard good items
}

// --- Action generation ---

function generateLegalMoves(ctx: BotContext): ScoredMove[] {
  const { state, player } = ctx;
  const pos = player.pawnPosition;
  const moves: ScoredMove[] = [];

  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const tile = state.board[r]?.[c];
      if (!tile || tile.isClosed) continue;
      const isSame = pos !== null && pos.row === r && pos.column === c;
      const isAdj = pos === null || isAdjacent(pos.row, pos.column, r, c);
      if (!isAdj && !(isSame && !tile.isFlipped)) continue;

      const score = scoreMove(ctx, r, c) + getPositionBonus(r) * ctx.weights.positionWeight;
      if (score > -50) {
        moves.push({ type: 'move', row: r, col: c, score });
      }
    }
  }
  return moves;
}

function generateItemPlays(ctx: BotContext): ScoredItemPlay[] {
  const { state, player } = ctx;
  const plays: ScoredItemPlay[] = [];

  for (const item of player.itemCards) {
    if (item.type === 'IntrusiveThoughts') {
      const bucket = findBucketWithTokens(state);
      if (bucket) {
        const onBucket =
          player.pawnPosition?.row === bucket.row && player.pawnPosition?.column === bucket.col;
        if (onBucket) {
          const s = scoreIntrusiveThoughts(ctx, bucket);
          const tile = state.board[bucket.row]?.[bucket.col];
          const tokens = tile?.candyTokensOnTile ?? 0;
          const bonus = Math.min(GAME_RULES.intrusiveThoughtsBonusTokens, state.candySupply);
          if (s > 0 && (tokens + bonus) >= 5) plays.push({ type: 'playItem', item, targetTile: bucket, score: s });
        }
      }
    }
    if (item.type === 'Shortcut') {
      const target = findBestShortcutTarget(ctx);
      if (target && target.score >= 8) {
        plays.push({
          type: 'playItem',
          item,
          targetTile: { row: target.row, col: target.col },
          score: target.score,
        });
      }
    }
    if (item.type === 'Flashlight') {
      const target = findFlashlightTarget(ctx);
      if (target) {
        const s = scoreFlashlight(ctx, target);
        if (s > 0)
          plays.push({
            type: 'playItem',
            item,
            targetTile: { row: target.row, col: target.col },
            score: s,
          });
      }
    }
    if (item.type === 'Binoculars') {
      const targets = findBestBinocularsTargets(ctx);
      if (targets.length >= 1) {
        const s = scoreBinocularsPlay(ctx, targets);
        if (s > 2)
          plays.push({
            type: 'playItem',
            item,
            targetTiles: targets,
            score: s,
          });
      }
    }
  }
  return plays;
}

function findBucketWithTokens(state: GameState): { row: number; col: number } | null {
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (
        t?.card?.type === 'CandyBucket' &&
        t.isFlipped &&
        !t.isClosed &&
        (t.candyTokensOnTile ?? 0) > 0
      ) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function findBestShortcutTarget(ctx: BotContext): { row: number; col: number; score: number } | null {
  const { state } = ctx;
  let best: { row: number; col: number; score: number } | null = null;
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      if (r >= 4) continue;
      const s = scoreShortcut(ctx, { row: r, col: c });
      if (s > 0 && (!best || s > best.score)) best = { row: r, col: c, score: s };
    }
  }
  return best;
}

/** Flashlight: adjacent tiles only. Prefer clearing monsters that block valuable paths. */
function findFlashlightTarget(ctx: BotContext): { row: number; col: number } | null {
  const { state, player } = ctx;
  const pos = player.pawnPosition;
  if (!pos) return null;

  let best: { row: number; col: number; score: number } | null = null;
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      if (!isAdjacent(pos.row, pos.column, r, c)) continue;
      const t = state.board[r][c];
      if (!t || t.isClosed || !t.card) continue;

      const s = scoreFlashlight(ctx, { row: r, col: c });
      if (s > 0 && (!best || s > best.score)) best = { row: r, col: c, score: s };
    }
  }
  return best ? { row: best.row, col: best.col } : null;
}

// Binoculars: pick 2 face-down tiles that are most actionable (adjacent or on path)
function findBestBinocularsTargets(ctx: BotContext): { row: number; col: number }[] {
  const { state, player } = ctx;
  const pos = player.pawnPosition;
  const candidates: { row: number; col: number; score: number }[] = [];
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (!t || t.isClosed || t.isFlipped) continue;
      let score = 4 + getPositionBonus(r) * ctx.weights.positionWeight;
      if (pos && isAdjacent(pos.row, pos.column, r, c)) score += 10;
      candidates.push({ row: r, col: c, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const take = Math.min(2, candidates.length);
  return candidates.slice(0, take).map((x) => ({ row: x.row, col: x.col }));
}

function scoreBinocularsPlay(ctx: BotContext, targets: { row: number; col: number }[]): number {
  let s = 5 * ctx.weights.explorationWeight + targets.length * 2;
  const pos = ctx.player.pawnPosition;
  if (pos && pos.row >= 3 && ctx.unflippedCount >= 3) s += 3;
  if (ctx.unflippedCount >= 5) s += 2;
  return s;
}

// --- Action selection ---

function getStrategicGoHomeMessage(ctx: BotContext): string {
  const { player, strategicMode, roundPhase, productiveTileCount } = ctx;
  const candy = player.roundCandy ?? 0;
  if (strategicMode === 'GoHome' && candy >= 5) {
    return `${player.name} went home to bank ${candy} candy (securing lead)`;
  }
  if (roundPhase === 'late' && candy >= 3) {
    return `${player.name} went home to bank ${candy} candy (late round)`;
  }
  if (productiveTileCount <= 2) {
    return `${player.name} went home to bank ${candy} candy (no productive moves left)`;
  }
  return `${player.name} had no productive safe moves and went home to bank ${candy} candy`;
}

function getStrategicMoveMessage(
  ctx: BotContext,
  row: number,
  col: number,
  tile: { card?: { type: string; monsterType?: string } | null }
): string {
  const { player, strategicMode } = ctx;
  const loc = formatTileLocation(row, col);
  const isMonster = tile.card?.type === 'Monster';
  if (strategicMode === 'GoHome' && !isMonster) {
    return `${player.name} moved toward home via ${loc}`;
  }
  if (strategicMode === 'PushMansion' && !isMonster) {
    return `${player.name} pushed toward Mansion Row via ${loc}`;
  }
  if (isMonster) {
    return `${player.name} moved to ${loc} (${tile.card?.monsterType ?? 'Monster'})`;
  }
  return `${player.name} moved to ${loc}`;
}

export function selectBestAction(
  state: GameState,
  player: Player,
  lastMoveFrom: BotMoveHistory | null,
  profile: BotProfile = 'greedy',
  pathHistory: BotPathHistory | null = null
): BotAction | null {
  const ctx = buildContext(state, player, lastMoveFrom, pathHistory, profile);

  const moves = generateLegalMoves(ctx);
  const goHomeScore = scoreGoHome(ctx);
  const itemPlays = generateItemPlays(ctx);

  const badItems = player.itemCards.filter((i) => scoreItemDiscard(i) > 0);
  const bestBadItem = badItems.reduce(
    (a, b) => (scoreItemDiscard(a) >= scoreItemDiscard(b) ? a : b),
    badItems[0]
  );

  const bestItem = itemPlays.reduce((a, b) => (a.score >= b.score ? a : b), itemPlays[0]);
  const flashOrShortcut = bestItem?.item?.type === 'Flashlight' || bestItem?.item?.type === 'Shortcut';
  const itemThreshold = flashOrShortcut ? 7 : bestItem?.targetTiles ? 5 : 8;
  if (bestItem && bestItem.score >= itemThreshold) {
    return actionFromScoredItem(bestItem, player);
  }

  const bestMove = moves.reduce((a, b) => (a.score >= b.score ? a : b), moves[0]);

  const allMovesBad = !bestMove || bestMove.score <= 0;
  const goHomeBetter = goHomeScore > (bestMove?.score ?? -10) && goHomeScore >= 5;
  const lateRoundBias =
    ctx.roundPhase === 'late' &&
    (player.roundCandy ?? 0) >= 3 &&
    (bestMove?.score ?? 0) < 6 &&
    goHomeScore >= 3;

  if (allMovesBad || goHomeBetter || lateRoundBias) {
    return {
      type: 'goHome',
      logMessage: getStrategicGoHomeMessage(ctx),
    };
  }

  const discardScore = bestBadItem ? scoreItemDiscard(bestBadItem) : 0;
  if (bestBadItem && discardScore >= 4 && (bestMove?.score ?? 0) < 4) {
    return {
      type: 'discardItem',
      logMessage: `${player.name} discarded ${bestBadItem.type}`,
      item: bestBadItem,
    };
  }

  const tile = state.board[bestMove.row]?.[bestMove.col];
  return {
    type: 'move',
    logMessage: getStrategicMoveMessage(ctx, bestMove.row, bestMove.col, tile ?? {}),
    targetTile: { row: bestMove.row, col: bestMove.col },
  };
}

function actionFromScoredItem(play: ScoredItemPlay, player: Player): BotAction {
  const locs =
    play.targetTiles?.length
      ? play.targetTiles.map((t) => formatTileLocation(t.row, t.col)).join(' and ')
      : play.targetTile
        ? formatTileLocation(play.targetTile.row, play.targetTile.col)
        : null;
  return {
    type: 'playItem',
    logMessage: locs ? `${player.name} used ${play.item.type} on ${locs}` : `${player.name} used ${play.item.type}`,
    item: play.item,
    targetTile: play.targetTile,
    targetTiles: play.targetTiles,
  };
}
