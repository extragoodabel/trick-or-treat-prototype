/**
 * Rules content for the Trick or Treat game.
 * Edit this file to update the rules as the game evolves.
 */

export interface RulesSection {
  id: string;
  icon: string;
  title: string;
  content: string;
}

export const RULES_SECTIONS: RulesSection[] = [
  {
    id: 'objective',
    icon: '🎃',
    title: 'Objective',
    content: `Collect the most candy and valuable items, survive the neighborhood, and go home before the Ender catches you! The player with the highest score (candy + item points) after three neighborhoods wins.`,
  },
  {
    id: 'turn-structure',
    icon: '🔄',
    title: 'Turn Structure',
    content: `On your turn, you can:
• **Move** to an adjacent house (up, down, left, or right)
• **Go Home** to lock in your candy safely for the round
• **Play Items** when you have useful cards

When you move to a tile:
• If it's face-down, you flip it and resolve what you find
• If it's already face-up, it resolves immediately
• Then it's the next player's turn`,
  },
  {
    id: 'tile-types',
    icon: '🏠',
    title: 'Tile & Card Types',
    content: `**Candy Bucket 🍬** — Collect candy! First flip places tokens; you get 1. Later visits let you collect 1 more if candy remains.

**Item 🎁** — Draw a random item card. Items can help (Flashlight, Shortcut) or hurt (Rotten Apple, Pennies).

**Monster 👻🧟💀** — Each monster has a different effect. Some steal candy, some swap hands, some make you skip a turn. Match your costume to a monster to be immune!

**Ender 🏚️** — The round ends immediately. Anyone still on the board loses their candy for that round. Go home before it's too late!

**Mansion Row** — The final row is riskiest: more monsters and the Ender. High risk, high reward.`,
  },
  {
    id: 'going-home',
    icon: '🏠',
    title: 'Going Home',
    content: `When you choose to Go Home, your candy is safe for the round. You're done—no more moves until the next neighborhood.

**Warning:** If the Ender is flipped while you're still on the board, you lose all candy you collected that round. Don't stay out too long!`,
  },
  {
    id: 'winning',
    icon: '🏆',
    title: 'Winning',
    content: `After three neighborhoods, the game ends. Your score = candy collected + item card points (some items add points, some subtract). Highest score wins!`,
  },
  {
    id: 'board-navigation',
    icon: '🗺️',
    title: 'Board Navigation',
    content: `• Players begin in the **Starting Block** (first row)
• Move deeper into the neighborhood **row by row**
• **Mansion Row** is the final and riskiest row
• Movement is **orthogonally adjacent only** — up, down, left, or right. No diagonal movement.`,
  },
  {
    id: 'symbols',
    icon: '📖',
    title: 'Symbols & Icons',
    content: `**Candy & Items:** 🍬 candy • 🍫 Full Size Bar • 🔦 Flashlight • 🗺️ Shortcut • 😈 Naughty Kid • 🪥 Toothbrush • 🪙 Pennies • 🍎 Rotten Apple

**Monsters & Costumes:** 👻 Ghost • 🧟 Zombie • 🧙‍♀️ Witch • 💀 Skeleton • 🐺 Werewolf • 👺 Goblin

**Board:** 🏠 house (face-down) • 🎁 item tile • 🏚️ Ender`,
  },
];

export const TURN_STEPS = [
  { step: 1, icon: '👆', text: 'Choose where to move' },
  { step: 2, icon: '🚶', text: 'Move to an adjacent house' },
  { step: 3, icon: '🃏', text: 'Flip the tile if it\'s face-down' },
  { step: 4, icon: '✨', text: 'Resolve what you find (candy, item, monster)' },
  { step: 5, icon: '🤔', text: 'Decide: keep exploring or go home?' },
];
