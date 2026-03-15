import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface CandyDeltaIndicatorProps {
  playerIndex: number;
  delta: number;
}

function getPanelRect(playerIndex: number): DOMRect | null {
  const el = document.querySelector(`[data-player-index="${playerIndex}"]`);
  return el?.getBoundingClientRect() ?? null;
}

export function CandyDeltaIndicator({
  playerIndex,
  delta,
}: CandyDeltaIndicatorProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const r = getPanelRect(playerIndex);
      if (r) setRect(r);
    };
    measure();
    const id = requestAnimationFrame(() => {
      const r = getPanelRect(playerIndex);
      if (r) setRect((prev) => prev ?? r);
    });
    return () => cancelAnimationFrame(id);
  }, [playerIndex]);

  if (!rect) return null;

  const isPositive = delta > 0;
  const text = isPositive ? `+${delta} 🍬` : `${delta} 🍬`;

  return createPortal(
    <div
      className={`candy-delta-indicator ${isPositive ? 'candy-delta--gain' : 'candy-delta--loss'}`}
      style={{
        position: 'fixed',
        left: rect.left + rect.width / 2,
        top: rect.top + rect.height / 2,
        transform: 'translate(-50%, -50%)',
      } as React.CSSProperties}
      aria-hidden="true"
    >
      {text}
    </div>,
    document.body
  );
}
