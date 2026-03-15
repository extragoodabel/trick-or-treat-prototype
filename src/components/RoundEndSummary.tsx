import type { GameState } from '../game/types';

interface RoundEndSummaryProps {
  state: GameState;
  onContinue: () => void;
}

export function RoundEndSummary({ state, onContinue }: RoundEndSummaryProps) {
  const isFinalRound = state.roundNumber + 1 >= state.totalRounds;
  const recapLines = state.turnLog.slice(-8);

  return (
    <div className="round-end-overlay">
      <div className="round-end-modal">
        <h2>Neighborhood {state.roundNumber + 1} Complete</h2>
        <p className="round-end-reason">{state.message}</p>

        <div className="round-end-players">
          <h3>Player Results</h3>
          {state.players.map((p) => (
            <div key={p.id} className="round-end-player-row">
              <span className="player-name">{p.name}</span>
              <span className="player-candy">🏦 {p.bankedCandy} banked</span>
              <span className="player-items">📦 {p.itemCards.length} items</span>
              <span className="player-status">
                {p.isHome ? '🏠 Went home safely' : '⚠️ Still out when Ender appeared'}
              </span>
            </div>
          ))}
        </div>

        {recapLines.length > 0 && (
          <div className="round-end-recap">
            <h3>Final Events</h3>
            <ul>
              {recapLines.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="round-end-continue" onClick={onContinue}>
          {isFinalRound ? 'See Final Scores' : 'Start Next Neighborhood'}
        </button>
      </div>
    </div>
  );
}
