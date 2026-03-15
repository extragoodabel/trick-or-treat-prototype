/**
 * Game configuration for pre-game setup.
 * Structured for future flexibility (bot count, difficulty, etc.).
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
  /** Number of neighborhoods (rounds) to play: 1–9 */
  totalRounds: number;
  /** Player count (2–4) */
  playerCount: number;
  /** Costume per seat: "Random" or costume name */
  costumes: string[];
  /** Color per seat: "Random" or color name */
  colors: string[];
  /** Controller type per seat */
  controllerTypes: ('human' | 'bot')[];
};

export const DEFAULT_GAME_CONFIG: GameConfig = {
  totalRounds: 3,
  playerCount: 2,
  costumes: ['Random', 'Random'],
  colors: ['Random', 'Random'],
  controllerTypes: ['human', 'bot'],
};

const COSTUME_TYPES = ['Ghost', 'Zombie', 'Witch', 'Skeleton', 'Werewolf', 'Goblin', 'Vampire'] as const;

/**
 * Resolve "Random" choices and build final costumes array.
 * Explicit choices are used; Random gets unused options.
 */
export function resolveCostumes(choices: string[]): string[] {
  const used = new Set<string>();
  const result: string[] = [];
  const randoms: number[] = [];

  for (let i = 0; i < choices.length; i++) {
    const c = choices[i];
    if (c === 'Random' || !COSTUME_TYPES.includes(c as (typeof COSTUME_TYPES)[number])) {
      randoms.push(i);
    } else {
      used.add(c);
      result[i] = c;
    }
  }

  const available = COSTUME_TYPES.filter((x) => !used.has(x));
  let a = 0;
  for (const idx of randoms) {
    result[idx] = available[a % available.length];
    a++;
  }
  return result;
}

/**
 * Resolve "Random" choices and build final colors array (hex).
 * Explicit choices are used; Random gets unused options.
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
