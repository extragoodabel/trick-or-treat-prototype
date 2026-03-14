import type { Player, ItemCard } from '../game/types';
import { getItemIcon, getCostumeIcon, ITEM_LABELS } from '../game/icons';

interface PlayerPanelProps {
  player: Player;
  playerIndex: number;
  isCurrent: boolean;
  color: string;
  onPlayItem?: (item: ItemCard) => void;
  canPlayItem?: boolean;
  showHand?: boolean;
  isAffected?: boolean;
}

export function PlayerPanel({
  player,
  playerIndex,
  isCurrent,
  color,
  onPlayItem,
  canPlayItem,
  showHand = true,
  isAffected = false,
}: PlayerPanelProps) {
  return (
    <div
      className={`player-panel ${isCurrent ? 'current' : ''} ${isAffected ? 'affected' : ''}`}
      style={{ borderColor: color }}
      data-player-index={playerIndex}
    >
      <div className="player-header">
        <span className="costume">{getCostumeIcon(player.costume)}</span>
        <span className="name">{player.name}</span>
        {player.controllerType === 'bot' && <span className="bot-badge">Bot</span>}
        {player.isHome && <span className="home-badge">🏠 Home</span>}
        {player.skipNextTurn && <span className="skip-badge">⏭ Skip</span>}
      </div>
      <div className="player-stats" data-candy-target>
        <span>🍬 {player.candyTokens}</span>
      </div>
      <div className="player-items" data-inventory>
        {player.itemCards.length > 0 ? (
          showHand ? (
            <ul className="player-items-icons">
              {player.itemCards.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="item-btn item-btn-icon"
                    onClick={() => canPlayItem && onPlayItem?.(item)}
                    disabled={!canPlayItem}
                    title={`${ITEM_LABELS[item.type] || item.type}${item.points !== 0 ? ` (${item.points} pts)` : ''}`}
                  >
                    <span className={`item-icon ${item.type === 'RottenApple' ? 'item-icon-rotten' : ''}`}>
                      {getItemIcon(item.type)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="no-items">Items: {player.itemCards.length} cards</span>
          )
        ) : (
          <span className="no-items">{showHand ? 'No items' : 'Items: 0 cards'}</span>
        )}
      </div>
    </div>
  );
}
