import type { Tile as TileType } from '../game/types';

interface TileProps {
  tile: TileType;
  isSelected: boolean;
  hasPawn: boolean;
  playerColor: string;
  onClick: () => void;
  devRevealAll?: boolean;
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
  hasPawn,
  playerColor,
  onClick,
  devRevealAll,
}: TileProps) {
  const showCard = tile.isFlipped || devRevealAll;
  const card = tile.card;

  let content = '';
  if (showCard && card) {
    switch (card.type) {
      case 'CandyBucket':
        content = `🍬${tile.candyTokensOnTile > 0 ? ` (${tile.candyTokensOnTile})` : ''}`;
        break;
      case 'Item':
        content = '🎁';
        break;
      case 'Monster':
        content = card.monsterType ? MONSTER_ICONS[card.monsterType] || '👹' : '👹';
        break;
      case 'Ender':
        content = '🏠';
        break;
      default:
        content = '?';
    }
  } else {
    content = '?';
  }

  return (
    <button
      type="button"
      className={`tile ${tile.isClosed ? 'closed' : ''} ${isSelected ? 'selected' : ''} ${hasPawn ? 'has-pawn' : ''}`}
      onClick={onClick}
      disabled={tile.isClosed}
      style={hasPawn ? { '--pawn-color': playerColor } as React.CSSProperties : undefined}
    >
      <span className="tile-content">{content}</span>
      {tile.candyTokensOnTile > 0 && (
        <span className="candy-badge">{tile.candyTokensOnTile}</span>
      )}
    </button>
  );
}
