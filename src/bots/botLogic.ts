/**
 * Bot decision logic for Trick or Treat.
 * Simple rule-based bots for playtesting. No AI APIs or external services.
 * Modular and easy to revise.
 *
 * Two modes:
 * - Simple (useSmartBots=false): Original hardcoded action order, minimal scoring
 * - Smart (useSmartBots=true): Heuristic scoring, game-phase awareness, personality profiles
 *
 * Avoids infinite loops by:
 * - Tracking recent movement to detect backtracking
 * - Scoring all legal moves; going home if all scores <= 0
 * - Prioritizing productive actions over non-productive wandering
 */

import type { GameState, Player, ItemCard } from '../game/types';
import { formatTileLocation } from '../game/boardLabels';
import { isAdjacent } from '../game/movement';
import { selectBestAction } from './botEvaluation';
import type { BotProfile } from './botEvaluation';

export type BotActionType = 'move' | 'goHome' | 'playItem' | 'discardItem' | 'resolveMonsterEncounter';

export interface BotAction {
  type: BotActionType;
  logMessage: string;
  targetTile?: { row: number; col: number };
  /** For Binoculars: 2 tiles to peek at (or 1 if only 1 face-down remains) */
  targetTiles?: { row: number; col: number }[];
  targetPlayerId?: string;
  item?: ItemCard;
}

/** Last tile the bot moved from (for backtracking detection). Only used by bot logic. */
export interface BotMoveHistory {
  from: { row: number; col: number };
  roundNumber: number;
}

/** Recent move history for anti-loop detection (last 6 moves). */
export interface BotPathHistory {
  roundNumber: number;
  moves: { from: { row: number; col: number }; to: { row: number; col: number } }[];
}

export const BOT_PATH_HISTORY_MAX = 6;

export interface GetBotActionOptions {
  /** When true, use heuristic scoring and game-phase awareness. When false, use original simple logic. */
  useSmartBots?: boolean;
  /** Personality profile for smart bots: greedy, cautious, aggressive, comeback */
  profile?: BotProfile;
  /** Recent path history for anti-loop detection (smart bots only). */
  pathHistory?: BotPathHistory | null;
}

/** Get a random first-row tile for starting position. Multiple players may choose same tile. */
export function getBotStartingPosition(state: GameState): { row: number; col: number } | null {
  if (state.gamePhase !== 'chooseStartingPosition') return null;
  const available: { row: number; col: number }[] = [];
  for (let c = 0; c < 5; c++) {
    const tile = state.board[0]?.[c];
    if (tile && !tile.isClosed) available.push({ row: 0, col: c });
  }
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Score a potential move. Positive = productive, zero/negative = non-productive.
 * Used to avoid infinite loops: if all moves score <= 0, bot goes home.
 */
function scoreMove(
  state: GameState,
  player: Player,
  targetRow: number,
  targetCol: number,
  lastMoveFrom: BotMoveHistory | null
): number {
  const tile = state.board[targetRow]?.[targetCol];
  if (!tile || tile.isClosed) return -10;

  const pos = player.pawnPosition;
  const isSameTile = pos !== null && pos.row === targetRow && pos.column === targetCol;
  const isAdjacentTile = pos === null || isAdjacent(pos.row, pos.column, targetRow, targetCol);

  if (!isAdjacentTile && !(isSameTile && !tile.isFlipped)) {
    return -10;
  }

  // Flip-in-place (starting tile): treat as productive
  if (isSameTile && !tile.isFlipped) {
    return 10; // Same as flipping an unflipped tile
  }

  // Avoid immediate backtracking (strong penalty)
  if (lastMoveFrom && lastMoveFrom.roundNumber === state.roundNumber) {
    if (lastMoveFrom.from.row === targetRow && lastMoveFrom.from.col === targetCol) {
      return -5; // Moving back to where we just came from
    }
  }

  // Productive: unflipped tile (we'll flip and resolve)
  if (!tile.isFlipped) {
    let score = 10;
    if (targetRow >= 4) score -= 5; // Mansion row = Old Man Johnson risk
    if (pos) {
      const dist = Math.abs(pos.row - targetRow) + Math.abs(pos.column - targetCol);
      score -= dist * 0.3;
    }
    return score;
  }

  // Productive: Candy Bucket we haven't collected from
  if (tile.card?.type === 'CandyBucket' && tile.candyTokensOnTile > 0) {
    const visits = tile.bucketVisits?.[player.id] ?? 0;
    if (visits < 1) return 8;
    return -2; // Already collected, no benefit
  }

  // Productive: Item / Candy Item tile (we can draw) - only if not yet used
  if (tile.card?.type === 'Item' || tile.card?.type === 'CandyItem') {
    return tile.itemCollected ? -2 : 6;
  }

  // Non-productive: Monster (we trigger effect, no gain). Werewolf causes direction loops.
  if (tile.card?.type === 'Monster') {
    const mt = tile.card.monsterType ?? '';
    return mt === 'Werewolf' ? -2 : 1;
  }

  // King Size Bar: high value (5-7 pts) — only if not yet claimed
  if (tile.card?.type === 'KingSizeBar') return tile.itemCollected ? -2 : 12;

  // Old Man Johnson: round ends, we lose round candy - avoid unless strategic
  if (tile.card?.type === 'OldManJohnson') return 2;

  // Empty bucket, already-collected bucket, etc.
  return -1;
}

/**
 * Get a legal action for a bot player.
 * When useSmartBots is true: uses heuristic scoring, game-phase awareness, personality profiles.
 * When useSmartBots is false: uses original simple logic (productive moves, avoid backtracking, go home if none).
 */
export function getBotAction(
  state: GameState,
  playerId: string,
  lastMoveFrom?: BotMoveHistory | null,
  options?: GetBotActionOptions
): BotAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.controllerType !== 'bot' || player.isHome || player.skipNextTurn) {
    return null;
  }

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (state.currentPlayerIndex !== playerIdx) return null;
  if (state.gamePhase !== 'playing') return null;

  const validHistory = lastMoveFrom?.roundNumber === state.roundNumber ? lastMoveFrom : null;
  const pathHistory =
    options?.pathHistory?.roundNumber === state.roundNumber ? options.pathHistory : null;

  if (state.monsterEncountered) {
    const encAction = getBotMonsterEncounterAction(state, player, options?.useSmartBots);
    if (encAction) return encAction;
  }

  if (options?.useSmartBots) {
    return selectBestAction(state, player, validHistory, options.profile ?? 'greedy', pathHistory);
  }

  return getBotActionSimple(state, player, validHistory);
}

function getBotMonsterEncounterAction(
  state: GameState,
  player: Player,
  useSmartBots?: boolean
): BotAction | null {
  const enc = state.monsterEncountered;
  if (!enc) return null;

  const tile = state.board[enc.row]?.[enc.col];
  const card = tile?.card;
  if (!card || card.type !== 'Monster') return null;

  const hasFlashlight = player.itemCards.some((c) => c.type === 'Flashlight');
  if (!hasFlashlight) {
    return { type: 'resolveMonsterEncounter', logMessage: `${player.name} faces the monster.` };
  }

  const shouldUseFlashlight = useSmartBots
    ? shouldBotUseFlashlightDefensively(state, player, card)
    : shouldBotUseFlashlightDefensivelySimple(state, player);

  if (shouldUseFlashlight) {
    const item = player.itemCards.find((c) => c.type === 'Flashlight')!;
    return {
      type: 'playItem',
      logMessage: `${player.name} used Flashlight to negate ${card.monsterType ?? 'Monster'}!`,
      item,
      targetTile: { row: enc.row, col: enc.col },
    };
  }

  return { type: 'resolveMonsterEncounter', logMessage: `${player.name} faces the monster.` };
}

function shouldBotUseFlashlightDefensivelySimple(state: GameState, player: Player): boolean {
  const enc = state.monsterEncountered;
  if (!enc) return false;
  const tile = state.board[enc.row]?.[enc.col];
  const card = tile?.card;
  if (!card || card.type !== 'Monster') return false;
  const mt = card.monsterType ?? '';
  if (mt === 'Zombie' || mt === 'Ghost') return player.roundCandy >= 3;
  return player.roundCandy >= 5;
}

function shouldBotUseFlashlightDefensively(
  _state: GameState,
  player: Player,
  card: { monsterType?: string }
): boolean {
  const mt = card.monsterType ?? '';
  const roundCandy = player.roundCandy ?? 0;

  const MONSTER_SEVERITY: Record<string, number> = {
    Zombie: 4,
    Ghost: 3,
    Goblin: 2,
    Vampire: 2,
    Witch: 1,
    Skeleton: 0.5,
    Werewolf: 0.5,
  };
  const severity = MONSTER_SEVERITY[mt] ?? 2;
  const candyAtRisk = roundCandy;
  const threshold = severity * 1.5;
  return candyAtRisk >= threshold || (mt === 'Zombie' && roundCandy > 0);
}

/** Original simple bot logic (used when useSmartBots is false). */
function getBotActionSimple(
  state: GameState,
  player: Player,
  lastMoveFrom: BotMoveHistory | null
): BotAction | null {
  // 1. Consider useful item plays (high priority) - these bypass move scoring
  const itemAction = evaluateItemPlay(state, player);
  if (itemAction) return itemAction;

  // 2. Collect all legal moves with scores
  const candidates: { row: number; col: number; score: number }[] = [];

  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const score = scoreMove(state, player, r, c, lastMoveFrom);
      if (score > -10) {
        candidates.push({ row: r, col: c, score });
      }
    }
  }

  // 3. If all scores <= 0, go home (no productive moves)
  const best = candidates.length > 0
    ? candidates.reduce((a, b) => (a.score >= b.score ? a : b))
    : null;

  if (!best || best.score <= 0) {
    return {
      type: 'goHome',
      logMessage: `${player.name} had no productive moves and went home`,
    };
  }

  // 4. Take the best productive move
  return {
    type: 'move',
    logMessage: `${player.name} moved to ${formatTileLocation(best.row, best.col)}`,
    targetTile: { row: best.row, col: best.col },
  };
}

function evaluateItemPlay(state: GameState, player: Player): BotAction | null {
  for (const item of player.itemCards) {
    if (item.type === 'IntrusiveThoughts') {
      const bucket = findBucketWithTokens(state);
      if (bucket) {
        const isOnBucket = player.pawnPosition?.row === bucket.row && player.pawnPosition?.column === bucket.col;
        if (isOnBucket) {
          return {
            type: 'playItem',
            logMessage: `${player.name} used Intrusive Thoughts on ${formatTileLocation(bucket.row, bucket.col)}`,
          item,
          targetTile: { row: bucket.row, col: bucket.col },
          };
        }
      }
    }
    if (item.type === 'Shortcut') {
      const target = findBestShortcutTarget(state, player);
      if (target) {
        return {
          type: 'playItem',
          logMessage: `${player.name} used Shortcut to move to ${formatTileLocation(target.row, target.col)}`,
          item,
          targetTile: { row: target.row, col: target.col },
        };
      }
    }
    if (item.type === 'Flashlight') {
      const target = findFlashlightTarget(state, player);
      if (target) {
        return {
          type: 'playItem',
          logMessage: `${player.name} used Flashlight on ${formatTileLocation(target.row, target.col)}`,
          item,
          targetTile: { row: target.row, col: target.col },
        };
      }
    }
  }
  return null;
}

function findBucketWithTokens(state: GameState): { row: number; col: number } | null {
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (t.card?.type === 'CandyBucket' && t.isFlipped && !t.isClosed && t.candyTokensOnTile > 0) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function findBestShortcutTarget(state: GameState, player: Player): { row: number; col: number } | null {
  let best: { row: number; col: number; score: number } | null = null;

  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (t.isClosed) continue;
      let score = 0;
      if (!t.isFlipped) score = 10;
      else if (t.card?.type === 'CandyBucket' && t.candyTokensOnTile > 0) {
        const visits = t.bucketVisits?.[player.id] ?? 0;
        if (visits < 1) score = 8;
      } else if (t.card?.type === 'Item' || t.card?.type === 'CandyItem') score = 6;
      if (r >= 4) continue; // Shortcut cannot target mansion row
      if (score > 0 && (!best || score > best.score)) {
        best = { row: r, col: c, score };
      }
    }
  }
  return best ? { row: best.row, col: best.col } : null;
}

/** Flashlight: adjacent tiles only. Prefer flipped monsters, then face-down. */
function findFlashlightTarget(state: GameState, player: Player): { row: number; col: number } | null {
  const pos = player.pawnPosition;
  if (!pos) return null;

  let flippedMonster: { row: number; col: number } | null = null;
  let faceDown: { row: number; col: number } | null = null;
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      if (!isAdjacent(pos.row, pos.column, r, c)) continue;
      const t = state.board[r][c];
      if (!t || t.isClosed || !t.card) continue;
      if (t.card.type === 'Monster' && t.isFlipped) {
        flippedMonster = { row: r, col: c };
      } else if (!t.isFlipped && !faceDown) {
        faceDown = { row: r, col: c };
      }
    }
  }
  return flippedMonster ?? faceDown;
}
