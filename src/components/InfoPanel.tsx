import { formatTurnLogWithIcons } from '../utils/formatTurnLog';

interface InfoPanelProps {
  content: string;
  onClose: () => void;
}

/**
 * Mobile-only info panel. Shows explanatory content in a fixed area
 * that does not block the board. Dismissible via close button or backdrop.
 */
export function InfoPanel({ content, onClose }: InfoPanelProps) {
  return (
    <div className="info-panel-backdrop" onClick={onClose} aria-hidden="true">
      <div
        className="info-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Information"
      >
        <div className="info-panel-content">
          {formatTurnLogWithIcons(content)}
        </div>
        <button
          type="button"
          className="info-panel-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
