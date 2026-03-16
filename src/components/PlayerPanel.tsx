import type { Player, ItemCard } from '../game/types';
import { getItemIcon, ITEM_LABELS } from '../game/icons';
import { Tooltip } from './Tooltip';
import { getItemTooltip } from '../utils/tooltipContent';

interface PlayerPanelProps {
  player: Player;
  playerIndex: number;
  isCurrent: boolean;
  color: string;
  turnJustChanged?: boolean;
  onPlayItem?: (item: ItemCard) => void;
  canPlayItem?: boolean;
  /** Discard mode: clicking an item discards it */
  onDiscardItem?: (item: ItemCard) => void;
  canDiscardItem?: boolean;
  /** Item currently selected for use (e.g. Flashlight awaiting target) */
  selectedItem?: ItemCard | null;
  /** Mobile Info Mode: taps show info instead of playing */
  infoMode?: boolean;
  onShowInfo?: (content: string) => void;
  disableTooltipHover?: boolean;
  showHand?: boolean;
  isAffected?: boolean;
  /** Goblin theft: victim panel flashes red */
  isGoblinVictim?: boolean;
  /** Goblin theft: thief panel flashes green */
  isGoblinThief?: boolean;
  /** Witch swap: both players glow purple */
  isWitchSwapParticipant?: boolean;
}

const TARGETED_ITEM_TYPES = ['Shortcut', 'IntrusiveThoughts', 'Flashlight', 'Binoculars'];

export function PlayerPanel({
  player,
  playerIndex,
  isCurrent,
  color,
  turnJustChanged = false,
  onPlayItem,
  canPlayItem,
  onDiscardItem,
  canDiscardItem,
  selectedItem = null,
  infoMode = false,
  onShowInfo,
  disableTooltipHover = false,
  showHand = true,
  isAffected = false,
  isGoblinVictim = false,
  isGoblinThief = false,
  isWitchSwapParticipant = false,
}: PlayerPanelProps) {
  return (
    <div
      className={`player-panel ${isCurrent ? 'current' : 'inactive'} ${turnJustChanged ? 'turn-start' : ''} ${isAffected ? 'affected' : ''} ${isGoblinVictim ? 'goblin-victim' : ''} ${isGoblinThief ? 'goblin-thief' : ''} ${isWitchSwapParticipant ? 'witch-swap' : ''}`}
      style={
        {
          borderColor: color,
          '--player-color': color,
          '--player-glow': color + '80',
        } as React.CSSProperties
      }
      data-player-index={playerIndex}
    >
      <div className="player-header">
        <span className="player-color-dot" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="name">{player.name}</span>
        {player.controllerType === 'bot' && <span className="bot-badge">Bot</span>}
        {player.isHome && <span className="home-badge">🏠 Home</span>}
        {player.skipNextTurn && <span className="skip-badge">⏭ Skip</span>}
      </div>
      <div className="player-stats" data-candy-target>
        <span className="player-candy-banked" title="Banked (safe)">🏦 {player.bankedCandy}</span>
        <span className="player-candy-round" title="This round (at risk)">🍬 {player.roundCandy}</span>
      </div>
      <div className="player-items" data-inventory>
        {player.itemCards.length > 0 ? (
          showHand ? (
            <ul className="player-items-icons">
              {player.itemCards.map((item) => {
                const itemTooltip = getItemTooltip(item.type, item.points);
                return (
                <li key={item.id}>
                  <Tooltip content={itemTooltip} placement="top" disableHover={disableTooltipHover}>
                    <button
                      type="button"
                      className={`item-btn item-btn-icon${selectedItem?.id === item.id ? ' item-btn-selected' : ''}${canDiscardItem ? ' item-btn-discardable' : ''}`}
                      onClick={() => {
                        if (infoMode && onShowInfo && itemTooltip) {
                          onShowInfo(itemTooltip);
                        } else if (canDiscardItem) {
                          onDiscardItem?.(item);
                        } else if (canPlayItem && TARGETED_ITEM_TYPES.includes(item.type)) {
                          onPlayItem?.(item);
                        }
                      }}
                      disabled={!canPlayItem && !canDiscardItem && !infoMode}
                      title={`${ITEM_LABELS[item.type] || item.type}${item.points !== 0 ? ` (${item.points} pts)` : ''}`}
                    >
                      <span className={`item-icon ${item.type === 'RottenApple' ? 'item-icon-rotten' : ''}`}>
                        {getItemIcon(item.type)}
                      </span>
                    </button>
                  </Tooltip>
                </li>
              );
              })}
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
