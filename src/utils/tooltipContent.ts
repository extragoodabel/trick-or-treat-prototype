/**
 * Centralized tooltip content for tiles and items.
 * v0.9 rules.
 */

import type { MonsterType } from '../game/types';
import type { ItemCardType } from '../game/types';

// --- Board tile tooltips ---

export const TILE_TOOLTIPS: Record<string, string> = {
  FaceDown: 'House: flip to reveal what\'s inside.',
  CandyBucket:
    'Candy Bucket: collect 1 candy the first time you visit this house, if candy remains.',
  EmptyCandyBucket:
    'Candy Bucket (empty): all candy has been claimed. Nothing left to collect.',
  Item:
    'Gift House: landing here gives you an item card.',
  CandyItem:
    'Candy Item: landing here gives you a scoring-only item (2–3 points).',
  UsedGiftHouse:
    'Used Gift House: this house has already been searched and contains no more items.',
  KingSizeBar:
    'King Size Bar: take this card into your hand. Worth 5–7 points at scoring.',
  UsedKingSizeBar:
    'King Size Bar (claimed): this candy bar has already been taken.',
  OldManJohnson:
    'Old Man Johnson: the round ends immediately. Anyone still out loses all their round candy.',
};

export const MONSTER_TOOLTIPS: Record<MonsterType, string> = {
  Ghost: 'Ghost: lose 1 round candy when you land here.',
  Zombie: 'Zombie: lose your next turn when you land here.',
  Witch: 'Witch: swap your entire item hand with another player.',
  Skeleton: 'Skeleton: reveal your hand to all players for one round. Hidden again at the start of your next turn.',
  Werewolf: 'Werewolf: reverse direction of play.',
  Goblin:
    'Goblin: the player with fewest cards takes one random card from your hand.',
  Vampire:
    'Vampire: give 1 round candy to the player with the least candy.',
};

export function getTileTooltip(
  cardType: string | null,
  monsterType?: MonsterType,
  isFlipped?: boolean,
  itemCollected?: boolean,
  candyBucketEmpty?: boolean
): string | null {
  if (!isFlipped && !cardType) {
    return TILE_TOOLTIPS.FaceDown;
  }
  if (cardType === 'Monster' && monsterType) {
    return MONSTER_TOOLTIPS[monsterType] ?? null;
  }
  if ((cardType === 'Item' || cardType === 'CandyItem') && itemCollected) {
    return TILE_TOOLTIPS.UsedGiftHouse;
  }
  if (cardType === 'KingSizeBar' && itemCollected) {
    return TILE_TOOLTIPS.UsedKingSizeBar;
  }
  if (cardType === 'CandyBucket' && candyBucketEmpty) {
    return TILE_TOOLTIPS.EmptyCandyBucket;
  }
  return cardType ? (TILE_TOOLTIPS[cardType] ?? null) : null;
}

// --- Inventory item tooltips ---

export const ITEM_TOOLTIPS: Record<ItemCardType, string> = {
  Flashlight:
    'Flashlight: use on an adjacent house to reveal/clear a monster, or use immediately after landing on a monster to negate its effect.',
  Binoculars:
    'Binoculars: select two face-down houses to peek at. Cards are revealed for ~3 seconds, then flip back. Board state is unchanged.',
  Shortcut:
    'Shortcut: move instantly to any house (except mansion row). Use to reach high-value tiles or escape danger.',
  IntrusiveThoughts:
    'Intrusive Thoughts: use on a Candy Bucket (while standing on it) to take all remaining tokens plus 4 from supply, then close the tile.',
  Toothbrush:
    'Toothbrush: if Old Man Johnson flips while you\'re out, lose 3 points instead of all round candy. Always -3 at scoring.',
  Pennies: 'Pennies: worth -1 point.',
  RottenApple: 'Rotten Apple: worth -1 point.',
  KingSizeBar: 'King Size Bar: worth 5–7 points at scoring.',
  CandyItem: 'Candy Item: worth 2–3 points at scoring.',
};

export function getItemTooltip(
  itemType: ItemCardType,
  points?: number
): string {
  const base = ITEM_TOOLTIPS[itemType];
  if (!base) return itemType;

  if (itemType === 'KingSizeBar' && points !== undefined && points > 0) {
    return `King Size Bar: worth ${points} points at the end of the game.`;
  }
  if (itemType === 'CandyItem' && points !== undefined && points > 0) {
    return `Candy Item: worth ${points} points at the end of the game.`;
  }

  return base;
}
