/**
 * Centralized tooltip content for tiles and items.
 * Update here as rules evolve.
 */

import type { MonsterType } from '../game/types';
import type { ItemCardType } from '../game/types';

// --- Board tile tooltips ---

export const TILE_TOOLTIPS: Record<string, string> = {
  FaceDown: 'House: flip to reveal what’s inside.',
  CandyBucket:
    'Candy Bucket: collect 1 candy the first time you visit this house, if candy remains.',
  Item:
    'Gift House: landing here gives you an item card.',
  UsedGiftHouse:
    'Used Gift House: this house has already been searched and contains no more items.',
  Ender:
    'Ender: the round ends immediately. Anyone still out loses their candy.',
  HouseOnHill:
    'House on the Hill: reach this to claim the 10-point King Size prize and end the game immediately.',
};

export const MONSTER_TOOLTIPS: Record<MonsterType, string> = {
  Ghost: 'Ghost: lose 3 candy when you land here.',
  Zombie: 'Zombie: lose your next turn when you land here.',
  Witch: 'Witch: swap your entire item hand with another player.',
  Skeleton: 'Skeleton: reveal your hand to all players.',
  Werewolf: 'Werewolf: lose half your candy when you land here.',
  Goblin:
    'Goblin: you steal one random card from the player with the fewest cards.',
  Vampire:
    'Vampire: give 1 candy to the player with the least total candy.',
};

export function getTileTooltip(
  cardType: string | null,
  monsterType?: MonsterType,
  isFlipped?: boolean,
  itemCollected?: boolean
): string | null {
  if (!isFlipped && !cardType) {
    return TILE_TOOLTIPS.FaceDown;
  }
  if (cardType === 'Monster' && monsterType) {
    return MONSTER_TOOLTIPS[monsterType] ?? null;
  }
  if (cardType === 'Item' && itemCollected) {
    return TILE_TOOLTIPS.UsedGiftHouse;
  }
  return cardType ? (TILE_TOOLTIPS[cardType] ?? null) : null;
}

// --- Inventory item tooltips ---

export const ITEM_TOOLTIPS: Record<ItemCardType, string> = {
  Flashlight:
    'Flashlight: peek at hidden houses or remove a monster from the board.',
  Shortcut: 'Shortcut: move anywhere on the board or escape danger.',
  NaughtyKid:
    'Naughty Kid: take all remaining candy from a bucket house plus bonus candy, then close that house.',
  FullSizeBar: 'Full Size Bar: worth 3–5 points at the end of the game.',
  Toothbrush: 'Toothbrush: junk item worth -1 point.',
  Pennies: 'Pennies: junk item worth -1 point.',
  RottenApple: 'Rotten Apple: junk item worth -1 point.',
};

export function getItemTooltip(
  itemType: ItemCardType,
  points?: number
): string {
  const base = ITEM_TOOLTIPS[itemType];
  if (!base) return itemType;

  // For Full Size Bar, show actual points if known
  if (itemType === 'FullSizeBar' && points !== undefined && points > 0) {
    return `Full Size Bar: worth ${points} points at the end of the game.`;
  }

  return base;
}
