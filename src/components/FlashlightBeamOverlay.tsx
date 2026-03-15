/**
 * Cone-shaped beam of light from player pawn toward target tile.
 * Shown during the flashlight "beam" phase (~400ms).
 */
interface FlashlightBeamOverlayProps {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  rowCount: number;
  isBeamPhase: boolean;
}

export function FlashlightBeamOverlay({
  fromRow,
  fromCol,
  toRow,
  toCol,
  rowCount,
  isBeamPhase,
}: FlashlightBeamOverlayProps) {
  if (!isBeamPhase) return null;

  const cols = 5;
  const tileW = 100 / cols;
  const tileH = 100 / rowCount;

  const fromX = (fromCol + 0.5) * tileW;
  const fromY = (fromRow + 0.5) * tileH;
  const toX = (toCol + 0.5) * tileW;
  const toY = (toRow + 0.5) * tileH;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const perpX = (-dy / len) * 12;
  const perpY = (dx / len) * 12;

  const base1X = toX + perpX;
  const base1Y = toY + perpY;
  const base2X = toX - perpX;
  const base2Y = toY - perpY;

  const pathD = `M ${fromX} ${fromY} L ${base1X} ${base1Y} L ${base2X} ${base2Y} Z`;

  return (
    <div className="flashlight-beam-overlay" aria-hidden="true">
      <svg
        viewBox={`0 0 100 ${100 * (rowCount / cols)}`}
        preserveAspectRatio="none"
        className="flashlight-beam-svg"
        style={{ aspectRatio: `${cols} / ${rowCount}` }}
      >
        <defs>
          <linearGradient id="flashlight-beam-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 220, 120, 0.5)" stopOpacity="0.9" />
            <stop offset="60%" stopColor="rgba(255, 195, 0, 0.25)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="rgba(255, 195, 0, 0.05)" stopOpacity="0.2" />
          </linearGradient>
          <filter id="flashlight-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={pathD}
          fill="url(#flashlight-beam-grad)"
          className="flashlight-beam-path"
        />
        <circle
          cx={toX}
          cy={toY}
          r={8}
          fill="rgba(255, 220, 150, 0.4)"
          className="flashlight-beam-spotlight"
        />
      </svg>
    </div>
  );
}
