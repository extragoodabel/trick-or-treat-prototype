import type { GameState, Player, Tile, ItemCard } from './types';
import { GAME_RULES } from './gameRules';
import {
  createItemCard,
  ITEM_DECK,
} from './cardDefinitions';
import { setupNewNeighborhood, createInitialPlayers } from './setup';
import { formatTileLocation } from './boardLabels';
import { isOrthogonallyAdjacent } from './movement';

// --- Game setup ---

export function createNewGame(
  playerCount: number,
  costumes: string[],
  controllerTypes?: ('human' | 'bot')[]
): GameState {
  const players = createInitialPlayers(playerCount, costumes, controllerTypes);
  const baseState: GameState = {
    players,
    currentPlayerIndex: 0,
    board: [],
    houseDeck: [],
    mansionDeck: [],
    candySupply: GAME_RULES.initialCandySupply,
    roundNumber: 0,
    gamePhase: 'playing',
    selectedAction: null,
    pendingItemPlay: null,
    message: `${players[0].name}'s turn.`,
    turnLog: [],
  };
  return setupNewNeighborhood(baseState);
}

/** Append a message to the turn log. Used by UI when logging bot/human actions. */
export function appendToTurnLog(state: GameState, message: string): GameState {
  return {
    ...state,
    turnLog: [...state.turnLog, message],
  };
}

/** Select starting position (first row only). One player per tile. */
export function selectStartingPosition(
  state: GameState,
  row: number,
  col: number
): GameState {
  if (state.gamePhase !== 'chooseStartingPosition') return state;
  if (row !== 0) return state; // Must be first row

  const tile = state.board[row]?.[col];
  if (!tile) return state;

  const occupied = state.players.some(
    (p) => p.pawnPosition?.row === row && p.pawnPosition?.column === col
  );
  if (occupied) return state;

  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, pawnPosition: { row, column: col } } : p
  );

  const nextIndex = state.currentPlayerIndex + 1;
  const allChosen = nextIndex >= players.length;

  return {
    ...state,
    players,
    currentPlayerIndex: allChosen ? 0 : nextIndex,
    gamePhase: allChosen ? 'playing' : 'chooseStartingPosition',
    message: allChosen
      ? `${players[0].name}'s turn.`
      : `${players[nextIndex].name}, choose your starting house (first row)`,
  };
}

// --- Card resolution ---

function resolveCandyBucket(
  state: GameState,
  tile: Tile,
  playerId: string,
  isFlip: boolean
): GameState {
  const numPlayers = state.players.length;
  const tokensToPlace = GAME_RULES.candyBucketTokens(numPlayers);
  const flipperGets = GAME_RULES.candyBucketFlipperGets;

  const bucketVisits = { ...tile.bucketVisits } as Record<string, number>;
  if (!bucketVisits[playerId]) bucketVisits[playerId] = 0;

  let candySupply = state.candySupply;
  let players = [...state.players];
  const playerIdx = players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return state;

  if (isFlip) {
    // First flip: place tokens, flipper gets 1
    const tokensAvailable = Math.min(tokensToPlace, candySupply);
    candySupply -= tokensAvailable;
    const tokensOnTile = tokensAvailable;
    const flipperCollects = Math.min(flipperGets, tokensOnTile);

    players[playerIdx] = {
      ...players[playerIdx],
      candyTokens: players[playerIdx].candyTokens + flipperCollects,
    };
    bucketVisits[playerId] = 1;

    const newBoard = state.board.map((row) =>
      row.map((t) =>
        t.row === tile.row && t.column === tile.column
          ? {
              ...t,
              candyTokensOnTile: tokensOnTile - flipperCollects,
              bucketVisits,
            }
          : t
      )
    );
    return {
      ...state,
      board: newBoard,
      candySupply,
      players,
      message: `${players[playerIdx].name} flipped Candy Bucket! Got ${flipperCollects} candy.`,
    };
  } else {
    // Move & Resolve: collect 1 if not yet visited this bucket
    const visits = bucketVisits[playerId] || 0;
    if (visits < 1 && tile.candyTokensOnTile > 0) {
      const collect = 1;
      players[playerIdx] = {
        ...players[playerIdx],
        candyTokens: players[playerIdx].candyTokens + collect,
      };
      bucketVisits[playerId] = visits + 1;

      const newBoard = state.board.map((row) =>
        row.map((t) =>
          t.row === tile.row && t.column === tile.column
            ? {
                ...t,
                candyTokensOnTile: tile.candyTokensOnTile - collect,
                bucketVisits,
              }
            : t
        )
      );
      return {
        ...state,
        board: newBoard,
        players,
        message: `${players[playerIdx].name} collected ${collect} candy from bucket.`,
      };
    }
  }
  return state;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  FullSizeBar: 'Full Size Bar',
  Flashlight: 'Flashlight',
  Shortcut: 'Shortcut',
  NaughtyKid: 'Naughty Kid',
  Toothbrush: 'Toothbrush',
  Pennies: 'Pennies',
  RottenApple: 'Rotten Apple',
};

function resolveItemTile(
  state: GameState,
  playerId: string
): { state: GameState; itemType: string } {
  const players = [...state.players];
  const playerIdx = players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return { state, itemType: 'Item' };

  const itemType = ITEM_DECK[Math.floor(Math.random() * ITEM_DECK.length)];
  const newCard = createItemCard(itemType);
  players[playerIdx] = {
    ...players[playerIdx],
    itemCards: [...players[playerIdx].itemCards, newCard],
  };
  return {
    state: {
      ...state,
      players,
      message: `${players[playerIdx].name} drew an item card!`,
    },
    itemType: ITEM_TYPE_LABELS[itemType] ?? itemType,
  };
}

function isImmune(costume: string, monsterType?: string): boolean {
  return costume === monsterType;
}

function resolveMonster(
  state: GameState,
  tile: Tile,
  playerId: string
): GameState {
  const card = tile.card;
  if (!card || card.type !== 'Monster' || !card.monsterType) return state;

  const players = [...state.players];
  const playerIdx = players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return state;

  const player = players[playerIdx];
  if (isImmune(player.costume, card.monsterType)) {
    return {
      ...state,
      message: `${player.name} is immune (${player.costume})!`,
    };
  }

  const withAffected = (s: GameState, ids: string[], desc: string) => ({
    ...s,
    lastAffectedPlayerIds: ids,
    lastActionDescription: desc,
  });

  switch (card.monsterType) {
    case 'Ghost':
      players[playerIdx] = {
        ...player,
        candyTokens: Math.max(0, player.candyTokens - GAME_RULES.ghostLoseTokens),
      };
      return withAffected(
        { ...state, players, message: `${player.name} lost 3 candy to Ghost!` },
        [player.id],
        'lost 3 candy to Ghost'
      );

    case 'Zombie':
      players[playerIdx] = { ...player, skipNextTurn: true };
      return withAffected(
        { ...state, players, message: `${player.name} skips next turn (Zombie)!` },
        [player.id],
        'skips next turn (Zombie)'
      );

    case 'Witch': {
      const otherIdx = players.findIndex((p) => p.id !== playerId);
      if (otherIdx !== -1) {
        const other = players[otherIdx];
        const temp = players[playerIdx].itemCards;
        players[playerIdx] = { ...player, itemCards: players[otherIdx].itemCards };
        players[otherIdx] = { ...players[otherIdx], itemCards: temp };
        return withAffected(
          { ...state, players, message: `${player.name} swapped hands with ${other.name} (Witch)!` },
          [player.id, other.id],
          'swapped hands (Witch)'
        );
      }
      return { ...state, players, message: `${player.name} swapped hands with Witch!` };
    }

    case 'Skeleton':
      return withAffected(
        { ...state, message: `${player.name} revealed hand (Skeleton)!` },
        [player.id],
        'revealed hand (Skeleton)'
      );

    case 'Werewolf': {
      const lost = Math.floor(player.candyTokens / 2);
      players[playerIdx] = { ...player, candyTokens: player.candyTokens - lost };
      return withAffected(
        { ...state, players, message: `${player.name} lost half candy to Werewolf!` },
        [player.id],
        `lost ${lost} candy to Werewolf`
      );
    }

    case 'Goblin': {
      const sorted = [...players].sort(
        (a, b) => a.itemCards.length - b.itemCards.length
      );
      const fewest = sorted[0];
      if (fewest.itemCards.length > 0) {
        const fromIdx = players.findIndex((p) => p.id === fewest.id);
        const takeIdx = Math.floor(Math.random() * fewest.itemCards.length);
        const taken = fewest.itemCards[takeIdx];
        const newFewest = fewest.itemCards.filter((_, i) => i !== takeIdx);
        players[fromIdx] = { ...fewest, itemCards: newFewest };
        players[playerIdx] = {
          ...player,
          itemCards: [...player.itemCards, taken],
        };
        return withAffected(
          { ...state, players, message: `${player.name} took a card from ${fewest.name} (Goblin)!` },
          [fewest.id, player.id],
          `${player.name} took card from ${fewest.name} (Goblin)`
        );
      }
      return { ...state, players, message: `${player.name} triggered Goblin!` };
    }

    default:
      return state;
  }
}

function resolveEnder(state: GameState): GameState {
  const players = state.players.map((p) =>
    p.isHome ? p : { ...p, candyTokens: 0 }
  );
  return {
    ...state,
    players,
    gamePhase: 'roundEnd',
    message: 'Ender! All players not home lost their candy.',
  };
}

// --- Actions ---

function clearAffectedState(s: GameState): GameState {
  return { ...s, lastAffectedPlayerIds: undefined, lastActionDescription: undefined };
}

export function selectAction(
  state: GameState,
  action: 'move' | 'goHome' | 'playItem'
): GameState {
  if (state.gamePhase !== 'playing') return state;
  const player = state.players[state.currentPlayerIndex];
  if (player.isHome) return state;
  if (player.skipNextTurn) return state;

  return {
    ...clearAffectedState(state),
    selectedAction: action,
    message: `Selected: ${action}. ${action === 'playItem' ? 'Choose an item to play.' : 'Choose a tile to move to.'}`,
  };
}

export function goHome(state: GameState): GameState {
  if (state.gamePhase !== 'playing') return state;
  state = clearAffectedState(state);
  const player = state.players[state.currentPlayerIndex];
  if (player.isHome) return state;
  if (player.skipNextTurn) return state;

  const players = [...state.players];
  players[state.currentPlayerIndex] = { ...player, isHome: true };
  const { nextIndex: nextIdx, updatedPlayers: updatedPlayers } = advanceToNextPlayer(state.currentPlayerIndex, players);
  const withLog = appendToTurnLog(state, `${player.name} went home`);
  const allHome = updatedPlayers.every((p) => p.isHome);
  if (allHome) {
    return {
      ...withLog,
      players: updatedPlayers,
      currentPlayerIndex: 0,
      selectedAction: null,
      gamePhase: 'roundEnd',
      message: 'Everyone went home! Neighborhood complete.',
    };
  }
  return {
    ...withLog,
    players: updatedPlayers,
    currentPlayerIndex: nextIdx,
    selectedAction: null,
    message: `${player.name} went home! ${updatedPlayers[nextIdx].name}'s turn.`,
  };
}

function advanceToNextPlayer(
  current: number,
  players: Player[]
): { nextIndex: number; updatedPlayers: Player[] } {
  const active = players.filter((p) => !p.isHome);
  if (active.length === 0) return { nextIndex: current, updatedPlayers: players };
  if (active.length === 1) {
    const soleActiveIdx = players.findIndex((p) => !p.isHome);
    return { nextIndex: soleActiveIdx, updatedPlayers: players };
  }

  let next = (current + 1) % players.length;
  while (players[next].isHome) {
    next = (next + 1) % players.length;
  }

  if (players[next].skipNextTurn) {
    const updated = players.map((p, i) =>
      i === next ? { ...p, skipNextTurn: false } : p
    );
    const result = advanceToNextPlayer(next, updated);
    return result;
  }
  return { nextIndex: next, updatedPlayers: players };
}

/**
 * Single Move action: move to a tile and resolve.
 * - Face-down tile: flip it, then resolve the flip effect.
 * - Face-up tile: resolve the tile action immediately.
 */
export function move(state: GameState, row: number, col: number): GameState {
  if (state.gamePhase !== 'playing' || state.selectedAction !== 'move')
    return state;
  state = clearAffectedState(state);
  const player = state.players[state.currentPlayerIndex];
  if (player.isHome || player.skipNextTurn) return state;

  const tile = state.board[row]?.[col];
  if (!tile || tile.isClosed) return state;

  const pos = player.pawnPosition;
  if (pos !== null && !isOrthogonallyAdjacent(pos.row, pos.column, row, col)) {
    return {
      ...state,
      message: 'Movement must be to an adjacent house (up, down, left, or right).',
    };
  }

  const isFlip = !tile.isFlipped;

  let newState: GameState = {
    ...state,
    board: isFlip
      ? state.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === row && ci === col ? { ...t, isFlipped: true } : t
          )
        )
      : state.board,
    players: state.players.map((p, i) =>
      i === state.currentPlayerIndex ? { ...p, pawnPosition: { row, column: col } } : p
    ),
    selectedAction: null,
  };

  const card = tile.card;
  if (!card) return newState;

  const location = formatTileLocation(row, col);

  if (card.type === 'CandyBucket') {
    if (isFlip) {
      newState = resolveCandyBucket(newState, { ...tile, isFlipped: true }, player.id, true);
      newState = appendToTurnLog(newState, `${player.name} moved to ${location} and flipped Candy Bucket`);
    } else {
      newState = resolveCandyBucket(newState, tile, player.id, false);
      newState = appendToTurnLog(newState, `${player.name} moved to ${location} and collected candy from bucket`);
    }
  } else if (card.type === 'Item') {
    const { state: itemState, itemType } = resolveItemTile(newState, player.id);
    newState = itemState;
    newState = appendToTurnLog(
      newState,
      isFlip
        ? `${player.name} moved to ${location} and flipped ${itemType}`
        : `${player.name} moved to ${location} and drew ${itemType}`
    );
  } else if (card.type === 'Monster') {
    newState = resolveMonster(newState, { ...tile, isFlipped: true }, player.id);
    const monsterName = card.monsterType ?? 'Monster';
    newState = appendToTurnLog(
      newState,
      isFlip
        ? `${player.name} moved to ${location} and flipped ${monsterName}`
        : `${player.name} moved to ${location} and triggered ${monsterName}`
    );
  } else if (card.type === 'Ender') {
    newState = appendToTurnLog(newState, `${player.name} moved to ${location} and flipped Ender`);
    newState = resolveEnder(newState);
    return newState;
  }

  const players = newState.players;
  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(state.currentPlayerIndex, players);
  return {
    ...newState,
    players: updatedPlayers,
    currentPlayerIndex: nextIdx,
    message: `${updatedPlayers[nextIdx].name}'s turn.`,
  };
}

// --- Item plays ---

export function playItem(
  state: GameState,
  item: ItemCard,
  target?: { row?: number; col?: number; playerId?: string }
): GameState {
  if (state.gamePhase !== 'playing') return state;
  const player = state.players[state.currentPlayerIndex];
  if (player.isHome || player.skipNextTurn) return state;
  if (!player.itemCards.some((c) => c.id === item.id)) return state;
  state = clearAffectedState(state);

  const players = [...state.players];
  const playerIdx = state.currentPlayerIndex;
  const newItems = player.itemCards.filter((c) => c.id !== item.id);
  players[playerIdx] = { ...player, itemCards: newItems };

  let newState: GameState = { ...state, players };

  switch (item.type) {
    case 'Shortcut':
      if (target?.row !== undefined && target?.col !== undefined) {
        const tile = newState.board[target.row]?.[target.col];
        if (tile) {
          newState = appendToTurnLog(newState, `${player.name} used Shortcut to ${formatTileLocation(target.row, target.col)}`);
          newState = {
            ...newState,
            players: newState.players.map((p, i) =>
              i === playerIdx ? { ...p, pawnPosition: { row: target.row!, column: target.col! } } : p
            ),
            selectedAction: null,
            message: `${player.name} used Shortcut!`,
          };
        }
      }
      break;

    case 'NaughtyKid':
      if (target?.row !== undefined && target?.col !== undefined) {
        const tile = newState.board[target.row]?.[target.col];
        if (tile?.card?.type === 'CandyBucket' && tile.isFlipped) {
          newState = appendToTurnLog(newState, `${player.name} used Naughty Kid on ${formatTileLocation(target.row, target.col)}`);
          const fromSupply = Math.min(GAME_RULES.naughtyKidBonusToken, newState.candySupply);
          players[playerIdx] = {
            ...players[playerIdx],
            candyTokens: players[playerIdx].candyTokens + tile.candyTokensOnTile + fromSupply,
          };
          newState = {
            ...newState,
            players,
            candySupply: newState.candySupply - fromSupply,
            board: newState.board.map((r, ri) =>
              r.map((t, ci) =>
                ri === target.row && ci === target.col
                  ? { ...t, candyTokensOnTile: 0, isClosed: true }
                  : t
              )
            ),
            selectedAction: null,
            message: `${player.name} used Naughty Kid!`,
          };
        }
      }
      break;

    case 'Flashlight':
      if (target?.row !== undefined && target?.col !== undefined) {
        const tile = newState.board[target.row]?.[target.col];
        if (tile?.card?.type === 'Monster') {
          newState = appendToTurnLog(newState, `${player.name} used Flashlight to remove monster at ${formatTileLocation(target.row, target.col)}`);
          newState = {
            ...newState,
            board: newState.board.map((r, ri) =>
              r.map((t, ci) =>
                ri === target.row && ci === target.col ? { ...t, card: null } : t
              )
            ),
            selectedAction: null,
            message: `${player.name} used Flashlight to remove monster!`,
          };
        } else {
          newState = appendToTurnLog(newState, `${player.name} used Flashlight (peek)`);
          newState = { ...newState, selectedAction: null, message: `${player.name} used Flashlight.` };
        }
      } else {
        newState = appendToTurnLog(newState, `${player.name} used Flashlight (peek)`);
        newState = { ...newState, selectedAction: null, message: `${player.name} used Flashlight (peek).` };
      }
      break;

    default:
      newState = { ...newState, selectedAction: null, message: `${player.name} played ${item.type}.` };
  }

  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(state.currentPlayerIndex, newState.players);
  return { ...newState, players: updatedPlayers, currentPlayerIndex: nextIdx };
}

export function endTurn(state: GameState): GameState {
  if (state.gamePhase !== 'playing') return state;
  state = clearAffectedState(state);
  const player = state.players[state.currentPlayerIndex];
  const withLog = appendToTurnLog(state, `${player.name} ended turn`);
  const players = [...withLog.players];
  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(state.currentPlayerIndex, players);
  return {
    ...withLog,
    players: updatedPlayers,
    currentPlayerIndex: nextIdx,
    selectedAction: null,
    message: `${updatedPlayers[nextIdx].name}'s turn.`,
  };
}

// --- Round end / next neighborhood ---

export function startNextNeighborhood(state: GameState): GameState {
  if (state.gamePhase !== 'roundEnd') return state;
  const roundNumber = state.roundNumber + 1;

  if (roundNumber >= GAME_RULES.totalNeighborhoods) {
    return {
      ...state,
      roundNumber,
      gamePhase: 'gameOver',
      message: 'Game Over! Final scores above.',
    };
  }

  const resetPlayers = state.players.map((p) => ({
    ...p,
    pawnPosition: null,
    isHome: false,
    skipNextTurn: false,
  }));

  const baseState = { ...state, players: resetPlayers, roundNumber };
  return setupNewNeighborhood(baseState);
}

// --- Dev tools ---

export function devRevealAll(state: GameState): GameState {
  const board = state.board.map((row) =>
    row.map((t) => ({ ...t, isFlipped: true }))
  );
  return { ...state, board };
}

export function devAddCandy(state: GameState, playerId: string, amount: number): GameState {
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, candyTokens: p.candyTokens + amount } : p
  );
  return { ...state, players };
}

export function devSkipToMansion(state: GameState): GameState {
  const players = state.players.map((p) => ({
    ...p,
    pawnPosition: { row: 4, column: 0 },
  }));
  return { ...state, players };
}

export function devRestartNeighborhood(state: GameState): GameState {
  return setupNewNeighborhood(state);
}

// --- Scoring ---

export function calculateScore(player: Player): number {
  const candy = player.candyTokens;
  const itemPoints = player.itemCards.reduce((sum, c) => sum + c.points, 0);
  return candy + itemPoints;
}

export function getFinalScores(state: GameState): { playerId: string; name: string; score: number }[] {
  return state.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    score: calculateScore(p),
  })).sort((a, b) => b.score - a.score);
}
