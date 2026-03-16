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
 * House deck (rows 1-4) by round. 20 cards each round.
 * Round 1: 9 Candy Bucket, 6 Item/CandyItem, 5 Monsters
 * Round 2: 9 Candy Bucket, 6 Item/CandyItem, 8 Monsters
 * Round 3: 9 Candy Bucket, 6 Item/CandyItem, 11 Monsters
 */
const HOUSE_DECK_BY_ROUND: { candy: number; item: number; monster: number }[] = [
  { candy: 9, item: 6, monster: 5 },
  { candy: 9, item: 6, monster: 8 },
  { candy: 9, item: 6, monster: 11 },
];

export function getHouseDeckForRound(roundNumber: number): TileCard[] {
  const c = HOUSE_DECK_BY_ROUND[Math.min(roundNumber, 2)] ?? HOUSE_DECK_BY_ROUND[0];
  const itemCards: TileCard[] = [];
  for (let i = 0; i < c.item; i++) {
    itemCards.push(i % 2 === 0 ? { type: 'Item' } : { type: 'CandyItem' });
  }
  return [
    ...Array(c.candy).fill(null).map(() => ({ type: 'CandyBucket' as const })),
    ...itemCards,
    ...createMonsters(c.monster),
  ];
}

/**
 * Mansion deck (row 5): 4 King Size Bar + 1 Old Man Johnson
 */
export function getMansionDeckForRound(_roundNumber: number): TileCard[] {
  return [
    { type: 'KingSizeBar' },
    { type: 'KingSizeBar' },
    { type: 'KingSizeBar' },
    { type: 'KingSizeBar' },
    { type: 'OldManJohnson' },
  ];
}

/** Item deck for drawing when landing on Item tiles (not CandyItem - those are scoring only) */
export const ITEM_DECK: ItemCardType[] = [
  'Flashlight',
  'Flashlight',
  'Binoculars',
  'Binoculars',
  'Shortcut',
  'Shortcut',
  'IntrusiveThoughts',
  'IntrusiveThoughts',
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
    case 'KingSizeBar':
      points =
        GAME_RULES.kingSizeBarMinPoints +
        Math.floor(
          Math.random() *
            (GAME_RULES.kingSizeBarMaxPoints - GAME_RULES.kingSizeBarMinPoints + 1)
        );
      break;
    case 'CandyItem':
      points =
        GAME_RULES.candyItemMinPoints +
        Math.floor(
          Math.random() *
            (GAME_RULES.candyItemMaxPoints - GAME_RULES.candyItemMinPoints + 1)
        );
      break;
    case 'Pennies':
    case 'RottenApple':
      points = GAME_RULES.penniesPoints;
      break;
    case 'Toothbrush':
      points = GAME_RULES.toothbrushPoints;
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
