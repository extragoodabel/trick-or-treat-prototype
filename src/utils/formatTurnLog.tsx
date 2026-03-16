/**
 * Inline icon replacements for turn log messages.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/\bKing Size Bar\b/g, '🍫 King Size Bar'],
  [/\bFlashlight\b/g, '🔦 Flashlight'],
  [/\bBinoculars\b/g, '🔭 Binoculars'],
  [/\bShortcut\b/g, '🗺️ Shortcut'],
  [/\bIntrusive Thoughts\b/g, '😈 Intrusive Thoughts'],
  [/\bToothbrush\b/g, '🪥 Toothbrush'],
  [/\bPennies\b/g, '🪙 Pennies'],
  [/\bRotten Apple\b/g, '🍎 Rotten Apple'],
  [/\bCandy Bucket\b/g, '🍬 Candy Bucket'],
  [/\bcollected (\d+) candy\b/g, 'collected 🍬 $1 candy'],
  [/\bcollected candy\b/g, 'collected 🍬 candy'],
  [/\bGot (\d+) candy\b/g, 'Got 🍬 $1 candy'],
  [/\bcandy\b/g, '🍬 candy'],
  [/\bGhost\b/g, '👻 Ghost'],
  [/\bZombie\b/g, '🧟 Zombie'],
  [/\bWitch\b/g, '🧙‍♀️ Witch'],
  [/\bSkeleton\b/g, '💀 Skeleton'],
  [/\bWerewolf\b/g, '🐺 Werewolf'],
  [/\bGoblin\b/g, '👺 Goblin'],
  [/\bVampire\b/g, '🧛 Vampire'],
  [/\bOld Man Johnson\b/g, '🏚️ Old Man Johnson'],
  [/\bKing Size\b/g, '🍫 King Size'],
  [/\bwent home\b/g, 'went 🏠 home'],
];

/**
 * Format a turn log message with inline icons.
 * Returns a React node (string with icons).
 */
export function formatTurnLogWithIcons(message: string): string {
  let result = message;
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
