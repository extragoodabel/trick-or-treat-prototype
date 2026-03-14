/**
 * Trick or Treat v0.5 - Game Rules
 * Centralize all rule constants here for easy iteration.
 */

export const GAME_RULES = {
  // Neighborhood / rounds
  totalNeighborhoods: 3,
  boardRows: 5,
  boardCols: 5,
  houseDeckRows: 4, // rows 1-4
  mansionRow: 5, // row 5 (1-indexed)
  mansionCardsCount: 4,
  enderCardsCount: 1,

  // Candy bucket
  candyBucketTokens: (numPlayers: number) => numPlayers - 1,
  candyBucketFlipperGets: 1,

  // Starting candy supply (per round or total - adjust as needed)
  initialCandySupply: 50,

  // Monster effects
  ghostLoseTokens: 3,
  werewolfLoseHalf: true,

  // Item cards
  fullSizeBarMinPoints: 3,
  fullSizeBarMaxPoints: 5,
  naughtyKidBonusToken: 1,
  negativeItemPoints: -1,
} as const;
