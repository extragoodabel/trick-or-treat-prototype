/**
 * Trick or Treat v0.9 - Game Rules
 * Centralize all rule constants here for easy iteration.
 */

export const GAME_RULES = {
  // Neighborhood / rounds
  totalNeighborhoods: 3,
  boardRows: 5,
  boardCols: 5,
  houseDeckRows: 4, // rows 1-4
  mansionRow: 4, // row 5 (0-indexed: row 4)

  // Candy
  startingCandyPerRound: 5,
  initialCandySupply: 50,

  // Candy bucket
  candyBucketTokens: (numPlayers: number) => numPlayers - 1,
  candyBucketFlipperGets: 1,

  // Monster effects
  ghostLoseTokens: 1,

  // Intrusive Thoughts (was Naughty Kid)
  intrusiveThoughtsBonusTokens: 4,

  // Toothbrush
  toothbrushOldManJohnsonPenalty: 3,

  // Item scoring
  kingSizeBarMinPoints: 5,
  kingSizeBarMaxPoints: 7,
  candyItemMinPoints: 2,
  candyItemMaxPoints: 3,
  penniesPoints: -1,
  rottenApplePoints: -1,
  toothbrushPoints: -3,
} as const;
