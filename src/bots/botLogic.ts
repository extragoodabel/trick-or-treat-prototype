/**
 * Bot decision logic for Trick or Treat.
 * Simple rule-based bots for playtesting. No AI APIs or external services.
 * Modular and easy to revise.
 */

import type { GameState, Player, ItemCard } from '../game/types';

// Row/col to display format (A1, B2, etc.)
function tileLabel(row: number, col: number): string {
  const colLetter = String.fromCharCode(65 + col);
  return `${colLetter}${row + 1}`;
}

export type BotActionType = 'moveFlip' | 'moveResolve' | 'goHome' | 'playItem';

export interface BotAction {
  type: BotActionType;
  logMessage: string;
  targetTile?: { row: number; col: number };
  targetPlayerId?: string;
  item?: ItemCard;
}

/**
 * Get a legal action for a bot player. Uses simple heuristics:
 * - Prefer collecting candy from buckets
 * - Prefer going home when candy is decent and round is risky
 * - Use Naughty Kid on buckets with tokens
 * - Use Shortcut to reach candy or escape
 * - Use Flashlight to remove threatening monsters
 * - Avoid flipping unknown tiles in mansion row (Ender risk)
 */
export function getBotAction(state: GameState, playerId: string): BotAction | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.controllerType !== 'bot' || player.isHome || player.skipNextTurn) {
    return null;
  }

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (state.currentPlayerIndex !== playerIdx) return null;
  if (state.gamePhase !== 'playing') return null;

  // 1. Consider going home
  const goHomeScore = evaluateGoHome(state, player);
  if (goHomeScore > 0.6) {
    return { type: 'goHome', logMessage: `${player.name} chose to go home` };
  }

  // 2. Consider playing useful items
  const itemAction = evaluateItemPlay(state, player);
  if (itemAction) return itemAction;

  // 3. Prefer Move & Resolve to revealed candy buckets (safe candy)
  const bucketTarget = findBestCandyBucket(state, player);
  if (bucketTarget) {
    return {
      type: 'moveResolve',
      logMessage: `${player.name} moved to ${tileLabel(bucketTarget.row, bucketTarget.col)} and collected candy`,
      targetTile: { row: bucketTarget.row, col: bucketTarget.col },
    };
  }

  // 4. Move & Flip: prefer safe rows (1-4), avoid mansion row if we have candy
  const flipTarget = findBestFlipTarget(state, player);
  if (flipTarget) {
    return {
      type: 'moveFlip',
      logMessage: `${player.name} moved to ${tileLabel(flipTarget.row, flipTarget.col)} and flipped`,
      targetTile: { row: flipTarget.row, col: flipTarget.col },
    };
  }

  // 5. Move & Resolve to any revealed tile (item, etc.) if nothing better
  const resolveTarget = findAnyRevealedTile(state, player);
  if (resolveTarget) {
    return {
      type: 'moveResolve',
      logMessage: `${player.name} moved to ${tileLabel(resolveTarget.row, resolveTarget.col)}`,
      targetTile: { row: resolveTarget.row, col: resolveTarget.col },
    };
  }

  // 6. Default: go home if we have any candy
  if (player.candyTokens > 0) {
    return { type: 'goHome', logMessage: `${player.name} chose to go home` };
  }

  return null;
}

function evaluateGoHome(_state: GameState, player: Player): number {
  if (player.candyTokens === 0) return 0;
  const pos = player.pawnPosition;
  if (!pos) return 0.3;
  // More likely to go home if on mansion row (Ender risk)
  if (pos.row >= 4) return 0.8;
  // More candy = more reason to secure it
  if (player.candyTokens >= 5) return 0.6;
  return 0.2;
}

function evaluateItemPlay(state: GameState, player: Player): BotAction | null {
  for (const item of player.itemCards) {
    if (item.type === 'NaughtyKid') {
      const bucket = findBucketWithTokens(state);
      if (bucket) {
        return {
          type: 'playItem',
          logMessage: `${player.name} used Naughty Kid on ${tileLabel(bucket.row, bucket.col)}`,
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
          logMessage: `${player.name} used Shortcut to move to ${tileLabel(target.row, target.col)}`,
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
          logMessage: `${player.name} used Flashlight to remove monster at ${tileLabel(monsterTile.row, monsterTile.col)}`,
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

function findBestCandyBucket(state: GameState, player: Player): { row: number; col: number } | null {
  let best: { row: number; col: number; tokens: number } | null = null;
  const pos = player.pawnPosition;
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (t.card?.type !== 'CandyBucket' || !t.isFlipped || t.isClosed || t.candyTokensOnTile === 0) continue;
      const visits = t.bucketVisits?.[player.id] ?? 0;
      if (visits >= 1) continue; // Already collected from this bucket
      const dist = pos ? Math.abs(pos.row - r) + Math.abs(pos.column - c) : 0;
      if (!best || t.candyTokensOnTile > best.tokens || (t.candyTokensOnTile === best.tokens && dist < 2)) {
        best = { row: r, col: c, tokens: t.candyTokensOnTile };
      }
    }
  }
  return best ? { row: best.row, col: best.col } : null;
}

function findBestFlipTarget(state: GameState, player: Player): { row: number; col: number } | null {
  const pos = player.pawnPosition;
  const candidates: { row: number; col: number; score: number }[] = [];
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (t.isFlipped || t.isClosed) continue;
      let score = 10;
      if (r >= 4) score -= 5; // Mansion row = Ender risk
      if (pos) {
        const dist = Math.abs(pos.row - r) + Math.abs(pos.column - c);
        score -= dist * 0.5;
      }
      candidates.push({ row: r, col: c, score });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { row: candidates[0].row, col: candidates[0].col };
}

function findAnyRevealedTile(state: GameState, player: Player): { row: number; col: number } | null {
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      const t = state.board[r][c];
      if (!t.isFlipped || t.isClosed) continue;
      if (t.card?.type === 'CandyBucket') {
        const visits = t.bucketVisits?.[player.id] ?? 0;
        if (visits < 1 && t.candyTokensOnTile > 0) return { row: r, col: c };
      }
      if (t.card?.type === 'Item') return { row: r, col: c };
    }
  }
  return null;
}

function findBestShortcutTarget(state: GameState, player: Player): { row: number; col: number } | null {
  const bucket = findBestCandyBucket(state, player);
  if (bucket) return bucket;
  const flip = findBestFlipTarget(state, player);
  return flip;
}

function findMonsterToRemove(state: GameState, player: Player): { row: number; col: number } | null {
  // Prefer removing monsters that affect our costume (we're not immune)
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
