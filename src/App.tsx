import { useState, useCallback, useEffect, useRef } from 'react';
import type { GameState, CostumeType, ControllerType } from './game/types';
import {
  createNewGame,
  selectAction,
  goHome,
  moveAndFlip,
  moveAndResolve,
  playItem,
  endTurn,
  startNextNeighborhood,
  appendToTurnLog,
  devRevealAll,
  devAddCandy,
  devSkipToMansion,
  devRestartNeighborhood,
  getFinalScores,
} from './game/gameEngine';
import { getBotAction } from './bots/botLogic';
import { Board } from './components/Board';
import { PlayerPanel } from './components/PlayerPanel';
import { RoundEndSummary } from './components/RoundEndSummary';
import type { ItemCard } from './game/types';
import './App.css';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
const COSTUMES: CostumeType[] = ['Ghost', 'Zombie', 'Witch', 'Skeleton', 'Werewolf', 'Goblin'];
const BOT_TURN_DELAY_MS = 800;

export default function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [playerCount, setPlayerCount] = useState(2);
  const [costumes, setCostumes] = useState<CostumeType[]>(['Ghost', 'Zombie']);
  const [controllerTypes, setControllerTypes] = useState<ControllerType[]>(['human', 'bot']);
  const [devRevealAllTiles, setDevRevealAllTiles] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [pendingItem, setPendingItem] = useState<ItemCard | null>(null);
  const botTurnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGame = useCallback(() => {
    const gameState = createNewGame(playerCount, costumes as string[], controllerTypes);
    setState(gameState);
    setPendingItem(null);
  }, [playerCount, costumes, controllerTypes]);

  // Bot turn automation
  useEffect(() => {
    if (!state || state.gamePhase !== 'playing') return;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.controllerType !== 'bot' || currentPlayer.isHome || currentPlayer.skipNextTurn) {
      return;
    }
    const action = getBotAction(state, currentPlayer.id);
    if (!action) return;

    const executeBotAction = () => {
      if (!state) return;
      let nextState = appendToTurnLog(state, action.logMessage);
      if (action.type === 'goHome') {
        nextState = goHome(nextState);
      } else if (action.type === 'moveFlip' && action.targetTile) {
        nextState = selectAction(nextState, 'moveFlip');
        nextState = moveAndFlip(nextState, action.targetTile.row, action.targetTile.col);
      } else if (action.type === 'moveResolve' && action.targetTile) {
        nextState = selectAction(nextState, 'moveResolve');
        nextState = moveAndResolve(nextState, action.targetTile.row, action.targetTile.col);
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

    botTurnTimeoutRef.current = setTimeout(executeBotAction, BOT_TURN_DELAY_MS);
    return () => {
      if (botTurnTimeoutRef.current) clearTimeout(botTurnTimeoutRef.current);
    };
  }, [state?.currentPlayerIndex, state?.gamePhase, state?.players, state?.board]);

  const handleTileClick = useCallback(
    (row: number, col: number) => {
      if (!state || state.gamePhase !== 'playing') return;
      const action = state.selectedAction;
      if (action === 'moveFlip') {
        setState(moveAndFlip(state, row, col));
      } else if (action === 'moveResolve') {
        setState(moveAndResolve(state, row, col));
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
        <h1>Trick or Treat v0.5</h1>
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
      </div>
    );
  }

  if (state.gamePhase === 'gameOver') {
    const scores = getFinalScores(state);
    return (
      <div className="app game-over">
        <h1>Game Over!</h1>
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
      </div>
    );
  }

  if (state.gamePhase === 'roundEnd') {
    return (
      <div className="app">
        <header className="header">
          <h1>Trick or Treat v0.5</h1>
        </header>
        <RoundEndSummary
          state={state}
          onContinue={() => setState(startNextNeighborhood(state))}
        />
      </div>
    );
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isHumanTurn = currentPlayer.controllerType === 'human';
  const canAct = isHumanTurn && !currentPlayer.isHome && !currentPlayer.skipNextTurn;

  return (
    <div className="app">
      <header className="header">
        <h1>Trick or Treat v0.5</h1>
        <p className="round-info">
          Neighborhood {state.roundNumber + 1}/3 • Candy supply: {state.candySupply}
        </p>
        <p className="message">{state.message}</p>
      </header>

      {state.turnLog.length > 0 && (
        <div className="turn-log">
          <h3>Turn Log</h3>
          <ul>
            {state.turnLog.slice(-12).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="game-layout">
        <div className="player-panels">
          {state.players.map((player, i) => (
            <PlayerPanel
              key={player.id}
              player={player}
              isCurrent={player.id === currentPlayer.id}
              color={PLAYER_COLORS[i]}
              onPlayItem={handlePlayItem}
              canPlayItem={
                canAct &&
                state.selectedAction === 'playItem' &&
                player.id === currentPlayer.id
              }
            />
          ))}
        </div>

        <div className="board-area">
          <Board
            state={state}
            onTileClick={handleTileClick}
            devRevealAll={devRevealAllTiles}
          />
        </div>
      </div>

      <div className="controls">
        {canAct && (
          <>
            <button
              type="button"
              onClick={() => setState(selectAction(state, 'moveFlip'))}
              className={state.selectedAction === 'moveFlip' ? 'active' : ''}
            >
              Move & Flip
            </button>
            <button
              type="button"
              onClick={() => setState(selectAction(state, 'moveResolve'))}
              className={state.selectedAction === 'moveResolve' ? 'active' : ''}
            >
              Move & Resolve
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
          </>
        )}
        {pendingItem && (
          <span className="pending-hint">Choose tile for {pendingItem.type}</span>
        )}
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
            <button
              type="button"
              onClick={() => {
                setDevRevealAllTiles(!devRevealAllTiles);
                if (!devRevealAllTiles) setState(devRevealAll(state));
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
    </div>
  );
}
