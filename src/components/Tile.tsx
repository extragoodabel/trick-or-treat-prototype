import type { Tile as TileType } from '../game/types';
import { Tooltip } from './Tooltip';
import { getTileTooltip } from '../utils/tooltipContent';

interface PawnOnTile {
  color: string;
}

interface CollectedBy {
  playerIndex: number;
  color: string;
  name: string;
}

interface TileProps {
  tile: TileType;
  isSelected: boolean;
  isValidMove?: boolean;
  isCurrentPlayerTile?: boolean;
  isSelectableForStart?: boolean;
  playersOnTile: PawnOnTile[];
  movingPawn?: { from: { row: number; col: number }; playerIndex: number };
  currentPlayerColor?: string;
  onClick: () => void;
  onInfoClick?: (content: string) => void;
  infoMode?: boolean;
  disableTooltipHover?: boolean;
  devRevealAll?: boolean;
  isMansionRow?: boolean;
  isFirstMansionTile?: boolean;
  isHouseOnHill?: boolean;
  isAnimatingItemReveal?: boolean;
  collectedBy?: CollectedBy[];
  forceRevealed?: boolean;
  isFlashlightBeamTarget?: boolean;
  isFlashlightBeamPhase?: boolean;
  isMoveDestination?: boolean;
  moveDestinationColor?: string;
  isBinocularsSelected?: boolean;
}

const MONSTER_ICONS: Record<string, string> = {
  Ghost: '👻',
  Zombie: '🧟',
  Witch: '🧙‍♀️',
  Skeleton: '💀',
  Werewolf: '🐺',
  Goblin: '👺',
  Vampire: '🧛',
};

export function TileComponent({
  tile,
  isSelected,
  isValidMove = false,
  isCurrentPlayerTile = false,
  isSelectableForStart = false,
  playersOnTile,
  movingPawn,
  currentPlayerColor,
  onClick,
  onInfoClick,
  infoMode = false,
  disableTooltipHover = false,
  devRevealAll,
  isMansionRow,
  isFirstMansionTile = false,
  isHouseOnHill = false,
  isAnimatingItemReveal = false,
  collectedBy = [],
  forceRevealed = false,
  isFlashlightBeamTarget = false,
  isFlashlightBeamPhase = false,
  isMoveDestination = false,
  moveDestinationColor,
  isBinocularsSelected = false,
}: TileProps) {
  const showCard = tile.isFlipped || devRevealAll || forceRevealed;
  const card = tile.card;
  const isCandyBucket = showCard && card?.type === 'CandyBucket';
  const isMonster = showCard && card?.type === 'Monster';
  const hasOccupancy = playersOnTile.length > 0;
  const hidePawnForMove = !!movingPawn;

  let content = '';
  const candyBucketEmpty = showCard && card?.type === 'CandyBucket' && tile.candyTokensOnTile === 0;
  const giftOrBarCollected =
    showCard &&
    (card?.type === 'Item' || card?.type === 'CandyItem' || card?.type === 'KingSizeBar') &&
    tile.itemCollected &&
    !isAnimatingItemReveal;
  const showSpiderWeb = (showCard && tile.isSpent) || candyBucketEmpty || giftOrBarCollected;
  if (showSpiderWeb) {
    content = '🕸️';
  } else if (showCard && card) {
    switch (card.type) {
        case 'CandyBucket':
          content = '🍬';
          break;
        case 'Item':
        case 'CandyItem':
          content = '🎁';
          break;
        case 'Monster':
          content = card.monsterType ? MONSTER_ICONS[card.monsterType] || '👹' : '👹';
          break;
        case 'KingSizeBar':
          content = '🍫';
          break;
        case 'OldManJohnson':
          content = '🏚️';
          break;
        default:
          content = '?';
    }
  } else {
    content = '🏠';
  }

  const isInteractive = isSelected;

  let tooltipContent: string | null = null;
  if (!tile.isClosed) {
    tooltipContent =
      showCard && card
        ? getTileTooltip(card.type, card.monsterType, true, tile.itemCollected, candyBucketEmpty)
        : getTileTooltip(null, undefined, false);
    if (tooltipContent && isCandyBucket && !candyBucketEmpty && collectedBy.length > 0) {
      tooltipContent += ` Collected here: ${collectedBy.map((c) => c.name).join(', ')}`;
    }
  }

  const handleClick = () => {
    if (infoMode && onInfoClick && tooltipContent) {
      onInfoClick(tooltipContent);
    } else {
      onClick();
    }
  };

  // Occupancy fill: single = solid color, multi = striped
  const occupancyColors = playersOnTile.map((p) => p.color);
  const n = occupancyColors.length;
  const occupancyFill =
    n === 1
      ? occupancyColors[0]
      : n > 1
        ? `repeating-linear-gradient(135deg, ${occupancyColors
            .map((c, i) => `${c} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
            .join(', ')})`
        : null;

  // Legal move / current tile = outline (active player color)
  const showLegalOutline = isValidMove || isSelectableForStart || isCurrentPlayerTile || (isSelected && !isCurrentPlayerTile);
  const outlineColor = isMoveDestination && moveDestinationColor
    ? moveDestinationColor
    : currentPlayerColor ?? occupancyColors[0] ?? '#fff';

  const tileButton = (
    <button
      type="button"
      data-tile-row={tile.row}
      data-tile-col={tile.column}
      className={`tile ${tile.isClosed ? 'closed' : ''} ${isSelected ? 'selected' : ''} ${isBinocularsSelected ? 'binoculars-selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isCurrentPlayerTile ? 'current-player-tile' : ''} ${isSelectableForStart ? 'selectable-start' : ''} ${hasOccupancy ? 'has-occupancy' : ''} ${hidePawnForMove ? 'pawn-moving' : ''} ${isMansionRow ? 'mansion-row' : ''} ${isFirstMansionTile ? 'mansion-row-first' : ''} ${isHouseOnHill ? 'house-on-hill' : ''} ${tile.itemCollected ? 'used-gift-house' : ''} ${showCard ? 'revealed' : 'face-down'} ${forceRevealed ? 'tile--flashlight-reveal' : ''} ${isFlashlightBeamTarget ? 'tile--flashlight-beam-target' : ''} ${isFlashlightBeamPhase && !isFlashlightBeamTarget ? 'tile--flashlight-dimmed' : ''} ${isMoveDestination ? 'tile--move-destination' : ''} ${isCandyBucket ? 'candy-bucket-tile' : ''} ${isMonster ? 'monster-tile' : ''} ${isInteractive ? 'interactive' : ''}`}
      onClick={handleClick}
      disabled={tile.isClosed}
      style={
        {
          ...(occupancyFill && { '--tile-occupancy-fill': occupancyFill }),
          ...(showLegalOutline && { '--tile-legal-outline': outlineColor }),
        } as React.CSSProperties
      }
    >
      <span className="tile-content">{content}</span>
      {tile.candyTokensOnTile > 0 && showCard && (
        <span className="candy-badge">{tile.candyTokensOnTile}</span>
      )}
      {isCandyBucket && collectedBy.length > 0 && (
        <div className="bucket-visit-markers" aria-label={`Collected by: ${collectedBy.map((c) => c.name).join(', ')}`}>
          {collectedBy.map(({ playerIndex, color, name }) => (
            <span
              key={playerIndex}
              className="bucket-visit-dot"
              style={{ backgroundColor: color }}
              title={name}
            />
          ))}
        </div>
      )}
    </button>
  );

  if (tooltipContent) {
    return (
      <Tooltip content={tooltipContent} placement="top" disableHover={disableTooltipHover}>
        {tileButton}
      </Tooltip>
    );
  }

  return tileButton;
}
