// Monster subtypes
export type MonsterType =
  | 'Ghost'
  | 'Zombie'
  | 'Witch'
  | 'Skeleton'
  | 'Werewolf'
  | 'Goblin';

// Card types for tiles
export type TileCardType = 'CandyBucket' | 'Item' | 'Monster' | 'Ender';

// Base card for tiles
export interface TileCard {
  type: TileCardType;
  monsterType?: MonsterType;
}

// Item card types
export type ItemCardType =
  | 'FullSizeBar'
  | 'Flashlight'
  | 'Shortcut'
  | 'NaughtyKid'
  | 'Toothbrush'
  | 'Pennies'
  | 'RottenApple';

export interface ItemCard {
  id: string;
  type: ItemCardType;
  points: number; // Can be negative
}

// Tile representation
export interface Tile {
  row: number;
  column: number;
  card: TileCard | null;
  isFlipped: boolean;
  candyTokensOnTile: number;
  isClosed: boolean;
  bucketVisits?: Record<string, number>; // playerId -> visit count
}

// Costume types (match monster types)
export type CostumeType = MonsterType;

// Controller type: human or bot (for future multiplayer, seats can be human or bot)
export type ControllerType = 'human' | 'bot';

// Player object
export interface Player {
  id: string;
  name: string;
  costume: CostumeType;
  controllerType: ControllerType;
  pawnPosition: { row: number; column: number } | null;
  candyTokens: number;
  itemCards: ItemCard[];
  isHome: boolean;
  skipNextTurn: boolean;
}

// Game phase
export type GamePhase =
  | 'setup'
  | 'costumeSelection'
  | 'chooseStartingPosition'
  | 'playing'
  | 'roundEnd'
  | 'gameOver';

// Full game state
export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  board: Tile[][];
  houseDeck: TileCard[];
  mansionDeck: TileCard[];
  candySupply: number;
  roundNumber: number;
  gamePhase: GamePhase;
  selectedAction: 'move' | 'goHome' | 'playItem' | null;
  pendingItemPlay: ItemCard | null;
  message: string;
  turnLog: string[];
  /** For UI feedback: player IDs affected by last action (e.g. monster, Witch swap) */
  lastAffectedPlayerIds?: string[];
  /** For UI feedback: short description of what happened to affected players */
  lastActionDescription?: string;
  /** For movement arrow animation: from/to/playerIndex (App looks up color) */
  lastMoveForAnimation?: { from: { row: number; col: number }; to: { row: number; col: number }; playerIndex: number };
  /** For item reveal: show item on tile, then fly to player inventory */
  lastRevealedItem?: { row: number; col: number; itemType: string; playerIndex: number };
  /** For candy collection: fly candy to player panel */
  lastRevealedCandy?: { row: number; col: number; playerIndex: number; amount: number };
}
