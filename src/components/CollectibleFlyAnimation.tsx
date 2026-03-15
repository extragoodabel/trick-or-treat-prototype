import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getItemIcon } from '../game/icons';

type ItemFly = { row: number; col: number; itemType: string; playerIndex: number };
type CandyFly = { row: number; col: number; playerIndex: number; amount: number };

interface CollectibleFlyAnimationProps {
  lastRevealedItem?: ItemFly | null;
  lastRevealedCandy?: CandyFly | null;
}

function getTileRect(row: number, col: number): DOMRect | null {
  const el = document.querySelector(`[data-tile-row="${row}"][data-tile-col="${col}"]`);
  return el?.getBoundingClientRect() ?? null;
}

function getInventoryRect(playerIndex: number): DOMRect | null {
  const el = document.querySelector(`[data-player-index="${playerIndex}"] [data-inventory]`);
  return el?.getBoundingClientRect() ?? null;
}

function getCandyRect(playerIndex: number): DOMRect | null {
  const el = document.querySelector(`[data-player-index="${playerIndex}"] [data-candy-target]`);
  return el?.getBoundingClientRect() ?? null;
}

export function CollectibleFlyAnimation({
  lastRevealedItem,
  lastRevealedCandy,
}: CollectibleFlyAnimationProps) {
  const [itemRects, setItemRects] = useState<{ start: DOMRect; end: DOMRect } | null>(null);
  const [candyRects, setCandyRects] = useState<{ start: DOMRect; end: DOMRect } | null>(null);

  useLayoutEffect(() => {
    if (!lastRevealedItem) {
      setItemRects(null);
      return;
    }
    const measure = () => {
      const start = getTileRect(lastRevealedItem!.row, lastRevealedItem!.col);
      const end = getInventoryRect(lastRevealedItem!.playerIndex);
      if (start && end) setItemRects({ start, end });
    };
    measure();
    const id = requestAnimationFrame(() => {
      const start = getTileRect(lastRevealedItem!.row, lastRevealedItem!.col);
      const end = getInventoryRect(lastRevealedItem!.playerIndex);
      if (start && end) setItemRects((prev) => prev ?? { start, end });
    });
    return () => cancelAnimationFrame(id);
  }, [lastRevealedItem]);

  useLayoutEffect(() => {
    if (!lastRevealedCandy) {
      setCandyRects(null);
      return;
    }
    const measure = () => {
      const start = getTileRect(lastRevealedCandy!.row, lastRevealedCandy!.col);
      const end = getCandyRect(lastRevealedCandy!.playerIndex);
      if (start && end) setCandyRects({ start, end });
    };
    measure();
    const id = requestAnimationFrame(() => {
      const start = getTileRect(lastRevealedCandy!.row, lastRevealedCandy!.col);
      const end = getCandyRect(lastRevealedCandy!.playerIndex);
      if (start && end) setCandyRects((prev) => prev ?? { start, end });
    });
    return () => cancelAnimationFrame(id);
  }, [lastRevealedCandy]);

  const itemIcon = lastRevealedItem ? getItemIcon(lastRevealedItem.itemType) : null;
  const size = 56; // Larger reveal for visibility
  const half = size / 2;

  return (
    <>
      {lastRevealedItem && itemRects && (
        <>
          {createPortal(
            <div
              className={`collectible-fly collectible-fly--item ${['Toothbrush', 'Pennies', 'RottenApple'].includes(lastRevealedItem.itemType) ? 'collectible-fly--negative' : ''}`}
              style={{
                position: 'fixed',
                left: itemRects.start.left + itemRects.start.width / 2 - half,
                top: itemRects.start.top + itemRects.start.height / 2 - half,
                width: size,
                height: size,
                '--fly-delta-x': itemRects.end.left + itemRects.end.width / 2 - (itemRects.start.left + itemRects.start.width / 2),
                '--fly-delta-y': itemRects.end.top + itemRects.end.height / 2 - (itemRects.start.top + itemRects.start.height / 2),
              } as React.CSSProperties}
              aria-hidden="true"
            >
              <span className="collectible-fly-icon">{itemIcon}</span>
            </div>,
            document.body
          )}
        </>
      )}
      {lastRevealedCandy && candyRects && (
        <>
          {createPortal(
            <div
              className="collectible-fly collectible-fly--candy"
              style={{
                position: 'fixed',
                left: candyRects.start.left + candyRects.start.width / 2 - half,
                top: candyRects.start.top + candyRects.start.height / 2 - half,
                width: size,
                height: size,
                '--fly-delta-x': candyRects.end.left + candyRects.end.width / 2 - (candyRects.start.left + candyRects.start.width / 2),
                '--fly-delta-y': candyRects.end.top + candyRects.end.height / 2 - (candyRects.start.top + candyRects.start.height / 2),
              } as React.CSSProperties}
              aria-hidden="true"
            >
              <span className="collectible-fly-icon">🍬</span>
            </div>,
            document.body
          )}
        </>
      )}
    </>
  );
}
