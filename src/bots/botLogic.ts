/**
 * Bot decision logic for Trick or Treat.
 * Simple rule-based bots for playtesting. No AI APIs or external services.
 * Modular and easy to revise.
 *
 * Avoids infinite loops by:
 * - Tracking recent movement to detect backtracking
 * - Scoring all legal moves; going home if all scores <= 0
 * - Prioritizing productive actions over non-productive wandering
 */

import type { GameState, Player, ItemCard } from '../game/types';
import { formatTileLocation } from '../game/boardLabels';
import { isOrthogonallyAdjacent } from '../game/movement';

export type BotActionType = 'move' | 'goHome' | 'playItem';

export interface BotAction {
  type: BotActionType;
  logMessage: string;
  targetTile?: { row: number; col: number };
  targetPlayerId?: string;
  item?: ItemCard;
}

/** Last tile the bot moved from (for backtracking detection). Only used by bot logic. */
export interface BotMoveHistory {
  from: { row: number; col: number };
  roundNumber: number;
}

/** Get a random available first-row tile for starting position. Returns null if none. */
export function getBotStartingPosition(state: GameState): { row: number; col: number } | null {
  if (state.gamePhase !== 'chooseStartingPosition') return null;
  const occupied = new Set(
    state.players
      .filter((p) => p.pawnPosition !== null)
      .map((p) => `${p.pawnPosition!.row},${p.pawnPosition!.column}`)
  );
  const available: { row: number; col: number }[] = [];
  for (let c = 0; c < 5; c++) {
    if (!occupied.has(`0,${c}`)) available.push({ row: 0, col: c });
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
  if (pos !== null && !isOrthogonallyAdjacent(pos.row, pos.column, targetRow, targetCol)) {
    return -10;
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
    if (targetRow >= 4) score -= 5; // Mansion row = Ender risk
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

  // Productive: Item tile (we can draw)
  if (tile.card?.type === 'Item') return 6;

  // Non-productive: Monster (we trigger effect, no gain)
  if (tile.card?.type === 'Monster') return 1;

  // Non-productive: Ender (round ends, but we might not want to trigger)
  if (tile.card?.type === 'Ender') return 2;

  // Empty bucket, already-collected bucket, etc.
  return -1;
}

/**
 * Get a legal action for a bot player. Uses scoring to avoid loops:
 * - Prefer productive moves (flip, collect candy, draw item)
 * - Avoid backtracking and non-productive movement
 * - Go home if all legal moves score <= 0
 */
export function getBotAction(
  state: GameState,
  playerId: string,
  lastMoveFrom?: BotMoveHistory | null
): BotAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.controllerType !== 'bot' || player.isHome || player.skipNextTurn) {
    return null;
  }

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (state.currentPlayerIndex !== playerIdx) return null;
  if (state.gamePhase !== 'playing') return null;

  const validHistory = lastMoveFrom?.roundNumber === state.roundNumber ? lastMoveFrom : null;

  // 1. Consider useful item plays (high priority) - these bypass move scoring
  const itemAction = evaluateItemPlay(state, player);
  if (itemAction) return itemAction;

  // 2. Collect all legal moves with scores
  const candidates: { row: number; col: number; score: number }[] = [];

  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const score = scoreMove(state, player, r, c, validHistory);
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
    if (item.type === 'NaughtyKid') {
      const bucket = findBucketWithTokens(state);
      if (bucket) {
        return {
          type: 'playItem',
          logMessage: `${player.name} used Naughty Kid on ${formatTileLocation(bucket.row, bucket.col)}`,
          item,
          targetTile: { row: bucket.row, col: bucket.col },
        };
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
      const monsterTile = findMonsterToRemove(state, player);
      if (monsterTile) {
        return {
          type: 'playItem',
          logMessage: `${player.name} used Flashlight to remove monster at ${formatTileLocation(monsterTile.row, monsterTile.col)}`,
          item,
          targetTile: { row: monsterTile.row, col: monsterTile.col },
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
      } else if (t.card?.type === 'Item') score = 6;
      if (r >= 4) score -= 5;
      if (score > 0 && (!best || score > best.score)) {
        best = { row: r, col: c, score };
      }
    }
  }
  return best ? { row: best.row, col: best.col } : null;
}

function findMonsterToRemove(state: GameState, player: Player): { row: number; col: number } | null {
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (t.card?.type === 'Monster' && t.isFlipped) {
        if (t.card.monsterType !== player.costume) return { row: r, col: c };
      }
    }
  }
  return null;
}
