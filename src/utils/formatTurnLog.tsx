/**
 * Inline icon replacements for turn log messages.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/\bFull Size Bar\b/g, '🍫 Full Size Bar'],
  [/\bFlashlight\b/g, '🔦 Flashlight'],
  [/\bShortcut\b/g, '🗺️ Shortcut'],
  [/\bNaughty Kid\b/g, '😈 Naughty Kid'],
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
  [/\bEnder\b/g, '🏚️ Ender'],
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
