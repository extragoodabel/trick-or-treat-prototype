import type { Player, ItemCard } from '../game/types';

const ITEM_LABELS: Record<string, string> = {
  FullSizeBar: 'Full Size Bar',
  Flashlight: 'Flashlight',
  Shortcut: 'Shortcut',
  NaughtyKid: 'Naughty Kid',
  Toothbrush: 'Toothbrush',
  Pennies: 'Pennies',
  RottenApple: 'Rotten Apple',
};

const COSTUME_ICONS: Record<string, string> = {
  Ghost: '👻',
  Zombie: '🧟',
  Witch: '🧙‍♀️',
  Skeleton: '💀',
  Werewolf: '🐺',
  Goblin: '👺',
};

interface PlayerPanelProps {
  player: Player;
  isCurrent: boolean;
  color: string;
  onPlayItem?: (item: ItemCard) => void;
  canPlayItem?: boolean;
}

export function PlayerPanel({
  player,
  isCurrent,
  color,
  onPlayItem,
  canPlayItem,
}: PlayerPanelProps) {
  return (
    <div
      className={`player-panel ${isCurrent ? 'current' : ''}`}
      style={{ borderColor: color }}
    >
      <div className="player-header">
        <span className="costume">{COSTUME_ICONS[player.costume] || '🎃'}</span>
        <span className="name">{player.name}</span>
        {player.controllerType === 'bot' && <span className="bot-badge">Bot</span>}
        {player.isHome && <span className="home-badge">🏠 Home</span>}
        {player.skipNextTurn && <span className="skip-badge">⏭ Skip</span>}
      </div>
      <div className="player-stats">
        <span>🍬 {player.candyTokens}</span>
      </div>
      <div className="player-items">
        {player.itemCards.length > 0 ? (
          <ul>
            {player.itemCards.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="item-btn"
                  onClick={() => canPlayItem && onPlayItem?.(item)}
                  disabled={!canPlayItem}
                  title={`${ITEM_LABELS[item.type] || item.type} (${item.points} pts)`}
                >
                  {ITEM_LABELS[item.type] || item.type} {item.points !== 0 && `(${item.points})`}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <span className="no-items">No items</span>
        )}
      </div>
    </div>
  );
}
