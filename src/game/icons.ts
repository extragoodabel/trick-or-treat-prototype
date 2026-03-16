/**
 * Shared icon mappings for consistent display across the UI.
 */

export const COSTUME_ICONS: Record<string, string> = {
  Ghost: '👻',
  Zombie: '🧟',
  Witch: '🧙‍♀️',
  Skeleton: '💀',
  Werewolf: '🐺',
  Goblin: '👺',
  Vampire: '🧛',
};

export const ITEM_ICONS: Record<string, string> = {
  KingSizeBar: '🍫',
  CandyItem: '🍬',
  Flashlight: '🔦',
  Binoculars: '🔭',
  Shortcut: '🗺️',
  IntrusiveThoughts: '😈',
  Toothbrush: '🪥',
  Pennies: '🪙',
  RottenApple: '🍎',
};

export const ITEM_LABELS: Record<string, string> = {
  KingSizeBar: 'King Size Bar',
  CandyItem: 'Candy Item',
  Flashlight: 'Flashlight',
  Binoculars: 'Binoculars',
  Shortcut: 'Shortcut',
  IntrusiveThoughts: 'Intrusive Thoughts',
  Toothbrush: 'Toothbrush',
  Pennies: 'Pennies',
  RottenApple: 'Rotten Apple',
};

export function getItemIcon(type: string): string {
  return ITEM_ICONS[type] || '🎁';
}

export function getCostumeIcon(costume: string): string {
  return COSTUME_ICONS[costume] || '🎃';
}
