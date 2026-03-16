import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState } from './game/types';
import {
  createNewGame,
  selectAction,
  goHome,
  move,
  playItem,
  discardItem,
  resolveFlashlightReveal,
  resolveMonsterEncounter,
  addBinocularsSelection,
  completeBinocularsReveal,
  endTurn,
  startNextNeighborhood,
  selectStartingPosition,
  advancePastSkippedPlayer,
  appendToTurnLog,
  devRevealAll,
  devHideAllTiles,
  devAddCandy,
  devSkipToMansion,
  devRestartNeighborhood,
  getFinalScores,
} from './game/gameEngine';
import { getBotAction, getBotStartingPosition, BOT_PATH_HISTORY_MAX, type BotMoveHistory, type BotPathHistory } from './bots/botLogic';
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
import {
  type BotSpeed,
  type BotProfile,
  BOT_TIMING_PRESETS,
  loadBotSpeed,
  saveBotSpeed,
  loadBotIntelligence,
  saveBotIntelligence,
  loadBotProfile,
  saveBotProfile,
} from './config/botTiming';
import { SetupScreen } from './components/SetupScreen';
import { InfoPanel } from './components/InfoPanel';
import { useIsMobile } from './hooks/useIsMobile';
import { DEFAULT_GAME_CONFIG, type GameConfig } from './game/gameConfig';
import './App.css';

const BUTTON_INFO: Record<string, string> = {
  Move: 'Move to an adjacent house (including diagonals). If the tile is face-down, you flip it and resolve what you find.',
  GoHome: 'Go Home: bank your round candy permanently. You take no further turns this round. Your candy is safe.',
  PlayItem: 'Play Item: select an item from your hand to use. Some items need a target tile (Flashlight, Shortcut, etc.).',
  DiscardItem: 'Discard Item: select an item from your hand to discard. This counts as your action for the turn.',
  EndTurn: 'End Turn: pass your turn to the next player without moving or playing an item.',
  Rules: 'Opens the full game rules in a modal. Turn Info Mode OFF and tap Rules again to open them.',
};

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [gameConfig, setGameConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [devRevealAllTiles, setDevRevealAllTiles] = useState(false);
  const [showAllHands, setShowAllHands] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showMoveLog, setShowMoveLog] = useState(false);
  const [botSpeed, setBotSpeed] = useState<BotSpeed>(loadBotSpeed);
  const [useBotIntelligence, setUseBotIntelligence] = useState(loadBotIntelligence);
  const [botProfile, setBotProfile] = useState<BotProfile>(loadBotProfile);
  const [pendingItem, setPendingItem] = useState<ItemCard | null>(null);
  const [showRules, setShowRules] = useState(false);
  const botTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botLastMoveFromRef = useRef<Record<string, BotMoveHistory>>({});
  const botPathHistoryRef = useRef<Record<string, BotPathHistory>>({});
  const animationClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [turnJustChanged, setTurnJustChanged] = useState(false);
  const prevPlayerIndexRef = useRef<number>(0);
  const [enderMomentComplete, setEnderMomentComplete] = useState(false);
  const prevEnderRevealRef = useRef(false);
  const isMobile = useIsMobile();
  const [infoMode, setInfoMode] = useState(false);
  const [infoPanelContent, setInfoPanelContent] = useState<string | null>(null);

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
    if (canAct && state.selectedAction === null && !state.monsterEncountered) {
      setState({ ...state, selectedAction: 'move', message: `${currentPlayer.name}'s turn. Choose an adjacent house to move.` });
    }
  }, [state]);

  const startGame = useCallback(() => {
    const gameState = createNewGame(gameConfig);
    setState(gameState);
    setPendingItem(null);
    botLastMoveFromRef.current = {};
    botPathHistoryRef.current = {};
  }, [gameConfig]);

  const handleBotSpeedChange = useCallback((speed: BotSpeed) => {
    setBotSpeed(speed);
    saveBotSpeed(speed);
  }, []);

  const handleBotIntelligenceChange = useCallback((enabled: boolean) => {
    setUseBotIntelligence(enabled);
    saveBotIntelligence(enabled);
  }, []);

  const handleBotProfileChange = useCallback((profile: BotProfile) => {
    setBotProfile(profile);
    saveBotProfile(profile);
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

  // Binoculars reveal: show tiles for ~3 seconds, then consume item and advance turn
  const BINOCULARS_REVEAL_MS = 3000;
  useEffect(() => {
    const item = pendingItem?.type === 'Binoculars' ? pendingItem : state?.binocularsItemToConsume;
    if (!state?.binocularsReveal?.length || !item) return;
    const id = setTimeout(() => {
      setState((s) => (s ? completeBinocularsReveal(s, item) : s));
      setPendingItem(null);
    }, BINOCULARS_REVEAL_MS);
    return () => clearTimeout(id);
  }, [state?.binocularsReveal, state?.binocularsItemToConsume, pendingItem?.id]);

  // Advance past skipped players (e.g. Zombie on starting tile) to prevent freeze
  useEffect(() => {
    setState((s) => {
      if (!s || s.gamePhase !== 'playing' || s.flashlightReveal) return s;
      const cp = s.players[s.currentPlayerIndex];
      if (cp?.skipNextTurn) return advancePastSkippedPlayer(s);
      return s;
    });
  }, [state?.gamePhase, state?.currentPlayerIndex, state?.players, state?.flashlightReveal]);

  // Bot turn automation
  useEffect(() => {
    if (!state || state.gamePhase !== 'playing') return;
    if (state.flashlightReveal || state.binocularsReveal?.length) return;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.controllerType !== 'bot' || currentPlayer.isHome || currentPlayer.skipNextTurn) {
      return;
    }
    const lastMoveFrom = botLastMoveFromRef.current[currentPlayer.id] ?? null;
    const pathHistory = botPathHistoryRef.current[currentPlayer.id] ?? null;
    const action = getBotAction(state, currentPlayer.id, lastMoveFrom, {
      useSmartBots: useBotIntelligence,
      profile: botProfile,
      pathHistory,
    });
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
          const prev = botPathHistoryRef.current[currentPlayer.id];
          const moves = prev?.roundNumber === state.roundNumber ? prev.moves : [];
          const newMove = {
            from: { row: fromPos.row, col: fromPos.column },
            to: { row: action.targetTile!.row, col: action.targetTile!.col },
          };
          const updated = moves.slice(-(BOT_PATH_HISTORY_MAX - 1));
          updated.push(newMove);
          botPathHistoryRef.current[currentPlayer.id] = {
            roundNumber: state.roundNumber,
            moves: updated,
          };
        }
        nextState = selectAction(nextState, 'move');
        nextState = move(nextState, action.targetTile.row, action.targetTile.col);
      } else if (action.type === 'playItem' && action.item) {
        if (action.targetTiles && action.item.type === 'Binoculars') {
          for (const t of action.targetTiles) {
            nextState = addBinocularsSelection(nextState, t.row, t.col);
          }
          nextState = { ...nextState, binocularsItemToConsume: action.item };
        } else if (action.targetTile) {
          nextState = playItem(nextState, action.item, {
            row: action.targetTile.row,
            col: action.targetTile.col,
          });
        } else {
          nextState = playItem(nextState, action.item);
        }
      } else if (action.type === 'discardItem' && action.item) {
        nextState = discardItem(nextState, action.item);
      } else if (action.type === 'resolveMonsterEncounter') {
        nextState = resolveMonsterEncounter(nextState);
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
  }, [state?.currentPlayerIndex, state?.gamePhase, state?.players, state?.board, botSpeed, useBotIntelligence, botProfile]);

  const handleShowInfo = useCallback((content: string) => {
    setInfoPanelContent(content);
  }, []);

  const handleTileClick = useCallback(
    (row: number, col: number) => {
      if (!state) return;
      if (state.flashlightReveal) return;
      if (isMobile && infoMode) return; // Tile handles via onInfoClick
      if (state.gamePhase === 'chooseStartingPosition') {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (currentPlayer.controllerType === 'human') {
          setState(selectStartingPosition(state, row, col));
        }
        return;
      }
      if (state.gamePhase !== 'playing') return;
      if (state.binocularsReveal?.length) return; // No interaction during peek reveal
      const action = state.selectedAction;
      if (action === 'move') {
        setState(move(state, row, col));
      } else if (pendingItem) {
        if (pendingItem.type === 'Shortcut') {
          setState(playItem(state, pendingItem, { row, col }));
          setPendingItem(null);
        } else if (pendingItem.type === 'Binoculars') {
          if (!state.binocularsReveal) {
            setState(addBinocularsSelection(state, row, col));
          }
        } else if (pendingItem.type === 'IntrusiveThoughts' || pendingItem.type === 'Flashlight') {
          setState(playItem(state, pendingItem, { row, col }));
          setPendingItem(null);
        }
      }
    },
    [state, pendingItem, isMobile, infoMode]
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
        setState({
          ...selectAction(state, 'playItem'),
          message:
            item.type === 'Binoculars'
              ? 'Select two face-down houses to peek at.'
              : item.type === 'Flashlight'
                ? 'Select an adjacent house, or the monster you landed on to negate.'
                : `Choose target for ${item.type}`,
        });
      }
      // Non-targeted items (points-only, etc.) are not playable; use Discard Item to remove them
    },
    [state, pendingItem]
  );

  const handleDiscardItem = useCallback(
    (item: ItemCard) => {
      if (!state || state.selectedAction !== 'discardItem') return;
      setState(discardItem(state, item));
    },
    [state]
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
          <h1 className="app-title">Trick or Treat v0.9</h1>
          <p className="round-info">
            Neighborhood {state.roundNumber + 1}/{state.totalRounds} • Choose starting houses
          </p>
          {isMobile && (
            <button
              type="button"
              className={`info-mode-btn ${infoMode ? 'active' : ''}`}
              onClick={() => {
                setInfoMode((v) => !v);
                setInfoPanelContent(null);
              }}
              aria-pressed={infoMode}
            >
              {infoMode ? 'Info ✓' : 'Info'}
            </button>
          )}
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
                  infoMode={isMobile && infoMode}
                  onShowInfo={isMobile ? handleShowInfo : undefined}
                  disableTooltipHover={isMobile}
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
                  <label className="dev-toggle-label">
                    <input
                      type="checkbox"
                      checked={useBotIntelligence}
                      onChange={(e) => handleBotIntelligenceChange(e.target.checked)}
                    />
                    Smart Bots
                  </label>
                  {useBotIntelligence && (
                    <label className="dev-toggle-label">
                      <span>Profile:</span>
                      <select
                        value={botProfile}
                        onChange={(e) => handleBotProfileChange(e.target.value as BotProfile)}
                        style={{ marginLeft: '0.25rem' }}
                      >
                        <option value="greedy">Greedy</option>
                        <option value="cautious">Cautious</option>
                        <option value="aggressive">Aggressive</option>
                        <option value="comeback">Comeback</option>
                      </select>
                    </label>
                  )}
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
                    infoMode={isMobile && infoMode}
                    onShowInfo={isMobile ? handleShowInfo : undefined}
                    disableTooltipHover={isMobile}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
        {isMobile && infoPanelContent && (
          <InfoPanel content={infoPanelContent} onClose={() => setInfoPanelContent(null)} />
        )}
        {(state.lastRevealedItem || state.lastRevealedCandy) && (
          <CollectibleFlyAnimation
            lastRevealedItem={state.lastRevealedItem ?? null}
            lastRevealedCandy={state.lastRevealedCandy ?? null}
          />
        )}
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
            <h1>Trick or Treat v0.9</h1>
            <button type="button" className="rules-btn" onClick={() => setShowRules(true)}>
              Rules
            </button>
          </header>
          <RoundEndSummary
            state={state}
            onContinue={() => {
              botLastMoveFromRef.current = {};
    botPathHistoryRef.current = {};
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
  const isBinocularsReveal = !!state.binocularsReveal?.length;
  const canAct = isHumanTurn && !currentPlayer.isHome && !currentPlayer.skipNextTurn && !isFlashlightReveal && !isBinocularsReveal;
  const currentPlayerColor = state.playerColors[state.currentPlayerIndex] ?? '#fff';
  const isEnderRevealMoment =
    state.gamePhase === 'roundEnd' && !!state.lastOldManJohnsonReveal && !enderMomentComplete;

  // Live status: flashlight message during reveal, else monster encounter, else consequence, else last turn log
  const lastLogEntry = state.turnLog[state.turnLog.length - 1];
  const consequenceMsg = state.lastConsequenceMessage;
  const liveStatusText =
    isFlashlightReveal
      ? formatTurnLogWithIcons(state.message)
      : state.monsterEncountered && canAct
        ? 'Monster encountered! Use Flashlight to negate, or Face Monster to resolve.'
        : isBinocularsReveal
        ? 'Peeking…'
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
        <h1 className="app-title">Trick or Treat v0.9</h1>
        <p className="round-info">
          Neighborhood {state.roundNumber + 1}/{state.totalRounds} • Candy: {state.candySupply}
        </p>
        {isMobile && (
          <button
            type="button"
            className={`info-mode-btn ${infoMode ? 'active' : ''}`}
            onClick={() => {
              setInfoMode((v) => !v);
              setInfoPanelContent(null);
            }}
            aria-pressed={infoMode}
            title={infoMode ? 'Info Mode ON — taps explain' : 'Info Mode OFF — taps play'}
          >
            {infoMode ? 'Info ✓' : 'Info'}
          </button>
        )}
        <button
          type="button"
          className="rules-btn"
          onClick={() => {
            if (isMobile && infoMode) {
              setInfoPanelContent(BUTTON_INFO.Rules);
              return;
            }
            setShowRules(true);
          }}
        >
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
                canPlayItem={canAct && player.id === currentPlayer.id && state.selectedAction === 'playItem'}
                onDiscardItem={handleDiscardItem}
                canDiscardItem={canAct && player.id === currentPlayer.id && state.selectedAction === 'discardItem'}
                selectedItem={player.id === currentPlayer.id ? pendingItem : null}
                infoMode={isMobile && infoMode}
                onShowInfo={isMobile ? handleShowInfo : undefined}
                disableTooltipHover={isMobile}
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
                <label className="dev-toggle-label">
                  <input
                    type="checkbox"
                    checked={useBotIntelligence}
                    onChange={(e) => handleBotIntelligenceChange(e.target.checked)}
                  />
                  Smart Bots
                </label>
                {useBotIntelligence && (
                  <label className="dev-toggle-label">
                    <span>Profile:</span>
                    <select
                      value={botProfile}
                      onChange={(e) => handleBotProfileChange(e.target.value as BotProfile)}
                      style={{ marginLeft: '0.25rem' }}
                    >
                      <option value="greedy">Greedy</option>
                      <option value="cautious">Cautious</option>
                      <option value="aggressive">Aggressive</option>
                      <option value="comeback">Comeback</option>
                    </select>
                  </label>
                )}
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
              <span
                className="live-status-color"
                style={{ backgroundColor: currentPlayerColor }}
                aria-hidden="true"
              />
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
                  infoMode={isMobile && infoMode}
                  onShowInfo={isMobile ? handleShowInfo : undefined}
                  disableTooltipHover={isMobile}
                />
              </div>
            </div>
            <div className={`controls ${canAct ? 'controls--human-turn' : ''}`}>
              {canAct && state.monsterEncountered && (
                <>
                  <button
                    type="button"
                    className="controls-monster-continue"
                    onClick={() => {
                      setPendingItem(null);
                      setState(resolveMonsterEncounter(state));
                    }}
                  >
                    Face Monster
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile && infoMode) {
                        setInfoPanelContent(BUTTON_INFO.PlayItem);
                        return;
                      }
                      setPendingItem(null);
                      setState(selectAction(state, 'playItem'));
                    }}
                    className={state.selectedAction === 'playItem' ? 'active' : ''}
                  >
                    Play Item (Flashlight)
                  </button>
                </>
              )}
              {canAct && !state.monsterEncountered && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile && infoMode) {
                        setInfoPanelContent(BUTTON_INFO.Move);
                        return;
                      }
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
                      if (isMobile && infoMode) {
                        setInfoPanelContent(BUTTON_INFO.GoHome);
                        return;
                      }
                      setPendingItem(null);
                      setState(goHome(state));
                    }}
                  >
                    Go Home
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile && infoMode) {
                        setInfoPanelContent(BUTTON_INFO.PlayItem);
                        return;
                      }
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
                      if (isMobile && infoMode) {
                        setInfoPanelContent(BUTTON_INFO.DiscardItem);
                        return;
                      }
                      setPendingItem(null);
                      setState(
                        state.selectedAction === 'discardItem'
                          ? selectAction(state, 'move')
                          : selectAction(state, 'discardItem')
                      );
                    }}
                    className={state.selectedAction === 'discardItem' ? 'active' : ''}
                    disabled={!currentPlayer.itemCards.length}
                    title={!currentPlayer.itemCards.length ? 'No items to discard' : undefined}
                  >
                    Discard Item
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile && infoMode) {
                        setInfoPanelContent(BUTTON_INFO.EndTurn);
                        return;
                      }
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
                      {state.selectedAction === 'discardItem' && 'Select an item to discard'}
                    </span>
                  )}
                </>
              )}
              {canAct && state.monsterEncountered && (
                <span className="controls-hint">
                  Use Flashlight to negate, or Face Monster to resolve.
                </span>
              )}
              {pendingItem && (
                <span className="pending-hint">
                  {pendingItem.type === 'Binoculars'
                    ? (state.binocularsSelection?.length === 1
                        ? 'Select one more face-down house'
                        : 'Select two face-down houses to peek at')
                    : pendingItem.type === 'Flashlight'
                      ? (state.monsterEncountered
                          ? 'Select the monster you landed on to negate, or an adjacent house'
                          : 'Select an adjacent house to reveal/clear')
                      : `Choose tile for ${pendingItem.type}`}
                </span>
              )}
            </div>
          </div>
        </main>
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        {isMobile && infoPanelContent && (
          <InfoPanel content={infoPanelContent} onClose={() => setInfoPanelContent(null)} />
        )}
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
