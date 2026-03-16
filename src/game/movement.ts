/**
 * Movement validation for Trick or Treat v0.9.
 * Players may move to any adjacent tile, including diagonals (8 directions).
 * Item cards like Shortcut override this.
 */

export function isAdjacent(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  const rowDiff = Math.abs(fromRow - toRow);
  const colDiff = Math.abs(fromCol - toCol);
  return rowDiff <= 1 && colDiff <= 1 && (rowDiff !== 0 || colDiff !== 0);
}

/** @deprecated Use isAdjacent for v0.9 (diagonal allowed) */
export function isOrthogonallyAdjacent(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  return isAdjacent(fromRow, fromCol, toRow, toCol);
}
