import type { Tile as TileType } from '../game/types';
import { getCostumeIcon } from '../game/icons';
import { Tooltip } from './Tooltip';
import { getTileTooltip } from '../utils/tooltipContent';

interface PawnOnTile {
  costume: string;
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
  devRevealAll?: boolean;
  isMansionRow?: boolean;
  isFirstMansionTile?: boolean;
  isHouseOnHill?: boolean;
  /** True while item fly animation is playing from this tile - keep showing gift icon */
  isAnimatingItemReveal?: boolean;
  /** Players who have collected from this Candy Bucket (for visit markers) */
  collectedBy?: CollectedBy[];
  /** Force tile to show as revealed (e.g. during flashlight reveal phase) */
  forceRevealed?: boolean;
  /** Target tile during beam phase - show glow, dim others */
  isFlashlightBeamTarget?: boolean;
  /** True when beam phase is active - dim non-target tiles */
  isFlashlightBeamPhase?: boolean;
  /** Destination tile during pawn movement - highlight in player color */
  isMoveDestination?: boolean;
  moveDestinationColor?: string;
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
}: TileProps) {
  const showCard = tile.isFlipped || devRevealAll || forceRevealed;
  const card = tile.card;
  const isCandyBucket = showCard && card?.type === 'CandyBucket';
  const isMonster = showCard && card?.type === 'Monster';
  const hasPawn = playersOnTile.length > 0;
  const playerColor = playersOnTile[0]?.color ?? '#fff';
  const hidePawnForMove = !!movingPawn;

  let content = '';
  const showSpiderWeb = tile.isSpent || (card?.type === 'Item' && tile.itemCollected && !isAnimatingItemReveal);
  if (showSpiderWeb) {
    content = '🕸️';
  } else if (showCard && card) {
    switch (card.type) {
        case 'CandyBucket':
          content = '🍬';
          break;
        case 'Item':
          content = '🎁';
          break;
        case 'Monster':
          content = card.monsterType ? MONSTER_ICONS[card.monsterType] || '👹' : '👹';
          break;
        case 'Ender':
          content = '🏚️';
          break;
        case 'HouseOnHill':
          content = '🏆';
          break;
        default:
          content = '?';
    }
  } else {
    content = isHouseOnHill ? '✨' : '🏠';
  }

  // Legal move / current tile uses active player color; move destination uses mover's color
  const tileColor =
    isMoveDestination && moveDestinationColor
      ? moveDestinationColor
      : isCurrentPlayerTile || isValidMove || isSelectableForStart
        ? (currentPlayerColor ?? playerColor)
        : playerColor;
  const isInteractive = isSelected;

  let tooltipContent: string | null = null;
  if (!tile.isClosed) {
    tooltipContent =
      showCard && card
        ? getTileTooltip(card.type, card.monsterType, true, tile.itemCollected)
        : getTileTooltip(null, undefined, false);
    // Enhance Candy Bucket tooltip with collected-by info
    if (tooltipContent && isCandyBucket && collectedBy.length > 0) {
      tooltipContent += ` Collected here: ${collectedBy.map((c) => c.name).join(', ')}`;
    }
  }

  const tileButton = (
    <button
      type="button"
      data-tile-row={tile.row}
      data-tile-col={tile.column}
      className={`tile ${tile.isClosed ? 'closed' : ''} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isCurrentPlayerTile ? 'current-player-tile' : ''} ${isSelectableForStart ? 'selectable-start' : ''} ${hasPawn ? 'has-pawn' : ''} ${hidePawnForMove ? 'pawn-moving' : ''} ${isMansionRow ? 'mansion-row' : ''} ${isFirstMansionTile ? 'mansion-row-first' : ''} ${isHouseOnHill ? 'house-on-hill' : ''} ${tile.itemCollected ? 'used-gift-house' : ''} ${showCard ? 'revealed' : 'face-down'} ${forceRevealed ? 'tile--flashlight-reveal' : ''} ${isFlashlightBeamTarget ? 'tile--flashlight-beam-target' : ''} ${isFlashlightBeamPhase && !isFlashlightBeamTarget ? 'tile--flashlight-dimmed' : ''} ${isMoveDestination ? 'tile--move-destination' : ''} ${isCandyBucket ? 'candy-bucket-tile' : ''} ${isMonster ? 'monster-tile' : ''} ${isInteractive ? 'interactive' : ''}`}
      onClick={onClick}
      disabled={tile.isClosed}
      style={
        hasPawn || isCurrentPlayerTile || isValidMove || isSelectableForStart || isMoveDestination
          ? { '--tile-accent-color': tileColor, '--pawn-color': playerColor } as React.CSSProperties
          : undefined
      }
    >
      <span className="tile-content">{content}</span>
      {!hidePawnForMove && playersOnTile.length > 0 && (
        <div className="tile-pawns">
          {playersOnTile.map((p, i) => (
            <span
              key={i}
              className="tile-pawn"
              style={{ backgroundColor: p.color }}
              title={p.costume}
            >
              {getCostumeIcon(p.costume)}
            </span>
          ))}
        </div>
      )}
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
      <Tooltip content={tooltipContent} placement="top">
        {tileButton}
      </Tooltip>
    );
  }

  return tileButton;
}
