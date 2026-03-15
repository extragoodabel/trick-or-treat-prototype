/**
 * Themed neighborhood street labels for the board.
 * Used for display and logging.
 */

export const STREET_COL_LABELS = [
  '1st Street',
  '2nd Street',
  '3rd Street',
  '4th Street',
  '5th Street',
] as const;

export const STREET_ROW_LABELS = [
  'Salem Ct.',
  'Raven Rd.',
  'Elm St.',
  'Lantern Way',
  'Mansion Row',
] as const;

/** Row label for House on the Hill (Neighborhood 3 only) */
export const HOUSE_ON_HILL_LABEL = 'House on the Hill';

/** Format tile location for display and logging, e.g. "Elm St. / 3rd Street" */
export function formatTileLocation(row: number, col: number): string {
  const rowLabel =
    row === 5 ? HOUSE_ON_HILL_LABEL : (STREET_ROW_LABELS[row] ?? `Row ${row + 1}`);
  const colLabel = STREET_COL_LABELS[col] ?? `Col ${col + 1}`;
  return `${rowLabel} / ${colLabel}`;
}
