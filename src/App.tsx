import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState } from './game/types';
import {
  createNewGame,
  selectAction,
  goHome,
  move,
  playItem,
  resolveFlashlightReveal,
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
import { EnderRevealOverlay } from './components/EnderRevealOverlay';
import type { ItemCard } from './game/types';
import { formatTurnLogWithIcons } from './utils/formatTurnLog';
import { getCostumeIcon } from './game/icons';
import {
  type BotSpeed,
  BOT_TIMING_PRESETS,
  loadBotSpeed,
  saveBotSpeed,
} from './config/botTiming';
import { SetupScreen } from './components/SetupScreen';
import { DEFAULT_GAME_CONFIG, type GameConfig } from './game/gameConfig';
import './App.css';

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [devRevealAllTiles, setDevRevealAllTiles] = useState(false);
  const [showAllHands, setShowAllHands] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showMoveLog, setShowMoveLog] = useState(false);
  const [botSpeed, setBotSpeed] = useState<BotSpeed>(loadBotSpeed);
  const [pendingItem, setPendingItem] = useState<ItemCard | null>(null);
  const [showRules, setShowRules] = useState(false);
  const botTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botLastMoveFromRef = useRef<Record<string, BotMoveHistory>>({});
  const animationClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [turnJustChanged, setTurnJustChanged] = useState(false);
  const prevPlayerIndexRef = useRef<number>(0);
  const [enderMomentComplete, setEnderMomentComplete] = useState(false);
  const prevEnderRevealRef = useRef(false);

  // Ender reveal: reset moment flag only when first entering roundEnd with lastEnderReveal
  useEffect(() => {
    const nowEnder = state?.gamePhase === 'roundEnd' && !!state?.lastOldManJohnsonReveal;
    if (nowEnder && !prevEnderRevealRef.current) {
      setEnderMomentComplete(false);
      prevEnderRevealRef.current = true;
    }
    if (!nowEnder) prevEnderRevealRef.current = false;
  }, [state?.gamePhase, state?.lastOldManJohnsonReveal]);

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
    const gameState = createNewGame(gameConfig);
    setState(gameState);
    setPendingItem(null);
    botLastMoveFromRef.current = {};
  }, [gameConfig]);

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

  // Flashlight phased sequence: beam 400ms → reveal 1100ms → resolve (~1.5s total)
  const FLASHLIGHT_BEAM_MS = 400;
  const FLASHLIGHT_REVEAL_MS = 1100;
  const FLASHLIGHT_TOTAL_MS = FLASHLIGHT_BEAM_MS + FLASHLIGHT_REVEAL_MS;
  const flashlightRevealIdRef = useRef<string | null>(null);
  useEffect(() => {
    const fr = state?.flashlightReveal;
    if (!fr) {
      flashlightRevealIdRef.current = null;
      return;
    }
    // Include phase in id so we don't skip setting up the resolve timer when phase changes to 'reveal'
    const id = `${fr.row}-${fr.col}-${fr.phase}`;
    if (flashlightRevealIdRef.current === id) return;
    flashlightRevealIdRef.current = id;

    if (fr.phase === 'beam') {
      const id1 = setTimeout(() => {
        setState((s) => {
          if (!s?.flashlightReveal || s.flashlightReveal.phase !== 'beam') return s;
          const card = s.flashlightReveal.card;
          let revealMsg = 'Revealed!';
          if (card.type === 'CandyBucket') revealMsg = 'Candy Bucket revealed!';
          else if (card.type === 'Monster') revealMsg = `${card.monsterType ?? 'Monster'} revealed!`;
          else if (card.type === 'Item') revealMsg = 'Item revealed!';
          return {
            ...s,
            message: revealMsg,
            flashlightReveal: { ...s.flashlightReveal, phase: 'reveal' as const },
          };
        });
      }, FLASHLIGHT_BEAM_MS);
      const id2 = setTimeout(() => {
        flashlightRevealIdRef.current = null;
        setState((s) => (s ? resolveFlashlightReveal(s) : s));
      }, FLASHLIGHT_TOTAL_MS);
      return () => {
        clearTimeout(id1);
        clearTimeout(id2);
      };
    } else {
      // phase === 'reveal': set up resolve timer (effect re-ran because phase changed; previous timers were cleared)
      const id2 = setTimeout(() => {
        flashlightRevealIdRef.current = null;
        setState((s) => (s ? resolveFlashlightReveal(s) : s));
      }, FLASHLIGHT_REVEAL_MS);
      return () => clearTimeout(id2);
    }
  }, [state?.flashlightReveal]);

  // Bot turn automation
  useEffect(() => {
    if (!state || state.gamePhase !== 'playing') return;
    if (state.flashlightReveal) return;
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
      if (state.flashlightReveal) return;
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
        } else if (pendingItem.type === 'IntrusiveThoughts' || pendingItem.type === 'Flashlight' || pendingItem.type === 'Binoculars') {
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
      const targetedTypes = ['Shortcut', 'IntrusiveThoughts', 'Flashlight', 'Binoculars'];
      const needsTarget = targetedTypes.includes(item.type);
      if (needsTarget) {
        if (pendingItem?.id === item.id) {
          setPendingItem(null);
          setState(selectAction(state, 'move'));
          return;
        }
        setPendingItem(item);
        setState({ ...selectAction(state, 'playItem'), message: `Choose target for ${item.type}` });
      } else {
        setState(playItem(state, item));
      }
    },
    [state, pendingItem]
  );

  if (!state) {
    return (
      <>
        <SetupScreen
          config={gameConfig}
          onConfigChange={setGameConfig}
          onStartGame={startGame}
          onShowRules={() => setShowRules(true)}
        />
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </>
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
        {state.message && (
          <p className="game-over-message">{state.message}</p>
        )}
        <div className="scores">
          {scores.map((s, i) => (
            <div key={s.playerId} className="score-row">
              #{i + 1} {s.name}: {Number.isFinite(s.score) ? s.score : 0} pts
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
            Neighborhood {state.roundNumber + 1}/{state.totalRounds} • Choose starting houses
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
                  color={state.playerColors[i]}
                  showHand={showAllHands || player.controllerType === 'human' || player.handRevealed}
                  isAffected={false}
                />
              ))}
            </div>
            <div className="turn-log turn-log--secondary turn-log--collapsible">
              <button
                type="button"
                className="turn-log-toggle"
                onClick={() => setShowMoveLog((v) => !v)}
                aria-expanded={showMoveLog}
              >
                <span className="turn-log-toggle-label">Move History</span>
                <span className="turn-log-toggle-latest">—</span>
                <span className="turn-log-toggle-icon">{showMoveLog ? '▼' : '▶'}</span>
              </button>
              {showMoveLog && (
                <div className="turn-log-content">
                  <ul />
                </div>
              )}
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
                    playerColors={state.playerColors}
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
    const showEnderMoment = state.lastOldManJohnsonReveal && !enderMomentComplete;
    if (!showEnderMoment) {
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
    // Fall through to render game view with Ender reveal overlay
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = currentPlayer.controllerType === 'human';
  const isFlashlightReveal = !!state.flashlightReveal;
  const canAct = isHumanTurn && !currentPlayer.isHome && !currentPlayer.skipNextTurn && !isFlashlightReveal;
  const currentPlayerColor = state.playerColors[state.currentPlayerIndex] ?? '#fff';
  const isEnderRevealMoment =
    state.gamePhase === 'roundEnd' && !!state.lastOldManJohnsonReveal && !enderMomentComplete;

  // Live status: flashlight message during reveal, else consequence, else last turn log
  const lastLogEntry = state.turnLog[state.turnLog.length - 1];
  const consequenceMsg = state.lastConsequenceMessage;
  const liveStatusText =
    isFlashlightReveal
      ? formatTurnLogWithIcons(state.message)
      : canAct && isHumanTurn
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
    <div className={`app app--game-view${isEnderRevealMoment ? ' app--ender-reveal' : ''}`}>
      <header className="app-header">
        <h1 className="app-title">Trick or Treat v0.5</h1>
        <p className="round-info">
          Neighborhood {state.roundNumber + 1}/{state.totalRounds} • Candy: {state.candySupply}
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
                color={state.playerColors[i]}
                turnJustChanged={turnJustChanged && player.id === currentPlayer.id}
                onPlayItem={handlePlayItem}
                canPlayItem={canAct && player.id === currentPlayer.id}
                selectedItem={player.id === currentPlayer.id ? pendingItem : null}
                showHand={showAllHands || player.controllerType === 'human' || player.handRevealed}
                isAffected={state.lastAffectedPlayerIds?.includes(player.id) ?? false}
                isGoblinVictim={!!(state.lastGoblinTheft && state.lastGoblinTheft.fromPlayerIndex === i)}
                isGoblinThief={!!(state.lastGoblinTheft && state.lastGoblinTheft.toPlayerIndex === i)}
                isWitchSwapParticipant={!!(state.lastWitchSwap && (state.lastWitchSwap.fromPlayerIndex === i || state.lastWitchSwap.toPlayerIndex === i))}
              />
            ))}
          </div>
          <div className="turn-log turn-log--secondary turn-log--collapsible">
            <button
              type="button"
              className="turn-log-toggle"
              onClick={() => setShowMoveLog((v) => !v)}
              aria-expanded={showMoveLog}
            >
              <span className="turn-log-toggle-label">Move History</span>
              <span className="turn-log-toggle-latest">
                {state.turnLog[state.turnLog.length - 1]
                  ? formatTurnLogWithIcons(state.turnLog[state.turnLog.length - 1])
                  : '—'}
              </span>
              <span className="turn-log-toggle-icon">{showMoveLog ? '▼' : '▶'}</span>
            </button>
            {showMoveLog && (
              <div className="turn-log-content">
                {state.lastActionDescription && state.lastAffectedPlayerIds && state.lastAffectedPlayerIds.length > 0 && (
                  <p className="turn-log-affected">{state.lastActionDescription}</p>
                )}
                <ul>
                  {state.turnLog.slice(-12).map((msg, i) => (
                    <li key={i}>{formatTurnLogWithIcons(msg)}</li>
                  ))}
                </ul>
              </div>
            )}
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
            <div className={`board-area${isEnderRevealMoment ? ' board-area--ender-shake' : ''}`}>
              <div className="neighborhood-board">
                <div className="neighborhood-decor neighborhood-pumpkins" aria-hidden="true">🎃</div>
                <div className="neighborhood-decor neighborhood-bats" aria-hidden="true">🦇</div>
                <Board
                  state={state}
                  onTileClick={handleTileClick}
                  devRevealAll={devRevealAllTiles}
                  playerColors={state.playerColors}
                  pendingItem={pendingItem}
                />
              </div>
            </div>
            <div className={`controls ${canAct ? 'controls--human-turn' : ''}`}>
              {canAct && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingItem(null);
                      setState(selectAction(state, 'move'));
                    }}
                    className={state.selectedAction === 'move' ? 'active' : ''}
                  >
                    Move
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingItem(null);
                      setState(goHome(state));
                    }}
                  >
                    Go Home
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingItem(null);
                      setState(selectAction(state, 'playItem'));
                    }}
                    className={state.selectedAction === 'playItem' ? 'active' : ''}
                  >
                    Play Item
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingItem(null);
                      setState(endTurn(state));
                    }}
                  >
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
        {isEnderRevealMoment && (
          <EnderRevealOverlay onComplete={() => setEnderMomentComplete(true)} />
        )}
      </div>
    </div>
  );
}
