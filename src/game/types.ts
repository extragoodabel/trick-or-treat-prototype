// Monster subtypes
export type MonsterType =
  | 'Ghost'
  | 'Zombie'
  | 'Witch'
  | 'Skeleton'
  | 'Werewolf'
  | 'Goblin'
  | 'Vampire';

// Card types for tiles
export type TileCardType =
  | 'CandyBucket'
  | 'Item'
  | 'CandyItem'
  | 'Monster'
  | 'KingSizeBar'
  | 'OldManJohnson';

// Base card for tiles
export interface TileCard {
  type: TileCardType;
  monsterType?: MonsterType;
}

// Item card types (playable or scoring)
export type ItemCardType =
  | 'Flashlight'
  | 'Binoculars'
  | 'Shortcut'
  | 'IntrusiveThoughts'
  | 'Toothbrush'
  | 'Pennies'
  | 'RottenApple'
  | 'KingSizeBar'
  | 'CandyItem';

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
  /** True if item was collected from this Gift House - no more items available */
  itemCollected?: boolean;
  /** True if tile was spent by Flashlight - shows spider web */
  isSpent?: boolean;
}

// Costume types (match monster types)
export type CostumeType = MonsterType;

// Controller type: human or bot
export type ControllerType = 'human' | 'bot';

// Player object
export interface Player {
  id: string;
  name: string;
  costume: CostumeType;
  controllerType: ControllerType;
  pawnPosition: { row: number; column: number } | null;
  /** Permanently banked candy from previous neighborhoods - cannot be lost */
  bankedCandy: number;
  /** Candy collected this neighborhood - at risk until player goes home */
  roundCandy: number;
  itemCards: ItemCard[];
  isHome: boolean;
  skipNextTurn: boolean;
  /** True if this player revealed their hand (e.g. via Skeleton) */
  handRevealed?: boolean;
}

/** Total candy (banked + round) for display */
export function getTotalCandy(player: Player): number {
  return player.bankedCandy + player.roundCandy;
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
  /** 1 = clockwise, -1 = counter-clockwise (Werewolf reversed) */
  playDirection: number;
  board: Tile[][];
  houseDeck: TileCard[];
  mansionDeck: TileCard[];
  candySupply: number;
  roundNumber: number;
  totalRounds: number;
  playerColors: string[];
  gamePhase: GamePhase;
  selectedAction: 'move' | 'goHome' | 'playItem' | null;
  pendingItemPlay: ItemCard | null;
  message: string;
  turnLog: string[];
  lastAffectedPlayerIds?: string[];
  lastActionDescription?: string;
  lastConsequenceMessage?: string;
  lastWitchSwap?: { fromPlayerIndex: number; toPlayerIndex: number };
  lastGoblinTheft?: { fromPlayerIndex: number; toPlayerIndex: number; itemType: string };
  lastCandyDeltas?: { playerIndex: number; delta: number }[];
  lastMoveForAnimation?: { from: { row: number; col: number }; to: { row: number; col: number }; playerIndex: number };
  lastRevealedItem?: { row: number; col: number; itemType: string; playerIndex: number };
  lastRevealedCandy?: { row: number; col: number; playerIndex: number; amount: number };
  /** Old Man Johnson was triggered */
  lastOldManJohnsonReveal?: boolean;
  tileOccupancyOrder?: Record<string, string[]>;
  flashlightReveal?: {
    row: number;
    col: number;
    fromRow: number;
    fromCol: number;
    card: TileCard;
    playerName: string;
    location: string;
    revealMessage: string;
    phase: 'beam' | 'reveal';
  };
  /** Binoculars: peeked tile coords for UI */
  binocularsPeek?: { row: number; col: number }[];
}
