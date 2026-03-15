import type { TileCard, ItemCard, ItemCardType } from './types';
import { GAME_RULES } from './gameRules';

const MONSTER_TYPES = ['Ghost', 'Zombie', 'Witch', 'Skeleton', 'Werewolf', 'Goblin', 'Vampire'] as const;

function createMonsters(count: number): TileCard[] {
  const cards: TileCard[] = [];
  for (let i = 0; i < count; i++) {
    cards.push({ type: 'Monster', monsterType: MONSTER_TYPES[i % MONSTER_TYPES.length] });
  }
  return cards;
}

/**
 * Build house deck (rows 1-4) for a given neighborhood.
 * Escalation: Round 1 = exploration-friendly, Round 2 = balanced, Round 3 = dangerous.
 */
export function getHouseDeckForRound(roundNumber: number): TileCard[] {
  const counts = [
    { candy: 8, item: 6, monster: 6 }, // Neighborhood 1: fewer monsters, more rewards
    { candy: 6, item: 6, monster: 8 }, // Neighborhood 2: balanced
    { candy: 4, item: 4, monster: 12 }, // Neighborhood 3: highest monster density
  ];
  const c = counts[Math.min(roundNumber, 2)];
  return [
    ...Array(c.candy).fill(null).map(() => ({ type: 'CandyBucket' as const })),
    ...Array(c.item).fill(null).map(() => ({ type: 'Item' as const })),
    ...createMonsters(c.monster),
  ];
}

/**
 * Build mansion deck (row 5) for a given neighborhood.
 * Mansion Row stays dangerous every round; Round 3 is most punishing.
 */
export function getMansionDeckForRound(roundNumber: number): TileCard[] {
  const pools = [
    { candy: 1, item: 1, monster: 2 }, // Neighborhood 1: some rewards, still dangerous
    { candy: 1, item: 1, monster: 2 }, // Neighborhood 2: balanced
    { candy: 0, item: 1, monster: 3 }, // Neighborhood 3: fewest rewards, most monsters
  ];
  const p = pools[Math.min(roundNumber, 2)];
  return [
    ...Array(p.candy).fill(null).map(() => ({ type: 'CandyBucket' as const })),
    ...Array(p.item).fill(null).map(() => ({ type: 'Item' as const })),
    ...createMonsters(p.monster),
    { type: 'Ender' as const },
  ];
}

// Item deck for drawing when landing on Item tiles
export const ITEM_DECK: ItemCardType[] = [
  'FullSizeBar',
  'FullSizeBar',
  'FullSizeBar',
  'Flashlight',
  'Flashlight',
  'Shortcut',
  'Shortcut',
  'NaughtyKid',
  'NaughtyKid',
  'Toothbrush',
  'Toothbrush',
  'Pennies',
  'Pennies',
  'RottenApple',
  'RottenApple',
];

export function createItemCard(type: ItemCardType): ItemCard {
  const id = `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let points = 0;
  switch (type) {
    case 'FullSizeBar':
      points =
        GAME_RULES.fullSizeBarMinPoints +
        Math.floor(
          Math.random() *
            (GAME_RULES.fullSizeBarMaxPoints - GAME_RULES.fullSizeBarMinPoints + 1)
        );
      break;
    case 'Toothbrush':
    case 'Pennies':
    case 'RottenApple':
      points = GAME_RULES.negativeItemPoints;
      break;
    default:
      points = 0;
  }
  return { id, type, points };
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
