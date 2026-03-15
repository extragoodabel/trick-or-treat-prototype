import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface WitchSwapAnimationProps {
  fromPlayerIndex: number;
  toPlayerIndex: number;
}

function getInventoryRect(playerIndex: number): DOMRect | null {
  const el = document.querySelector(
    `[data-player-index="${playerIndex}"] [data-inventory]`
  );
  return el?.getBoundingClientRect() ?? null;
}

export function WitchSwapAnimation({
  fromPlayerIndex,
  toPlayerIndex,
}: WitchSwapAnimationProps) {
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

  const size = 44;
  const half = size / 2;

  // Two bundles: one A→B, one B→A (simultaneous swap)
  const fromCenter = {
    x: rects.from.left + rects.from.width / 2,
    y: rects.from.top + rects.from.height / 2,
  };
  const toCenter = {
    x: rects.to.left + rects.to.width / 2,
    y: rects.to.top + rects.to.height / 2,
  };

  const deltaAtoB = { x: toCenter.x - fromCenter.x, y: toCenter.y - fromCenter.y };
  const deltaBtoA = { x: fromCenter.x - toCenter.x, y: fromCenter.y - toCenter.y };

  return (
    <>
      {createPortal(
        <>
          <div
            className="witch-swap-fly witch-swap-fly--a-to-b"
            style={{
              position: 'fixed',
              left: fromCenter.x - half,
              top: fromCenter.y - half,
              width: size,
              height: size,
              '--fly-delta-x': deltaAtoB.x,
              '--fly-delta-y': deltaAtoB.y,
            } as React.CSSProperties}
            aria-hidden="true"
          >
            <span className="witch-swap-icon">🃏</span>
          </div>
          <div
            className="witch-swap-fly witch-swap-fly--b-to-a"
            style={{
              position: 'fixed',
              left: toCenter.x - half,
              top: toCenter.y - half,
              width: size,
              height: size,
              '--fly-delta-x': deltaBtoA.x,
              '--fly-delta-y': deltaBtoA.y,
            } as React.CSSProperties}
            aria-hidden="true"
          >
            <span className="witch-swap-icon">🃏</span>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
