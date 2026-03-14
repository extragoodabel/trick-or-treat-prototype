import type { Tile as TileType } from '../game/types';
import { getCostumeIcon } from '../game/icons';

interface PawnOnTile {
  costume: string;
  color: string;
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
}

const MONSTER_ICONS: Record<string, string> = {
  Ghost: '👻',
  Zombie: '🧟',
  Witch: '🧙‍♀️',
  Skeleton: '💀',
  Werewolf: '🐺',
  Goblin: '👺',
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
}: TileProps) {
  const showCard = tile.isFlipped || devRevealAll;
  const card = tile.card;
  const isCandyBucket = showCard && card?.type === 'CandyBucket';
  const isMonster = showCard && card?.type === 'Monster';
  const hasPawn = playersOnTile.length > 0;
  const playerColor = playersOnTile[0]?.color ?? '#fff';
  const hidePawnForMove = !!movingPawn;

  let content = '';
  if (showCard && card) {
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
      default:
        content = '?';
    }
  } else {
    content = '🏠';
  }

  const tileColor = isCurrentPlayerTile || isValidMove || isSelectableForStart ? (currentPlayerColor ?? playerColor) : playerColor;
  return (
    <button
      type="button"
      data-tile-row={tile.row}
      data-tile-col={tile.column}
      className={`tile ${tile.isClosed ? 'closed' : ''} ${isSelected ? 'selected' : ''} ${isValidMove ? 'valid-move' : ''} ${isCurrentPlayerTile ? 'current-player-tile' : ''} ${isSelectableForStart ? 'selectable-start' : ''} ${hasPawn ? 'has-pawn' : ''} ${hidePawnForMove ? 'pawn-moving' : ''} ${isMansionRow ? 'mansion-row' : ''} ${showCard ? 'revealed' : 'face-down'} ${isCandyBucket ? 'candy-bucket-tile' : ''} ${isMonster ? 'monster-tile' : ''}`}
      onClick={onClick}
      disabled={tile.isClosed}
      style={
        hasPawn || isCurrentPlayerTile || isValidMove || isSelectableForStart
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
    </button>
  );
}
