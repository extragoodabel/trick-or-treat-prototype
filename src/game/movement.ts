/**
 * Movement validation for Trick or Treat.
 * Players may only move to orthogonally adjacent tiles (up, down, left, right).
 * Item cards like Shortcut override this.
 */

export function isOrthogonallyAdjacent(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  const rowDiff = Math.abs(fromRow - toRow);
  const colDiff = Math.abs(fromCol - toCol);
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}
