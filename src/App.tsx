import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, CostumeType, ControllerType } from './game/types';
import {
  createNewGame,
  selectAction,
  goHome,
  move,
  playItem,
  endTurn,
  startNextNeighborhood,
  selectStartingPosition,
  appendToTurnLog,
  devRevealAll,
  devHideAllTiles,
  devAddCandy,
  devSkipToMansion,
  devRestartNeighborhood,
  getFinalScores,
} from './game/gameEngine';
import { getBotAction, getBotStartingPosition, type BotMoveHistory } from './bots/botLogic';
import { Board } from './components/Board';
import { PlayerPanel } from './components/PlayerPanel';
import { RoundEndSummary } from './components/RoundEndSummary';
import { RulesModal } from './components/RulesModal';
import { CollectibleFlyAnimation } from './components/CollectibleFlyAnimation';
import { WitchSwapAnimation } from './components/WitchSwapAnimation';
import { GoblinTheftAnimation } from './components/GoblinTheftAnimation';
import { CandyDeltaIndicator } from './components/CandyDeltaIndicator';
import type { ItemCard } from './game/types';
import { formatTurnLogWithIcons } from './utils/formatTurnLog';
import { getCostumeIcon } from './game/icons';
import {
  type BotSpeed,
  BOT_TIMING_PRESETS,
  loadBotSpeed,
  saveBotSpeed,
} from './config/botTiming';
import './App.css';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const COSTUMES: CostumeType[] = ['Ghost', 'Zombie', 'Witch', 'Skeleton', 'Werewolf', 'Goblin'];

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [playerCount, setPlayerCount] = useState(2);
  const [costumes, setCostumes] = useState<CostumeType[]>(['Ghost', 'Zombie']);
  const [controllerTypes, setControllerTypes] = useState<ControllerType[]>(['human', 'bot']);
  const [devRevealAllTiles, setDevRevealAllTiles] = useState(false);
  const [showAllHands, setShowAllHands] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [botSpeed, setBotSpeed] = useState<BotSpeed>(loadBotSpeed);
  const [pendingItem, setPendingItem] = useState<ItemCard | null>(null);
  const [showRules, setShowRules] = useState(false);
  const botTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botLastMoveFromRef = useRef<Record<string, BotMoveHistory>>({});
  const animationClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [turnJustChanged, setTurnJustChanged] = useState(false);
  const prevPlayerIndexRef = useRef<number>(0);

  // Turn-start pulse: track when current player changes for brief highlight animation
  useEffect(() => {
    if (!state || state.gamePhase !== 'playing') return;
    if (state.currentPlayerIndex !== prevPlayerIndexRef.current) {
      prevPlayerIndexRef.current = state.currentPlayerIndex;
      setTurnJustChanged(true);
      const id = setTimeout(() => setTurnJustChanged(false), 550);
      return () => clearTimeout(id);
    }
  }, [state?.gamePhase, state?.currentPlayerIndex]);

  // Clear movement/item/candy animation state after display
  const timing = BOT_TIMING_PRESETS[botSpeed];
  useEffect(() => {
    if (!state) return;
    const hasAnimation = state.lastMoveForAnimation || state.lastRevealedItem || state.lastRevealedCandy;
    const hasConsequence = (state.lastAffectedPlayerIds?.length ?? 0) > 0;
    if (hasAnimation || hasConsequence) {
      if (animationClearRef.current) clearTimeout(animationClearRef.current);
      const clearDelay = hasConsequence
        ? timing.animationClearAfterConsequenceMs
        : timing.animationClearDelayMs;
      animationClearRef.current = setTimeout(() => {
        setState((s) => {
          if (!s) return s;
          const hasAny =
            s.lastMoveForAnimation || s.lastRevealedItem || s.lastRevealedCandy ||
            s.lastWitchSwap || s.lastGoblinTheft || (s.lastCandyDeltas?.length ?? 0) > 0;
          if (!hasAny) return s;
          const {
            lastMoveForAnimation,
            lastRevealedItem,
            lastRevealedCandy,
            lastWitchSwap,
            lastGoblinTheft,
            lastCandyDeltas,
            ...rest
          } = s;
          return rest as GameState;
        });
      }, clearDelay);
    }
    return () => {
      if (animationClearRef.current) clearTimeout(animationClearRef.current);
    };
  }, [
    botSpeed,
    state?.lastMoveForAnimation,
    state?.lastRevealedItem,
    state?.lastRevealedCandy,
    state?.lastAffectedPlayerIds,
    state?.lastWitchSwap,
    state?.lastGoblinTheft,
    state?.lastCandyDeltas,
  ]);

  // Default to Move mode when human turn begins (preserve animation state)
  useEffect(() => {
    if (!state || state.gamePhase !== 'playing') return;
    const currentPlayer = state.players[state.currentPlayerIndex];
    const canAct = currentPlayer.controllerType === 'human' && !currentPlayer.isHome && !currentPlayer.skipNextTurn;
    if (canAct && state.selectedAction === null) {
      setState({ ...state, selectedAction: 'move', message: `${currentPlayer.name}'s turn. Choose an adjacent house to move.` });
    }
  }, [state]);

  const startGame = useCallback(() => {
    const gameState = createNewGame(playerCount, costumes as string[], controllerTypes);
    setState(gameState);
    setPendingItem(null);
    botLastMoveFromRef.current = {};
  }, [playerCount, costumes, controllerTypes]);

  const handleBotSpeedChange = useCallback((speed: BotSpeed) => {
    setBotSpeed(speed);
    saveBotSpeed(speed);
  }, []);

  // Bot starting position selection
  useEffect(() => {
    if (!state || state.gamePhase !== 'chooseStartingPosition') return;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.controllerType !== 'bot') return;

    const pos = getBotStartingPosition(state);
    if (!pos) return;

    const timer = setTimeout(() => {
      setState(selectStartingPosition(state, pos.row, pos.col));
    }, timing.startingPositionDelayMs);
    return () => clearTimeout(timer);
  }, [state?.gamePhase, state?.currentPlayerIndex, state?.players, timing.startingPositionDelayMs]);

  // Bot turn automation
  useEffect(() => {
    if (!state || state.gamePhase !== 'playing') return;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.controllerType !== 'bot' || currentPlayer.isHome || currentPlayer.skipNextTurn) {
      return;
    }
    const lastMoveFrom = botLastMoveFromRef.current[currentPlayer.id] ?? null;
    const action = getBotAction(state, currentPlayer.id, lastMoveFrom);
    if (!action) return;

    const executeBotAction = () => {
      if (!state) return;
      let nextState = state;
      if (action.type === 'goHome') {
        nextState = appendToTurnLog(nextState, action.logMessage);
        nextState = goHome(nextState);
      } else if (action.type === 'move' && action.targetTile) {
        const fromPos = state.players[state.currentPlayerIndex].pawnPosition;
        if (fromPos) {
          botLastMoveFromRef.current[currentPlayer.id] = {
            from: { row: fromPos.row, col: fromPos.column },
            roundNumber: state.roundNumber,
          };
        }
        nextState = selectAction(nextState, 'move');
        nextState = move(nextState, action.targetTile.row, action.targetTile.col);
      } else if (action.type === 'playItem' && action.item) {
        if (action.targetTile) {
          nextState = playItem(nextState, action.item, {
            row: action.targetTile.row,
            col: action.targetTile.col,
          });
        } else {
          nextState = playItem(nextState, action.item);
        }
      }
      setState(nextState);
    };

    const delay = state.lastAffectedPlayerIds?.length
      ? timing.afterAffectedDelayMs
      : timing.afterMoveDelayMs;
    botTurnTimeoutRef.current = setTimeout(executeBotAction, delay);
    return () => {
      if (botTurnTimeoutRef.current) clearTimeout(botTurnTimeoutRef.current);
    };
  }, [state?.currentPlayerIndex, state?.gamePhase, state?.players, state?.board, botSpeed]);

  const handleTileClick = useCallback(
    (row: number, col: number) => {
      if (!state) return;
      if (state.gamePhase === 'chooseStartingPosition') {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (currentPlayer.controllerType === 'human') {
          setState(selectStartingPosition(state, row, col));
        }
        return;
      }
      if (state.gamePhase !== 'playing') return;
      const action = state.selectedAction;
      if (action === 'move') {
        setState(move(state, row, col));
      } else if (pendingItem) {
        if (pendingItem.type === 'Shortcut') {
          setState(playItem(state, pendingItem, { row, col }));
          setPendingItem(null);
        } else if (pendingItem.type === 'NaughtyKid' || pendingItem.type === 'Flashlight') {
          setState(playItem(state, pendingItem, { row, col }));
          setPendingItem(null);
        }
      }
    },
    [state, pendingItem]
  );

  const handlePlayItem = useCallback(
    (item: ItemCard) => {
      if (!state) return;
      if (item.type === 'Shortcut' || item.type === 'NaughtyKid' || item.type === 'Flashlight') {
        setPendingItem(item);
        setState({ ...state, message: `Choose target for ${item.type}` });
      } else {
        setState(playItem(state, item));
      }
    },
    [state]
  );

  if (!state) {
    return (
      <div className="app setup-screen">
        <header className="setup-header">
          <h1>Trick or Treat v0.5</h1>
          <button type="button" className="rules-btn" onClick={() => setShowRules(true)}>
            Rules
          </button>
        </header>
        <div className="setup-form">
          <label>
            Players: {playerCount}
            <input
              type="range"
              min={2}
              max={4}
              value={playerCount}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setPlayerCount(n);
                setCostumes((prev) => {
                  const next = [...prev];
                  while (next.length < n) {
                    next.push(COSTUMES[next.length % COSTUMES.length]);
                  }
                  return next.slice(0, n);
                });
                setControllerTypes((prev) => {
                  const next = [...prev];
                  while (next.length < n) next.push('human');
                  return next.slice(0, n);
                });
              }}
            />
          </label>
          {Array.from({ length: playerCount }, (_, i) => (
            <div key={i} className="player-setup-row">
              <label>
                Seat {i + 1}:
                <select
                  value={controllerTypes[i] || 'human'}
                  onChange={(e) => {
                    const v = e.target.value as ControllerType;
                    setControllerTypes((prev) => {
                      const next = [...prev];
                      next[i] = v;
                      return next;
                    });
                  }}
                >
                  <option value="human">Human</option>
                  <option value="bot">Bot</option>
                </select>
              </label>
              <label>
                Costume:
                <select
                  value={costumes[i] || COSTUMES[0]}
                  onChange={(e) => {
                    const v = e.target.value as CostumeType;
                    setCostumes((prev) => {
                      const next = [...prev];
                      next[i] = v;
                      return next;
                    });
                  }}
                >
                  {COSTUMES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          <p className="setup-hint">
            At least one human required. Examples: 1 human + 3 bots, 2 humans + 2 bots, 4 humans.
          </p>
          <button
            type="button"
            onClick={startGame}
            disabled={!controllerTypes.some((c) => c === 'human')}
          >
            Start Game
          </button>
        </div>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  if (state.gamePhase === 'gameOver') {
    const scores = getFinalScores(state);
    return (
      <div className="app game-over">
        <header className="game-over-header">
          <h1>Game Over!</h1>
          <button type="button" className="rules-btn" onClick={() => setShowRules(true)}>
            Rules
          </button>
        </header>
        <div className="scores">
          {scores.map((s, i) => (
            <div key={s.playerId} className="score-row">
              #{i + 1} {s.name}: {s.score} pts
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setState(null)}>
          New Game
        </button>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  if (state.gamePhase === 'chooseStartingPosition') {
    const choosingPlayer = state.players[state.currentPlayerIndex];
    const isHumanChoosing = choosingPlayer.controllerType === 'human';
    return (
      <div className="app app--game-view">
        <header className="app-header">
          <h1 className="app-title">Trick or Treat v0.5</h1>
          <p className="round-info">
            Neighborhood {state.roundNumber + 1}/3 • Choose starting houses
          </p>
          <button type="button" className="rules-btn" onClick={() => setShowRules(true)}>
            Rules
          </button>
          <p className="message">
            {isHumanChoosing
              ? `${choosingPlayer.name}, click a house in the first row to start`
              : `${choosingPlayer.name} is choosing...`}
          </p>
        </header>
        <div className="app-main">
          <aside className="sidebar-left">
            <div className="player-panels">
              {state.players.map((player, i) => (
                <PlayerPanel
                  key={player.id}
                  player={player}
                  playerIndex={i}
                  isCurrent={player.id === choosingPlayer.id}
                  color={PLAYER_COLORS[i]}
                  showHand={showAllHands || player.controllerType === 'human'}
                  isAffected={false}
                />
              ))}
            </div>
            <div className="turn-log turn-log--secondary">
              <h3>Move History</h3>
              <ul />
            </div>
            <div className="bot-speed-control">
              <span className="bot-speed-label">Bot Speed</span>
              <div className="bot-speed-buttons" role="group" aria-label="Bot speed">
                {(['fast', 'normal', 'slow'] as const).map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className={`bot-speed-btn ${botSpeed === speed ? 'active' : ''}`}
                    onClick={() => handleBotSpeedChange(speed)}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="dev-tools">
              <button type="button" onClick={() => setShowDevTools(!showDevTools)} className="dev-toggle">
                {showDevTools ? 'Hide' : 'Show'} Dev Tools
              </button>
              {showDevTools && (
                <div className="dev-panel">
                  <label className="dev-toggle-label">
                    <input
                      type="checkbox"
                      checked={showAllHands}
                      onChange={(e) => setShowAllHands(e.target.checked)}
                    />
                    Show All Hands
                  </label>
                </div>
              )}
            </div>
          </aside>
          <main className="board-main">
            <div className="board-and-controls">
              <div className="board-area">
                <div className="neighborhood-board">
                  <div className="neighborhood-decor neighborhood-pumpkins" aria-hidden="true">🎃</div>
                  <div className="neighborhood-decor neighborhood-bats" aria-hidden="true">🦇</div>
                  <Board
                    state={state}
                    onTileClick={handleTileClick}
                    devRevealAll={devRevealAllTiles}
                    playerColors={PLAYER_COLORS}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  if (state.gamePhase === 'roundEnd') {
    return (
      <div className="app">
        <header className="header header--with-rules">
          <h1>Trick or Treat v0.5</h1>
          <button type="button" className="rules-btn" onClick={() => setShowRules(true)}>
            Rules
          </button>
        </header>
        <RoundEndSummary
          state={state}
          onContinue={() => {
            botLastMoveFromRef.current = {};
            setState(startNextNeighborhood(state));
          }}
        />
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = currentPlayer.controllerType === 'human';
  const canAct = isHumanTurn && !currentPlayer.isHome && !currentPlayer.skipNextTurn;
  const currentPlayerColor = PLAYER_COLORS[state.currentPlayerIndex] ?? '#fff';

  // Live status: consequence message takes priority when present, else last turn log
  const lastLogEntry = state.turnLog[state.turnLog.length - 1];
  const consequenceMsg = state.lastConsequenceMessage;
  const liveStatusText =
    canAct && isHumanTurn
      ? 'Your Turn — choose an adjacent house to move'
      : !canAct && isHumanTurn
        ? `${currentPlayer.name}'s Turn`
        : !isHumanTurn && !lastLogEntry && !consequenceMsg
          ? `${currentPlayer.name} (Bot)'s Turn — deciding…`
          : consequenceMsg
            ? formatTurnLogWithIcons(consequenceMsg)
            : lastLogEntry
              ? formatTurnLogWithIcons(lastLogEntry)
              : `${currentPlayer.name}'s Turn`;

  return (
    <div className="app app--game-view">
      <header className="app-header">
        <h1 className="app-title">Trick or Treat v0.5</h1>
        <p className="round-info">
          Neighborhood {state.roundNumber + 1}/3 • Candy: {state.candySupply}
        </p>
        <button type="button" className="rules-btn" onClick={() => setShowRules(true)}>
          Rules
        </button>
        <p className="message">{state.message}</p>
      </header>

      <div className="app-main">
        <aside className="sidebar-left">
          <div className="player-panels">
            {state.players.map((player, i) => (
              <PlayerPanel
                key={player.id}
                player={player}
                playerIndex={i}
                isCurrent={player.id === currentPlayer.id}
                color={PLAYER_COLORS[i]}
                turnJustChanged={turnJustChanged && player.id === currentPlayer.id}
                onPlayItem={handlePlayItem}
                canPlayItem={
                  canAct &&
                  state.selectedAction === 'playItem' &&
                  player.id === currentPlayer.id
                }
                showHand={showAllHands || player.controllerType === 'human'}
                isAffected={state.lastAffectedPlayerIds?.includes(player.id) ?? false}
              />
            ))}
          </div>
          <div className="turn-log turn-log--secondary">
            <h3>Move History</h3>
            {state.lastActionDescription && state.lastAffectedPlayerIds && state.lastAffectedPlayerIds.length > 0 && (
              <p className="turn-log-affected">{state.lastActionDescription}</p>
            )}
            <ul>
              {state.turnLog.slice(-12).map((msg, i) => (
                <li key={i}>{formatTurnLogWithIcons(msg)}</li>
              ))}
            </ul>
          </div>
          <div className="bot-speed-control">
            <span className="bot-speed-label">Bot Speed</span>
            <div className="bot-speed-buttons" role="group" aria-label="Bot speed">
              {(['fast', 'normal', 'slow'] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`bot-speed-btn ${botSpeed === speed ? 'active' : ''}`}
                  onClick={() => handleBotSpeedChange(speed)}
                >
                  {speed.charAt(0).toUpperCase() + speed.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="dev-tools">
            <button
              type="button"
              onClick={() => setShowDevTools(!showDevTools)}
              className="dev-toggle"
            >
              {showDevTools ? 'Hide' : 'Show'} Dev Tools
            </button>
            {showDevTools && (
              <div className="dev-panel">
                <label className="dev-toggle-label">
                  <input
                    type="checkbox"
                    checked={showAllHands}
                    onChange={(e) => setShowAllHands(e.target.checked)}
                  />
                  Show All Hands
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (devRevealAllTiles) {
                      setState(devHideAllTiles(state));
                    } else {
                      setState(devRevealAll(state));
                    }
                    setDevRevealAllTiles(!devRevealAllTiles);
                  }}
                >
                  {devRevealAllTiles ? 'Hide' : 'Reveal'} All Tiles
                </button>
                {state.players.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setState(devAddCandy(state, p.id, 5))}
                  >
                    +5 candy to {p.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setState(devSkipToMansion(state))}
                >
                  Skip to Mansion Row
                </button>
                <button
                  type="button"
                  onClick={() => setState(devRestartNeighborhood(state))}
                >
                  Restart Neighborhood
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="board-main">
          <div className="board-and-controls">
            <div
              className="live-status-banner"
              style={
                {
                  '--turn-player-color': currentPlayerColor,
                  '--turn-glow': currentPlayerColor + '99',
                } as React.CSSProperties
              }
              aria-live="polite"
              key={`${state.currentPlayerIndex}-${state.turnLog.length}`}
            >
              <span className="live-status-costume">{getCostumeIcon(currentPlayer.costume)}</span>
              <span className="live-status-text">{liveStatusText}</span>
            </div>
            <div className="board-area">
              <div className="neighborhood-board">
                <div className="neighborhood-decor neighborhood-pumpkins" aria-hidden="true">🎃</div>
                <div className="neighborhood-decor neighborhood-bats" aria-hidden="true">🦇</div>
                <Board
                  state={state}
                  onTileClick={handleTileClick}
                  devRevealAll={devRevealAllTiles}
                  playerColors={PLAYER_COLORS}
                />
              </div>
            </div>
            <div className={`controls ${canAct ? 'controls--human-turn' : ''}`}>
              {canAct && (
                <>
                  <button
                    type="button"
                    onClick={() => setState(selectAction(state, 'move'))}
                    className={state.selectedAction === 'move' ? 'active' : ''}
                  >
                    Move
                  </button>
                  <button type="button" onClick={() => setState(goHome(state))}>
                    Go Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setState(selectAction(state, 'playItem'))}
                    className={state.selectedAction === 'playItem' ? 'active' : ''}
                  >
                    Play Item
                  </button>
                  <button type="button" onClick={() => setState(endTurn(state))}>
                    End Turn
                  </button>
                  {!pendingItem && (
                    <span className="controls-hint">
                      {state.selectedAction === 'move' && 'Choose an adjacent house to move'}
                      {state.selectedAction === 'playItem' && 'Select an item to play'}
                    </span>
                  )}
                </>
              )}
              {pendingItem && (
                <span className="pending-hint">Choose tile for {pendingItem.type}</span>
              )}
            </div>
          </div>
        </main>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {(state.lastRevealedItem || state.lastRevealedCandy) && (
          <CollectibleFlyAnimation
            lastRevealedItem={state.lastRevealedItem ?? null}
            lastRevealedCandy={state.lastRevealedCandy ?? null}
          />
        )}
        {state.lastWitchSwap && (
          <WitchSwapAnimation
            fromPlayerIndex={state.lastWitchSwap.fromPlayerIndex}
            toPlayerIndex={state.lastWitchSwap.toPlayerIndex}
          />
        )}
        {state.lastGoblinTheft && (
          <GoblinTheftAnimation
            fromPlayerIndex={state.lastGoblinTheft.fromPlayerIndex}
            toPlayerIndex={state.lastGoblinTheft.toPlayerIndex}
            itemType={state.lastGoblinTheft.itemType}
          />
        )}
        {state.lastCandyDeltas?.map((d, i) => (
          <CandyDeltaIndicator key={i} playerIndex={d.playerIndex} delta={d.delta} />
        ))}
      </div>
    </div>
  );
}
