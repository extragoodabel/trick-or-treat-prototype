import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getItemIcon } from '../game/icons';

interface GoblinTheftAnimationProps {
  fromPlayerIndex: number;
  toPlayerIndex: number;
  itemType: string;
}

function getInventoryRect(playerIndex: number): DOMRect | null {
  const el = document.querySelector(
    `[data-player-index="${playerIndex}"] [data-inventory]`
  );
  return el?.getBoundingClientRect() ?? null;
}

export function GoblinTheftAnimation({
  fromPlayerIndex,
  toPlayerIndex,
  itemType,
}: GoblinTheftAnimationProps) {
  const [rects, setRects] = useState<{
    from: DOMRect;
    to: DOMRect;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const from = getInventoryRect(fromPlayerIndex);
      const to = getInventoryRect(toPlayerIndex);
      if (from && to) setRects({ from, to });
    };
    measure();
    const id = requestAnimationFrame(() => {
      const from = getInventoryRect(fromPlayerIndex);
      const to = getInventoryRect(toPlayerIndex);
      if (from && to) setRects((prev) => prev ?? { from, to });
    });
    return () => cancelAnimationFrame(id);
  }, [fromPlayerIndex, toPlayerIndex]);

  if (!rects) return null;

  const size = 48;
  const half = size / 2;

  const fromCenter = {
    x: rects.from.left + rects.from.width / 2,
    y: rects.from.top + rects.from.height / 2,
  };
  const toCenter = {
    x: rects.to.left + rects.to.width / 2,
    y: rects.to.top + rects.to.height / 2,
  };

  const delta = {
    x: toCenter.x - fromCenter.x,
    y: toCenter.y - fromCenter.y,
  };

  const icon = getItemIcon(itemType);

  return createPortal(
    <div
      className="goblin-theft-fly"
      style={{
        position: 'fixed',
        left: fromCenter.x - half,
        top: fromCenter.y - half,
        width: size,
        height: size,
        '--fly-delta-x': delta.x,
        '--fly-delta-y': delta.y,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="goblin-theft-icon">{icon}</span>
    </div>,
    document.body
  );
}
