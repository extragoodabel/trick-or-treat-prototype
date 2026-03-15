/**
 * Centralized bot turn pacing. Bot Speed setting swaps between presets.
 * Only affects bot timing; human turns are unchanged.
 */

export type BotSpeed = 'fast' | 'normal' | 'slow';

export interface BotTimingPreset {
  /** Delay before next bot acts after a normal move (no consequence) */
  afterMoveDelayMs: number;
  /** Delay before next bot acts when previous action affected other players */
  afterAffectedDelayMs: number;
  /** How long to keep move/reveal animation state visible */
  animationClearDelayMs: number;
  /** How long to keep animation state when consequences affect players */
  animationClearAfterConsequenceMs: number;
  /** Delay for bot choosing starting position */
  startingPositionDelayMs: number;
}

export const BOT_TIMING_PRESETS: Record<BotSpeed, BotTimingPreset> = {
  fast: {
    afterMoveDelayMs: 900,
    afterAffectedDelayMs: 1200,
    animationClearDelayMs: 800,
    animationClearAfterConsequenceMs: 1400,
    startingPositionDelayMs: 350,
  },
  normal: {
    afterMoveDelayMs: 1650,
    afterAffectedDelayMs: 2200,
    animationClearDelayMs: 1500,
    animationClearAfterConsequenceMs: 2400,
    startingPositionDelayMs: 600,
  },
  slow: {
    afterMoveDelayMs: 2400,
    afterAffectedDelayMs: 3200,
    animationClearDelayMs: 2200,
    animationClearAfterConsequenceMs: 3200,
    startingPositionDelayMs: 900,
  },
};

const STORAGE_KEY = 'trick-or-treat-bot-speed';

export function loadBotSpeed(): BotSpeed {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fast' || stored === 'normal' || stored === 'slow') {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'normal';
}

export function saveBotSpeed(speed: BotSpeed): void {
  try {
    localStorage.setItem(STORAGE_KEY, speed);
  } catch {
    // ignore
  }
}
