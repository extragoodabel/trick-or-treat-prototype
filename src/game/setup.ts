import type { GameState, Player, Tile, TileCard, ControllerType } from './types';
import { GAME_RULES } from './gameRules';
import {
  getHouseDeckForRound,
  getMansionDeckForRound,
  shuffle,
} from './cardDefinitions';

export function createInitialPlayers(
  count: number,
  costumes?: string[],
  controllerTypes?: ControllerType[]
): Player[] {
  const costumeTypes = [
    'Ghost',
    'Zombie',
    'Witch',
    'Skeleton',
    'Werewolf',
    'Goblin',
    'Vampire',
  ] as const;
  const players: Player[] = [];
  for (let i = 0; i < count; i++) {
    const costume =
      costumes?.[i] && costumeTypes.includes(costumes[i] as (typeof costumeTypes)[number])
        ? (costumes[i] as (typeof costumeTypes)[number])
        : costumeTypes[i % costumeTypes.length];
    const ctrl = controllerTypes?.[i] ?? 'human';
    const name = ctrl === 'bot' ? `${costume} Bot` : `Player ${i + 1}`;
    players.push({
      id: `player-${i}`,
      name,
      costume,
      controllerType: ctrl,
      pawnPosition: null,
      bankedCandy: 0,
      roundCandy: 0,
      itemCards: [],
      isHome: false,
      skipNextTurn: false,
      handRevealed: false,
    });
  }
  return players;
}

function createEmptyBoard(): Tile[][] {
  const board: Tile[][] = [];
  for (let r = 0; r < GAME_RULES.boardRows; r++) {
    const row: Tile[] = [];
    for (let c = 0; c < GAME_RULES.boardCols; c++) {
      row.push({
        row: r,
        column: c,
        card: null,
        isFlipped: false,
        candyTokensOnTile: 0,
        isClosed: false,
        bucketVisits: {},
      });
    }
    board.push(row);
  }
  return board;
}

export function generateBoard(
  roundNumber: number
): { board: Tile[][]; houseDeck: TileCard[]; mansionDeck: TileCard[] } {
  const board = createEmptyBoard();
  const houseDeck = shuffle(getHouseDeckForRound(roundNumber));
  const mansionPool = getMansionDeckForRound(roundNumber);
  const mansionDeck = shuffle(mansionPool);

  let houseIndex = 0;
  for (let r = 0; r < GAME_RULES.houseDeckRows; r++) {
    for (let c = 0; c < GAME_RULES.boardCols; c++) {
      if (houseIndex < houseDeck.length) {
        board[r][c].card = houseDeck[houseIndex];
        houseIndex++;
      }
    }
  }

  // Row 5: 4 random mansion + 1 Ender
  const mansionDraw = mansionDeck
    .filter((c) => c.type !== 'Ender')
    .slice(0, GAME_RULES.mansionCardsCount);
  const ender = mansionDeck.find((c) => c.type === 'Ender')!;
  const row5Cards = shuffle([...mansionDraw, ender]);
  for (let c = 0; c < GAME_RULES.boardCols; c++) {
    board[4][c].card = row5Cards[c];
  }

  // Neighborhood 3 only: House on the Hill beyond Mansion Row (row 5, center)
  if (roundNumber === 2) {
    const hillRow: Tile[] = [];
    for (let c = 0; c < GAME_RULES.boardCols; c++) {
      const isHillHouse = c === 2;
      hillRow.push({
        row: 5,
        column: c,
        card: isHillHouse ? { type: 'HouseOnHill' } : null,
        isFlipped: false,
        candyTokensOnTile: 0,
        isClosed: !isHillHouse, // Only center tile is reachable
        bucketVisits: {},
      });
    }
    board.push(hillRow);
  }

  return {
    board,
    houseDeck: houseDeck.slice(houseIndex),
    mansionDeck: mansionDeck.filter((c) => !row5Cards.includes(c)),
  };
}

export function setupNewNeighborhood(
  state: GameState,
  devRevealAll?: boolean,
  devSkipToMansion?: boolean
): GameState {
  const { board, houseDeck, mansionDeck } = generateBoard(state.roundNumber);

  const players = state.players.map((p) => ({
    ...p,
    pawnPosition: devSkipToMansion ? { row: 4, column: 0 } : null,
    roundCandy: 0,
    isHome: false,
    skipNextTurn: false,
  }));

  const gamePhase = devSkipToMansion ? 'playing' : 'chooseStartingPosition';
  const tileOccupancyOrder: Record<string, string[]> = devSkipToMansion
    ? { '4,0': players.map((p) => p.id) }
    : {};
  const message =
    gamePhase === 'chooseStartingPosition'
      ? `${players[0].name}, choose your starting house (first row)`
      : `Neighborhood ${state.roundNumber + 1} - ${players[0].name}'s turn`;

  if (devRevealAll) {
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[r].length; c++) {
        board[r][c].isFlipped = true;
      }
    }
  }

  return {
    ...state,
    players,
    board,
    houseDeck,
    mansionDeck,
    candySupply: GAME_RULES.initialCandySupply,
    currentPlayerIndex: 0,
    gamePhase,
    selectedAction: null,
    pendingItemPlay: null,
    message,
    lastAffectedPlayerIds: undefined,
    lastActionDescription: undefined,
    tileOccupancyOrder,
  };
}
