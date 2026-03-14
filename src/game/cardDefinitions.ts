import type { TileCard, ItemCard, ItemCardType } from './types';
import { GAME_RULES } from './gameRules';

// House deck composition (rows 1-4)
export const HOUSE_DECK: TileCard[] = [
  { type: 'CandyBucket' },
  { type: 'CandyBucket' },
  { type: 'CandyBucket' },
  { type: 'Item' },
  { type: 'Item' },
  { type: 'Item' },
  { type: 'Monster', monsterType: 'Ghost' },
  { type: 'Monster', monsterType: 'Zombie' },
  { type: 'Monster', monsterType: 'Witch' },
  { type: 'Monster', monsterType: 'Skeleton' },
  { type: 'Monster', monsterType: 'Werewolf' },
  { type: 'Monster', monsterType: 'Goblin' },
  { type: 'Monster', monsterType: 'Ghost' },
  { type: 'Monster', monsterType: 'Zombie' },
  { type: 'Monster', monsterType: 'Witch' },
  { type: 'Monster', monsterType: 'Skeleton' },
  { type: 'Monster', monsterType: 'Werewolf' },
  { type: 'Monster', monsterType: 'Goblin' },
  { type: 'Monster', monsterType: 'Ghost' },
  { type: 'Monster', monsterType: 'Zombie' },
];

// Mansion deck (row 5) - draw 4 + Ender
export const MANSION_DECK: TileCard[] = [
  { type: 'CandyBucket' },
  { type: 'CandyBucket' },
  { type: 'Item' },
  { type: 'Item' },
  { type: 'Monster', monsterType: 'Ghost' },
  { type: 'Monster', monsterType: 'Zombie' },
  { type: 'Monster', monsterType: 'Witch' },
  { type: 'Monster', monsterType: 'Skeleton' },
  { type: 'Monster', monsterType: 'Werewolf' },
  { type: 'Monster', monsterType: 'Goblin' },
  { type: 'Ender' },
];

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
