/**
 * Rules content for the Trick or Treat game.
 * v0.9 rules.
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
    content: `Collect the most candy and valuable items, survive three neighborhoods, and go home before Old Man Johnson catches you! The player with the highest score (banked candy + item points) after three neighborhoods wins.`,
  },
  {
    id: 'turn-structure',
    icon: '🔄',
    title: 'Turn Structure',
    content: `On your turn, you can:
• **Move** to any adjacent house (including diagonals)
• **Go Home** to bank your round candy permanently
• **Play Items** when you have useful cards

When you move to a tile:
• If it's face-down, you flip it and resolve what you find
• If it's already face-up, it resolves immediately
• Turn order is clockwise; Werewolf reverses direction`,
  },
  {
    id: 'tile-types',
    icon: '🏠',
    title: 'Tile & Card Types',
    content: `**Candy Bucket 🍬** — Collect candy! First flip places tokens (players − 1); you get 1. Each player may collect 1 token on their first visit only.

**Item / Candy Item 🎁** — Draw a card. Item cards can be played for effects; Candy Item cards are scoring only (2–3 points).

**Monster 👻🧟💀** — Each monster has a different effect. Ghost: lose 1 candy. Zombie: skip next turn. Witch: swap hands. Skeleton: reveal hand to all for one round (hidden at start of your next turn). Werewolf: reverse play direction. Goblin: fewest-cards player takes from you. Vampire: give 1 candy to player with least.

**King Size Bar 🍫** — Mansion only. Take into hand, worth 5–7 points.

**Old Man Johnson 🏚️** — Mansion only. Round ends instantly. Players still out lose all round candy.`,
  },
  {
    id: 'going-home',
    icon: '🏠',
    title: 'Going Home',
    content: `When you choose to Go Home, your **round candy** is immediately banked and safe for the rest of the game.

**Two candy types:** 🏦 **Banked** = permanent score, never lost. 🍬 **Round** = candy this neighborhood, at risk until you go home.

**You're safe at home:** Players at home cannot be targeted by monsters. Your candy and items are protected.

**Warning:** If Old Man Johnson is flipped while you're still on the board, you lose all round candy. Banked candy is never lost.`,
  },
  {
    id: 'winning',
    icon: '🏆',
    title: 'Winning',
    content: `After three neighborhoods, the game ends. Score = banked candy (1 pt each) + item card points. King Size Bar 5–7, Candy Item 2–3, Pennies/Rotten Apple -1, Toothbrush -3. Highest score wins!`,
  },
  {
    id: 'items',
    icon: '🔦',
    title: 'Items',
    content: `**Flashlight 🔦** — Use on an adjacent house to reveal/clear a monster, or use immediately after landing on a monster to negate its effect. Cannot target distant tiles.

**Shortcut 🗺️** — Move instantly to any house (except mansion row). Use to reach high-value tiles or escape danger.

**Intrusive Thoughts 😈** — Use on a Candy Bucket (while standing on it) to take all remaining tokens plus 4 from supply, then close the tile.

**Binoculars 🔭** — Peek at two face-down houses. Cards are revealed briefly; board state unchanged.`,
  },
  {
    id: 'board-navigation',
    icon: '🗺️',
    title: 'Board Navigation',
    content: `• Players begin on **Salem Ct.** (first row), choose any row 1 tile
• Starting tile flips immediately and resolves
• Move to any **adjacent tile** including diagonals (8 directions)
• **Mansion Row** (row 5) has 4 King Size Bars + 1 Old Man Johnson
• Shortcut cannot target mansion row tiles`,
  },
  {
    id: 'symbols',
    icon: '📖',
    title: 'Symbols & Icons',
    content: `**Candy & Items:** 🍬 candy • 🍫 King Size Bar • 🔦 Flashlight • 🔭 Binoculars • 🗺️ Shortcut • 😈 Intrusive Thoughts • 🪥 Toothbrush • 🪙 Pennies • 🍎 Rotten Apple

**Monsters & Costumes:** 👻 Ghost • 🧟 Zombie • 🧙‍♀️ Witch • 💀 Skeleton • 🐺 Werewolf • 👺 Goblin • 🧛 Vampire

**Board:** 🏠 house (face-down) • 🎁 item tile • 🏚️ Old Man Johnson`,
  },
];

export const TURN_STEPS = [
  { step: 1, icon: '👆', text: 'Choose where to move (or go home)' },
  { step: 2, icon: '🚶', text: 'Move to an adjacent house (including diagonals)' },
  { step: 3, icon: '🃏', text: 'Flip the tile if it\'s face-down' },
  { step: 4, icon: '✨', text: 'Resolve what you find (candy, item, monster)' },
  { step: 5, icon: '🤔', text: 'Decide: keep exploring or go home?' },
];
