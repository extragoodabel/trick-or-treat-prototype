import type { GameState, Player, Tile, ItemCard } from './types';
import { getTotalCandy } from './types';
import { resolveCostumes, resolveColors, type GameConfig } from './gameConfig';
import { GAME_RULES } from './gameRules';
import {
  createItemCard,
  ITEM_DECK,
} from './cardDefinitions';
import { setupNewNeighborhood, createInitialPlayers } from './setup';
import { formatTileLocation } from './boardLabels';
import { isAdjacent } from './movement';

// --- Game setup ---

export function createNewGame(config: GameConfig): GameState {
  const { playerCount, costumes, colors, controllerTypes, totalRounds } = config;
  const resolvedCostumes = resolveCostumes(costumes.slice(0, playerCount));
  const playerColors = resolveColors(colors.slice(0, playerCount));
  const players = createInitialPlayers(playerCount, resolvedCostumes, controllerTypes);
  const baseState: GameState = {
    players,
    currentPlayerIndex: 0,
    playDirection: 1,
    board: [],
    houseDeck: [],
    mansionDeck: [],
    candySupply: GAME_RULES.initialCandySupply,
    roundNumber: 0,
    totalRounds,
    playerColors,
    gamePhase: 'playing',
    selectedAction: null,
    pendingItemPlay: null,
    message: `${players[0].name}'s turn.`,
    turnLog: [],
  };
  return setupNewNeighborhood(baseState);
}

/** Update tile occupancy order when a player moves from one tile to another. */
function updateTileOccupancy(
  state: GameState,
  from: { row: number; col: number } | null,
  to: { row: number; col: number },
  playerId: string
): GameState {
  const order = { ...(state.tileOccupancyOrder ?? {}) };
  const fromKey = from ? `${from.row},${from.col}` : null;
  const toKey = `${to.row},${to.col}`;
  if (fromKey) {
    const fromList = (order[fromKey] ?? []).filter((id) => id !== playerId);
    if (fromList.length > 0) order[fromKey] = fromList;
    else delete order[fromKey];
  }
  const toList = order[toKey] ?? [];
  if (!toList.includes(playerId)) {
    order[toKey] = [...toList, playerId];
  }
  return { ...state, tileOccupancyOrder: order };
}

/** Append a message to the turn log. Used by UI when logging bot/human actions. */
export function appendToTurnLog(state: GameState, message: string): GameState {
  return {
    ...state,
    turnLog: [...state.turnLog, message],
  };
}

/** Select starting position (first row only). Multiple players may choose same tile. Starting tile flips immediately and resolves. */
export function selectStartingPosition(
  state: GameState,
  row: number,
  col: number
): GameState {
  if (state.gamePhase !== 'chooseStartingPosition') return state;
  if (row !== 0) return state; // Must be first row

  const tile = state.board[row]?.[col];
  if (!tile || tile.isClosed) return state;

  const player = state.players[state.currentPlayerIndex];
  const players = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, pawnPosition: { row, column: col } } : p
  );
  let nextState: GameState = { ...state, players };
  nextState = updateTileOccupancy(nextState, null, { row, col }, player.id);

  // Flip starting tile immediately and resolve
  const card = tile.card;
  if (card && !tile.isFlipped) {
    nextState = {
      ...nextState,
      board: nextState.board.map((r, ri) =>
        r.map((t, ci) =>
          ri === row && ci === col ? { ...t, isFlipped: true } : t
        )
      ),
    };
    const flippedTile = { ...tile, isFlipped: true };
    if (card.type === 'CandyBucket') {
      nextState = resolveCandyBucket(nextState, flippedTile, player.id, true);
    } else if (card.type === 'Item' || card.type === 'CandyItem') {
      const { state: itemState, itemType } = resolveItemTile(nextState, player.id);
      nextState = itemState;
      nextState = {
        ...nextState,
        board: nextState.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === row && ci === col ? { ...t, itemCollected: true } : t
          )
        ),
      };
      nextState = appendToTurnLog(nextState, `${player.name} flipped ${itemType} at ${formatTileLocation(row, col)}`);
    } else if (card.type === 'Monster') {
      nextState = resolveMonster(nextState, flippedTile, player.id);
      nextState = appendToTurnLog(nextState, `${player.name} flipped ${card.monsterType ?? 'Monster'} at ${formatTileLocation(row, col)}`);
      if (nextState.gamePhase === 'roundEnd') {
        return nextState;
      }
    } else if (card.type === 'KingSizeBar') {
      const { state: ksState } = resolveKingSizeBar(nextState, player.id);
      nextState = ksState;
      nextState = {
        ...nextState,
        board: nextState.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === row && ci === col ? { ...t, itemCollected: true } : t
          )
        ),
      };
      nextState = appendToTurnLog(nextState, `${player.name} flipped King Size Bar at ${formatTileLocation(row, col)}`);
    } else if (card.type === 'OldManJohnson') {
      nextState = resolveOldManJohnson(nextState);
      nextState = appendToTurnLog(nextState, `${player.name} flipped Old Man Johnson at ${formatTileLocation(row, col)}`);
      return nextState;
    }
  }

  const nextIndex = state.currentPlayerIndex + 1;
  const allChosen = nextIndex >= players.length;

  return {
    ...nextState,
    currentPlayerIndex: allChosen ? 0 : nextIndex,
    gamePhase: allChosen ? 'playing' : 'chooseStartingPosition',
    message: allChosen
      ? `${nextState.players[0].name}'s turn.`
      : `${nextState.players[nextIndex].name}, choose your starting house (first row)`,
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
      roundCandy: players[playerIdx].roundCandy + flipperCollects,
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
        roundCandy: players[playerIdx].roundCandy + collect,
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
  Flashlight: 'Flashlight',
  Binoculars: 'Binoculars',
  Shortcut: 'Shortcut',
  IntrusiveThoughts: 'Intrusive Thoughts',
  Toothbrush: 'Toothbrush',
  Pennies: 'Pennies',
  RottenApple: 'Rotten Apple',
  KingSizeBar: 'King Size Bar',
  CandyItem: 'Candy Item',
};

function resolveItemTile(
  state: GameState,
  playerId: string,
  tileCardType?: 'Item' | 'CandyItem'
): { state: GameState; itemType: string; itemTypeRaw: string } {
  const players = [...state.players];
  const playerIdx = players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return { state, itemType: 'Item', itemTypeRaw: 'Item' };

  const itemTypeRaw =
    tileCardType === 'CandyItem'
      ? 'CandyItem'
      : (ITEM_DECK[Math.floor(Math.random() * ITEM_DECK.length)] as string);
  const newCard = createItemCard(itemTypeRaw as import('./types').ItemCardType);
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
    itemType: ITEM_TYPE_LABELS[itemTypeRaw] ?? itemTypeRaw,
    itemTypeRaw,
  };
}

function resolveKingSizeBar(state: GameState, playerId: string): { state: GameState } {
  const players = [...state.players];
  const playerIdx = players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1) return { state };
  const newCard = createItemCard('KingSizeBar');
  players[playerIdx] = {
    ...players[playerIdx],
    itemCards: [...players[playerIdx].itemCards, newCard],
  };
  return {
    state: { ...state, players, message: `${players[playerIdx].name} found a King Size Bar!` },
  };
}

function resolveOldManJohnson(state: GameState): GameState {
  const players = state.players.map((p) => {
    if (p.isHome) return p;
    return { ...p, roundCandy: 0 };
  });
  return {
    ...state,
    players,
    gamePhase: 'roundEnd',
    message: 'Old Man Johnson! All players still out lost their round candy.',
    lastOldManJohnsonReveal: true,
  };
}

function isImmune(costume: string, monsterType?: string): boolean {
  return costume === monsterType;
}

/** Players still on the board (not home). Safe from targeting by effects. */
function playersOnBoard(players: Player[]): Player[] {
  return players.filter((p) => !p.isHome);
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

  const withAffected = (
    s: GameState,
    ids: string[],
    desc: string,
    extra?: Partial<GameState>
  ) => ({
    ...s,
    lastAffectedPlayerIds: ids,
    lastActionDescription: desc,
    ...extra,
  });

  switch (card.monsterType) {
    case 'Ghost': {
      const lost = GAME_RULES.ghostLoseTokens;
      players[playerIdx] = {
        ...player,
        roundCandy: Math.max(0, player.roundCandy - lost),
      };
      return withAffected(
        { ...state, players, message: `${player.name} lost 1 candy to Ghost!` },
        [player.id],
        'lost 1 candy to Ghost',
        {
          lastConsequenceMessage: `${player.name} lost 1 candy to Ghost`,
          lastCandyDeltas: [{ playerIndex: playerIdx, delta: -lost }],
        }
      );
    }

    case 'Zombie': {
      const active = playersOnBoard(players);
      if (active.length === 1) {
        players[playerIdx] = { ...player, isHome: true };
        const bankedPlayers = players.map((p) => ({
          ...p,
          bankedCandy: p.bankedCandy + p.roundCandy,
          roundCandy: 0,
        }));
        return {
          ...state,
          players: bankedPlayers,
          gamePhase: 'roundEnd',
          message: 'Zombie encountered! With no other players left outside, you hurry home.',
          lastConsequenceMessage: 'Zombie encountered! With no other players left outside, you hurry home.',
        };
      }
      players[playerIdx] = { ...player, skipNextTurn: true };
      return withAffected(
        { ...state, players, message: `${player.name} skips next turn (Zombie)!` },
        [player.id],
        'skips next turn (Zombie)',
        { lastConsequenceMessage: `${player.name} skips next turn (Zombie)` }
      );
    }

    case 'Witch': {
      const active = playersOnBoard(players);
      const other = active.find((p) => p.id !== playerId);
      if (other) {
        const otherIdx = players.findIndex((p) => p.id === other.id);
        const temp = players[playerIdx].itemCards;
        players[playerIdx] = { ...player, itemCards: players[otherIdx].itemCards };
        players[otherIdx] = { ...players[otherIdx], itemCards: temp };
        return withAffected(
          { ...state, players, message: `${player.name} swapped hands with ${other.name} (Witch)!` },
          [player.id, other.id],
          'swapped hands (Witch)',
          {
            lastConsequenceMessage: `${player.name} swapped hands with ${other.name} (Witch)`,
            lastWitchSwap: { fromPlayerIndex: playerIdx, toPlayerIndex: otherIdx },
          }
        );
      }
      return { ...state, players, message: `${player.name} triggered Witch (no other players on board to swap with)!` };
    }

    case 'Skeleton': {
      players[playerIdx] = { ...player, handRevealed: true };
      return withAffected(
        { ...state, players, message: `${player.name} revealed hand (Skeleton)!` },
        [player.id],
        'revealed hand (Skeleton)',
        { lastConsequenceMessage: `${player.name} revealed hand (Skeleton)` }
      );
    }

    case 'Werewolf': {
      return withAffected(
        { ...state, players, playDirection: (state.playDirection ?? 1) * -1, message: `${player.name} reversed play direction (Werewolf)!` },
        [player.id],
        'reversed play direction (Werewolf)',
        { lastConsequenceMessage: `${player.name} reversed play direction (Werewolf)` }
      );
    }

    case 'Goblin': {
      const active = playersOnBoard(players).filter((p) => p.id !== playerId);
      const sorted = [...active].sort(
        (a, b) => a.itemCards.length - b.itemCards.length
      );
      const fewest = sorted[0];
      if (fewest && player.itemCards.length > 0) {
        const takeIdx = Math.floor(Math.random() * player.itemCards.length);
        const taken = player.itemCards[takeIdx];
        const newLanding = player.itemCards.filter((_, i) => i !== takeIdx);
        players[playerIdx] = { ...player, itemCards: newLanding };
        const fewestIdx = players.findIndex((p) => p.id === fewest.id);
        players[fewestIdx] = {
          ...fewest,
          itemCards: [...fewest.itemCards, taken],
        };
        return withAffected(
          { ...state, players, message: `${fewest.name} took a card from ${player.name} (Goblin)!` },
          [fewest.id, player.id],
          `${fewest.name} took card from ${player.name} (Goblin)`,
          {
            lastConsequenceMessage: `${fewest.name} took a card from ${player.name} (Goblin)`,
            lastGoblinTheft: {
              fromPlayerIndex: playerIdx,
              toPlayerIndex: fewestIdx,
              itemType: taken.type,
            },
          }
        );
      }
      return { ...state, players, message: `${player.name} triggered Goblin (no other players on board with cards, or you have no cards)!` };
    }

    case 'Vampire': {
      if (player.roundCandy < 1) {
        return { ...state, message: `${player.name} has no candy to give (Vampire)!` };
      }
      const totals = players.map((p, i) => ({ idx: i, total: getTotalCandy(p) }));
      const minTotal = Math.min(...totals.map((t) => t.total));
      const leastCandy = totals.filter((t) => t.total === minTotal && t.idx !== playerIdx);
      if (leastCandy.length === 0) {
        return { ...state, message: `${player.name} already has the least candy (Vampire)!` };
      }
      const recipient = leastCandy[Math.floor(Math.random() * leastCandy.length)];
      const recipientIdx = recipient!.idx;
      players[playerIdx] = { ...player, roundCandy: player.roundCandy - 1 };
      players[recipientIdx] = {
        ...players[recipientIdx],
        roundCandy: players[recipientIdx].roundCandy + 1,
      };
      const recipientName = players[recipientIdx].name;
      return withAffected(
        { ...state, players, message: `${player.name} gave 1 candy to ${recipientName} (Vampire)!` },
        [player.id, players[recipientIdx].id],
        `gave 1 candy to ${recipientName} (Vampire)`,
        {
          lastConsequenceMessage: `${player.name} gave 1 candy to ${recipientName} (Vampire)`,
          lastCandyDeltas: [
            { playerIndex: playerIdx, delta: -1 },
            { playerIndex: recipientIdx, delta: 1 },
          ],
        }
      );
    }

    default:
      return state;
  }
}

// --- Actions ---

function clearAffectedState(s: GameState): GameState {
  return {
    ...s,
    lastAffectedPlayerIds: undefined,
    lastActionDescription: undefined,
    lastConsequenceMessage: undefined,
    lastWitchSwap: undefined,
    lastGoblinTheft: undefined,
    lastCandyDeltas: undefined,
    lastMoveForAnimation: undefined,
    lastRevealedItem: undefined,
    lastRevealedCandy: undefined,
  };
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
  players[state.currentPlayerIndex] = {
    ...player,
    isHome: true,
    bankedCandy: player.bankedCandy + player.roundCandy,
    roundCandy: 0,
  };
  const { nextIndex: nextIdx, updatedPlayers: updatedPlayers } = advanceToNextPlayer(state, state.currentPlayerIndex, players);
  const withLog = appendToTurnLog(state, `${player.name} went home`);
  const allHome = updatedPlayers.every((p) => p.isHome);
  if (allHome) {
    const bankedPlayers = updatedPlayers.map((p) =>
      p.isHome ? p : { ...p, bankedCandy: p.bankedCandy + p.roundCandy, roundCandy: 0 }
    );
    return {
      ...withLog,
      players: bankedPlayers,
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
  state: GameState,
  current: number,
  players: Player[]
): { nextIndex: number; updatedPlayers: Player[] } {
  const active = players.filter((p) => !p.isHome);
  if (active.length === 0) return { nextIndex: current, updatedPlayers: players };
  if (active.length === 1) {
    const soleActiveIdx = players.findIndex((p) => !p.isHome);
    return { nextIndex: soleActiveIdx, updatedPlayers: players };
  }

  const dir = state.playDirection ?? 1;
  let next = (current + dir + players.length) % players.length;
  while (players[next].isHome) {
    next = (next + dir + players.length) % players.length;
  }

  if (players[next].skipNextTurn) {
    const updated = players.map((p, i) =>
      i === next ? { ...p, skipNextTurn: false } : p
    );
    const result = advanceToNextPlayer(state, next, updated);
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

  // Mansion Row (row 4) is always reachable when orthogonally adjacent - no special restriction
  const pos = player.pawnPosition;
  if (pos === null) return state;

  const isSameTile = pos.row === row && pos.column === col;
  const isAdjacentTile = isAdjacent(pos.row, pos.column, row, col);

  // Allow: adjacent move (including diagonals), OR flip of current tile (without moving) when face-down
  if (!isAdjacentTile && !(isSameTile && !tile.isFlipped)) {
    return {
      ...state,
      message: 'Movement must be to an adjacent house (including diagonals).',
    };
  }

  const isFlip = !tile.isFlipped;

  // Only update pawn position when actually moving (not when flipping current tile)
  const playersUpdate =
    isSameTile && isFlip
      ? state.players // Stay on same tile
      : state.players.map((p, i) =>
          i === state.currentPlayerIndex ? { ...p, pawnPosition: { row, column: col } } : p
        );

  let newState: GameState = {
    ...state,
    board: isFlip
      ? state.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === row && ci === col ? { ...t, isFlipped: true } : t
          )
        )
      : state.board,
    players: playersUpdate,
    selectedAction: null,
  };
  if (!(isSameTile && isFlip)) {
    newState = updateTileOccupancy(
      newState,
      { row: pos.row, col: pos.column },
      { row, col },
      player.id
    );
  }

  const card = tile.card;
  if (!card) return newState;

  const location = formatTileLocation(row, col);

  let candyCollected = 0;
  if (card.type === 'CandyBucket') {
    const candyBefore = newState.players[state.currentPlayerIndex].roundCandy;
    if (isFlip) {
      newState = resolveCandyBucket(newState, { ...tile, isFlipped: true }, player.id, true);
      newState = appendToTurnLog(newState, isSameTile ? `${player.name} flipped Candy Bucket at ${location}` : `${player.name} moved to ${location} and flipped Candy Bucket`);
    } else {
      newState = resolveCandyBucket(newState, tile, player.id, false);
      newState = appendToTurnLog(newState, `${player.name} moved to ${location} and collected candy from bucket`);
    }
    candyCollected = newState.players[state.currentPlayerIndex].roundCandy - candyBefore;
  } else if (card.type === 'Item' || card.type === 'CandyItem') {
    const alreadyUsed = tile.itemCollected === true;
    if (alreadyUsed) {
      newState = appendToTurnLog(newState, `${player.name} moved to ${location} (empty gift house)`);
    } else {
      const { state: itemState, itemType, itemTypeRaw } = resolveItemTile(newState, player.id, card.type);
      newState = itemState;
      newState = appendToTurnLog(
        newState,
        isFlip
          ? (isSameTile ? `${player.name} flipped ${itemType} at ${location}` : `${player.name} moved to ${location} and flipped ${itemType}`)
          : `${player.name} moved to ${location} and drew ${itemType}`
      );
      if (isFlip) {
        (newState as GameState & { _itemType?: string; _itemTypeRaw?: string })._itemType = itemType;
        (newState as GameState & { _itemType?: string; _itemTypeRaw?: string })._itemTypeRaw = itemTypeRaw;
      }
      newState = {
        ...newState,
        board: newState.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === row && ci === col ? { ...t, itemCollected: true } : t
          )
        ),
      };
    }
  } else if (card.type === 'Monster') {
    newState = resolveMonster(newState, { ...tile, isFlipped: true }, player.id);
    const monsterName = card.monsterType ?? 'Monster';
    newState = appendToTurnLog(
      newState,
      isFlip
        ? (isSameTile ? `${player.name} flipped ${monsterName} at ${location}` : `${player.name} moved to ${location} and flipped ${monsterName}`)
        : `${player.name} moved to ${location} and triggered ${monsterName}`
    );
    if (newState.gamePhase === 'roundEnd') {
      return newState;
    }
  } else if (card.type === 'KingSizeBar') {
    const alreadyCollected = tile.itemCollected === true;
    if (alreadyCollected) {
      newState = appendToTurnLog(newState, `${player.name} moved to ${location} (King Size Bar already claimed)`);
    } else {
      const { state: ksState } = resolveKingSizeBar(newState, player.id);
      newState = ksState;
      newState = {
        ...newState,
        board: newState.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === row && ci === col ? { ...t, itemCollected: true } : t
          )
        ),
      };
      newState = appendToTurnLog(newState, `${player.name} found King Size Bar at ${location}`);
    }
  } else if (card.type === 'OldManJohnson') {
    newState = appendToTurnLog(newState, `${player.name} flipped Old Man Johnson at ${location}`);
    newState = resolveOldManJohnson(newState);
    return newState;
  }

  const players = newState.players;
  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(newState, state.currentPlayerIndex, players);

  const revealedItemType = (newState as GameState & { _itemType?: string })._itemType;
  const revealedItemTypeRaw = (newState as GameState & { _itemTypeRaw?: string })._itemTypeRaw;
  const { _itemType: _unused, _itemTypeRaw: _unusedRaw, ...cleanState } = newState as GameState & { _itemType?: string; _itemTypeRaw?: string };

  // Set movement animation (only for actual moves, not flip-in-place)
  let finalState: GameState = {
    ...cleanState,
    players: updatedPlayers,
    currentPlayerIndex: nextIdx,
    message: `${updatedPlayers[nextIdx].name}'s turn.`,
  };
  if (!(isSameTile && isFlip)) {
    finalState = { ...finalState, lastMoveForAnimation: { from: { row: pos.row, col: pos.column }, to: { row, col }, playerIndex: state.currentPlayerIndex } };
  }
  if ((card.type === 'Item' || card.type === 'CandyItem') && isFlip && revealedItemType && revealedItemTypeRaw) {
    finalState = { ...finalState, lastRevealedItem: { row, col, itemType: revealedItemTypeRaw, playerIndex: state.currentPlayerIndex } };
  }
  if (candyCollected > 0) {
    finalState = { ...finalState, lastRevealedCandy: { row, col, playerIndex: state.currentPlayerIndex, amount: candyCollected } };
  }

  return finalState;
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
  if (target?.playerId) {
    const targetPlayer = state.players.find((p) => p.id === target.playerId);
    if (!targetPlayer || targetPlayer.isHome) return state;
  }
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
        const isMansionRow = target.row === 4;
        if (tile && !isMansionRow) {
          newState = appendToTurnLog(newState, `${player.name} used Shortcut to ${formatTileLocation(target.row, target.col)}`);
          newState = {
            ...newState,
            players: newState.players.map((p, i) =>
              i === playerIdx ? { ...p, pawnPosition: { row: target.row!, column: target.col! } } : p
            ),
            selectedAction: null,
            message: `${player.name} used Shortcut!`,
          };
          const from = player.pawnPosition;
          if (from) {
            newState = updateTileOccupancy(
              newState,
              { row: from.row, col: from.column },
              { row: target.row!, col: target.col! },
              player.id
            );
          }
        }
      }
      break;

    case 'IntrusiveThoughts':
      if (target?.row !== undefined && target?.col !== undefined) {
        const tile = newState.board[target.row]?.[target.col];
        if (tile?.card?.type === 'CandyBucket' && tile.isFlipped) {
          newState = appendToTurnLog(newState, `${player.name} used Intrusive Thoughts on ${formatTileLocation(target.row, target.col)}`);
          const fromSupply = Math.min(GAME_RULES.intrusiveThoughtsBonusTokens, newState.candySupply);
          players[playerIdx] = {
            ...players[playerIdx],
            roundCandy: players[playerIdx].roundCandy + tile.candyTokensOnTile + fromSupply,
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
            message: `${player.name} used Intrusive Thoughts!`,
          };
        }
      }
      break;

    case 'Binoculars':
      if (target?.row !== undefined && target?.col !== undefined) {
        const tile = newState.board[target.row]?.[target.col];
        if (tile && !tile.isFlipped) {
          newState = appendToTurnLog(newState, `${player.name} used Binoculars to peek at ${formatTileLocation(target.row, target.col)}`);
          newState = {
            ...newState,
            binocularsPeek: target.row !== undefined && target.col !== undefined ? [{ row: target.row, col: target.col }] : undefined,
            selectedAction: null,
            message: `${player.name} used Binoculars!`,
          };
        }
      }
      break;

    case 'Flashlight':
      if (target?.row !== undefined && target?.col !== undefined) {
        const tile = newState.board[target.row]?.[target.col];
        if (tile && tile.card && !tile.isClosed) {
          const location = formatTileLocation(target.row, target.col);
          const card = tile.card;
          let revealMessage: string;
          if (card.type === 'Monster') {
            const monsterName = card.monsterType ?? 'Monster';
            revealMessage = `${monsterName} revealed and chased away.`;
          } else if (card.type === 'CandyBucket') {
            revealMessage = 'Candy Bucket revealed and collected.';
          } else if (card.type === 'Item' || card.type === 'CandyItem') {
            revealMessage = 'Item revealed and drawn.';
          } else if (card.type === 'KingSizeBar') {
            revealMessage = 'King Size Bar revealed and collected.';
          } else if (card.type === 'OldManJohnson') {
            revealMessage = 'Old Man Johnson revealed and triggered.';
          } else {
            revealMessage = 'Revealed.';
          }
          const pawnPos = player.pawnPosition;
          const fromRow = pawnPos?.row ?? 0;
          const fromCol = pawnPos?.column ?? 0;
          newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location}`);
          newState = {
            ...newState,
            selectedAction: null,
            message: `${player.name} used a flashlight on ${location}.`,
            flashlightReveal: {
              row: target.row,
              col: target.col,
              fromRow,
              fromCol,
              card,
              playerName: player.name,
              location,
              revealMessage,
              phase: 'beam',
            },
          };
        } else {
          newState = appendToTurnLog(newState, `${player.name} used Flashlight (no valid target)`);
          newState = { ...newState, selectedAction: null, message: `${player.name} used Flashlight.` };
        }
      } else {
        newState = appendToTurnLog(newState, `${player.name} used Flashlight (no target)`);
        newState = { ...newState, selectedAction: null, message: `${player.name} used Flashlight.` };
      }
      break;

    default:
      newState = { ...newState, selectedAction: null, message: `${player.name} played ${item.type}.` };
  }

  if (newState.flashlightReveal) {
    return newState;
  }

  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(state, state.currentPlayerIndex, newState.players);
  return { ...newState, players: updatedPlayers, currentPlayerIndex: nextIdx };
}

/**
 * Resolve flashlight reveal after the brief display phase.
 * Triggers the tile as if the player landed on it, then marks it spent (spider web).
 */
export function resolveFlashlightReveal(state: GameState): GameState {
  const fr = state.flashlightReveal;
  if (!fr) return state;

  const tile = state.board[fr.row]?.[fr.col];
  if (!tile || !tile.card) return clearFlashlightAndAdvance(state);

  const player = state.players[state.currentPlayerIndex];
  const playerIdx = state.currentPlayerIndex;
  const card = tile.card;
  const location = fr.location;

  let newState: GameState = { ...state };
  newState = clearAffectedState(newState);

  const makeSpent = (s: GameState, extraTileProps?: Partial<Tile>): GameState => ({
    ...s,
    board: s.board.map((r, ri) =>
      r.map((t, ci) =>
        ri === fr.row && ci === fr.col
          ? { ...t, isFlipped: true, isSpent: true, ...extraTileProps }
          : t
      )
    ),
  });

  if (card.type === 'CandyBucket') {
    const flippedTile = { ...tile, isFlipped: true };
    newState = resolveCandyBucket(newState, flippedTile, player.id, true);
    newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — Candy Bucket revealed and collected.`);
    const candyCollected = newState.players[playerIdx].roundCandy - player.roundCandy;
    newState = makeSpent(newState, { isClosed: true });
    if (candyCollected > 0) {
      newState = {
        ...newState,
        lastRevealedCandy: { row: fr.row, col: fr.col, playerIndex: playerIdx, amount: candyCollected },
        lastConsequenceMessage: `${player.name} found ${candyCollected} candy!`,
      };
    }
  } else if (card.type === 'Item' || card.type === 'CandyItem') {
    if (tile.itemCollected) {
      newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — empty gift house.`);
      newState = makeSpent(newState, { itemCollected: true });
    } else {
      const { state: itemState, itemType, itemTypeRaw } = resolveItemTile(newState, player.id, card.type);
      newState = itemState;
      newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — ${itemType} revealed and drawn.`);
      newState = makeSpent(newState, { itemCollected: true });
      newState = {
        ...newState,
        lastRevealedItem: { row: fr.row, col: fr.col, itemType: itemTypeRaw, playerIndex: playerIdx },
        lastConsequenceMessage: `Flashlight revealed a ${itemType.toLowerCase()}.`,
      };
    }
  } else if (card.type === 'Monster') {
    const monsterName = card.monsterType ?? 'Monster';
    if (card.monsterType === 'Vampire') {
      newState = resolveMonster(newState, { ...tile, isFlipped: true }, player.id);
      newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — Vampire revealed and effect triggered.`);
      newState = {
        ...newState,
        board: newState.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === fr.row && ci === fr.col ? { ...t, card: null, isFlipped: true, isSpent: true } : t
          )
        ),
      };
    } else {
      newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — ${monsterName} revealed and chased away.`);
      newState = {
        ...newState,
        lastConsequenceMessage: `${monsterName} revealed and chased away.`,
        board: newState.board.map((r, ri) =>
          r.map((t, ci) =>
            ri === fr.row && ci === fr.col ? { ...t, card: null, isFlipped: true, isSpent: true } : t
          )
        ),
      };
    }
  } else if (card.type === 'KingSizeBar') {
    const alreadyCollected = tile.itemCollected === true;
    if (alreadyCollected) {
      newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — King Size Bar already claimed.`);
      newState = makeSpent(newState, { itemCollected: true });
    } else {
      const { state: ksState } = resolveKingSizeBar(newState, player.id);
      newState = ksState;
      newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — King Size Bar revealed and collected.`);
      newState = makeSpent(newState, { itemCollected: true });
    }
  } else if (card.type === 'OldManJohnson') {
    newState = appendToTurnLog(newState, `${player.name} used Flashlight on ${location} — Old Man Johnson revealed and triggered.`);
    newState = resolveOldManJohnson(newState);
    return clearFlashlightFromState(newState);
  } else {
    newState = makeSpent(newState);
  }

  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(state, state.currentPlayerIndex, newState.players);
  return {
    ...clearFlashlightFromState(newState),
    players: updatedPlayers,
    currentPlayerIndex: nextIdx,
    message: `${updatedPlayers[nextIdx].name}'s turn.`,
  };
}

function clearFlashlightFromState(s: GameState): GameState {
  const { flashlightReveal, ...rest } = s;
  return rest as GameState;
}

function clearFlashlightAndAdvance(state: GameState): GameState {
  const cleared = clearFlashlightFromState(state);
  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(state, state.currentPlayerIndex, cleared.players);
  return {
    ...cleared,
    players: updatedPlayers,
    currentPlayerIndex: nextIdx,
    message: `${updatedPlayers[nextIdx].name}'s turn.`,
  };
}

export function endTurn(state: GameState): GameState {
  if (state.gamePhase !== 'playing') return state;
  state = clearAffectedState(state);
  const player = state.players[state.currentPlayerIndex];
  const withLog = appendToTurnLog(state, `${player.name} ended turn`);
  const players = [...withLog.players];
  const { nextIndex: nextIdx, updatedPlayers } = advanceToNextPlayer(state, state.currentPlayerIndex, players);
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

  if (roundNumber >= state.totalRounds) {
    const { lastOldManJohnsonReveal, ...rest } = state;
    return {
      ...rest,
      roundNumber,
      gamePhase: 'gameOver',
      message: 'Game Over! Final scores above.',
    };
  }

  const bankedPlayers = state.players.map((p) => ({
    ...p,
    bankedCandy: p.bankedCandy + p.roundCandy,
    roundCandy: 0,
    pawnPosition: null,
    isHome: false,
    skipNextTurn: false,
    handRevealed: false,
  }));
  const { lastOldManJohnsonReveal, ...stateWithoutOMJ } = state;
  const baseState = { ...stateWithoutOMJ, players: bankedPlayers, roundNumber };
  return setupNewNeighborhood(baseState);
}

// --- Dev tools ---

export function devRevealAll(state: GameState): GameState {
  const board = state.board.map((row) =>
    row.map((t) => ({ ...t, isFlipped: true }))
  );
  return { ...state, board };
}

export function devHideAllTiles(state: GameState): GameState {
  const board = state.board.map((row) =>
    row.map((t) => ({ ...t, isFlipped: false }))
  );
  return { ...state, board };
}

export function devAddCandy(state: GameState, playerId: string, amount: number): GameState {
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, roundCandy: p.roundCandy + amount } : p
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
  const banked = Number(player.bankedCandy) || 0;
  const round = Number(player.roundCandy) || 0;
  const candy = banked + round;
  const itemPoints = (player.itemCards ?? []).reduce(
    (sum, c) => sum + (Number(c.points) || 0),
    0
  );
  const total = candy + itemPoints;
  return Number.isFinite(total) ? total : 0;
}

export function getFinalScores(state: GameState): { playerId: string; name: string; score: number }[] {
  return state.players.map((p) => {
    const score = calculateScore(p);
    return {
      playerId: p.id,
      name: p.name,
      score: Number.isFinite(score) ? score : 0,
    };
  }).sort((a, b) => b.score - a.score);
}
