import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TOOLTIP_HOVER_DELAY_MS } from '../config/tooltipConfig';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  /** Optional: prefer positioning above/below/left/right */
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({
  content,
  children,
  placement = 'top',
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || !content) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const tooltipHeight = 60; // approximate
    const tooltipWidth = 200; // approximate

    let top = 0;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    switch (placement) {
      case 'top':
        top = rect.top - tooltipHeight - gap;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      default:
        top = rect.top - tooltipHeight - gap;
    }

    // Keep within viewport
    const padding = 8;
    left = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, left));
    top = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, top));

    setPosition({ top, left });
  }, [content, placement]);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
      requestAnimationFrame(updatePosition);
    }, TOOLTIP_HOVER_DELAY_MS);
  }, [updatePosition]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    if (visible) {
      updatePosition();
      const onScroll = () => updatePosition();
      window.addEventListener('scroll', onScroll, true);
      return () => window.removeEventListener('scroll', onScroll, true);
    }
  }, [visible, updatePosition]);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className="tooltip-trigger"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible &&
        createPortal(
          <div
            className="tooltip-bubble"
            role="tooltip"
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              maxWidth: 220,
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}
