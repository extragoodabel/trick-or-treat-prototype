import { useEffect } from 'react';

interface EnderRevealOverlayProps {
  onComplete: () => void;
  /** Duration in ms before transitioning to recap (1.5–2s) */
  durationMs?: number;
}

/**
 * Full-screen overlay shown when Old Man Johnson is revealed.
 * Displays an ominous message, dims the background, and triggers onComplete after a brief pause.
 */
export function EnderRevealOverlay({ onComplete, durationMs = 1800 }: EnderRevealOverlayProps) {
  useEffect(() => {
    const id = setTimeout(onComplete, durationMs);
    return () => clearTimeout(id);
  }, [onComplete, durationMs]);

  return (
    <div className="ender-reveal-overlay" aria-live="polite">
      <div className="ender-reveal-dim" aria-hidden="true" />
      <div className="ender-reveal-message">
        <p className="ender-reveal-text">Old Man Johnson has awoken...</p>
        <p className="ender-reveal-emoji">😱</p>
      </div>
    </div>
  );
}
