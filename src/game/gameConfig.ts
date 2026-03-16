/**
 * Game configuration for pre-game setup.
 */

export const SETUP_COLORS = [
  { name: 'Orange', hex: '#e67e22' },
  { name: 'Purple', hex: '#9b59b6' },
  { name: 'Green', hex: '#2ecc71' },
  { name: 'Blue', hex: '#3498db' },
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Yellow', hex: '#f1c40f' },
] as const;

export const COLOR_NAMES = SETUP_COLORS.map((c) => c.name);

export type GameConfig = {
  totalRounds: number;
  playerCount: number;
  colors: string[];
  controllerTypes: ('human' | 'bot')[];
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  totalRounds: 3,
  playerCount: 2,
  colors: ['Random', 'Random'],
  controllerTypes: ['human', 'bot'],
};

/**
 * Resolve "Random" choices and build final colors array (hex).
 */
export function resolveColors(choices: string[]): string[] {
  const used = new Set<string>();
  const result: (string | null)[] = [];
  const randoms: number[] = [];

  for (let i = 0; i < choices.length; i++) {
    const c = choices[i];
    if (c === 'Random' || !(COLOR_NAMES as readonly string[]).includes(c)) {
      randoms.push(i);
    } else {
      used.add(c);
      const col = SETUP_COLORS.find((x) => x.name === c);
      result[i] = col?.hex ?? SETUP_COLORS[0].hex;
    }
  }

  const available = SETUP_COLORS.filter((x) => !used.has(x.name)).map((x) => x.hex);
  let a = 0;
  for (const idx of randoms) {
    result[idx] = available[a % available.length];
    a++;
  }
  return result as string[];
}
