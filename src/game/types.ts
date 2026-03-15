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
export type TileCardType = 'CandyBucket' | 'Item' | 'Monster' | 'Ender' | 'HouseOnHill';

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
  /** True if item was collected from this Gift House - no more items available */
  itemCollected?: boolean;
  /** True if tile was spent by Flashlight - shows spider web */
  isSpent?: boolean;
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
  /** Permanently banked candy from previous neighborhoods - cannot be lost */
  bankedCandy: number;
  /** Candy collected this neighborhood - at risk until player goes home */
  roundCandy: number;
  itemCards: ItemCard[];
  isHome: boolean;
  skipNextTurn: boolean;
  /** True if this player revealed their hand (e.g. via Skeleton) - others can see their items */
  handRevealed?: boolean;
}

/** Total candy (banked + round) for display/scoring */
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
  board: Tile[][];
  houseDeck: TileCard[];
  mansionDeck: TileCard[];
  candySupply: number;
  roundNumber: number;
  /** Total neighborhoods to play (from game config) */
  totalRounds: number;
  /** Player colors (hex) for UI - human gets chosen color, bots get rest */
  playerColors: string[];
  gamePhase: GamePhase;
  selectedAction: 'move' | 'goHome' | 'playItem' | null;
  pendingItemPlay: ItemCard | null;
  message: string;
  turnLog: string[];
  /** For UI feedback: player IDs affected by last action (e.g. monster, Witch swap) */
  lastAffectedPlayerIds?: string[];
  /** For UI feedback: short description of what happened to affected players */
  lastActionDescription?: string;
  /** Full consequence message for top banner (e.g. "Witch Bot swapped hands with Player 1") */
  lastConsequenceMessage?: string;
  /** For Witch swap animation: player indices involved */
  lastWitchSwap?: { fromPlayerIndex: number; toPlayerIndex: number };
  /** For Goblin theft animation: from/to player indices and item type */
  lastGoblinTheft?: { fromPlayerIndex: number; toPlayerIndex: number; itemType: string };
  /** For candy delta floating indicators: player index and amount (positive = gain, negative = loss) */
  lastCandyDeltas?: { playerIndex: number; delta: number }[];
  /** For movement arrow animation: from/to/playerIndex (App looks up color) */
  lastMoveForAnimation?: { from: { row: number; col: number }; to: { row: number; col: number }; playerIndex: number };
  /** For item reveal: show item on tile, then fly to player inventory */
  lastRevealedItem?: { row: number; col: number; itemType: string; playerIndex: number };
  /** For candy collection: fly candy to player panel */
  lastRevealedCandy?: { row: number; col: number; playerIndex: number; amount: number };
  /** Ender was triggered - show "You barely escaped" overlay before round results */
  lastEnderReveal?: boolean;
  /** Flashlight reveal phase: beam → flip → resolve */
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
}
