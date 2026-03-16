import type { ControllerType } from '../game/types';
import { COLOR_NAMES, type GameConfig } from '../game/gameConfig';

const COLORS = ['Random', ...COLOR_NAMES];

interface SetupScreenProps {
  config: GameConfig;
  onConfigChange: (config: GameConfig) => void;
  onStartGame: () => void;
  onShowRules: () => void;
}

function getAvailableColors(config: GameConfig, excludePlayerIndex: number): string[] {
  const colors = config.colors ?? [];
  const chosen = new Set(
    colors
      .map((c, i) => (i !== excludePlayerIndex && c !== 'Random' ? c : null))
      .filter(Boolean)
  );
  return COLORS.filter((c) => c === 'Random' || !chosen.has(c));
}

export function SetupScreen({
  config,
  onConfigChange,
  onStartGame,
  onShowRules,
}: SetupScreenProps) {
  const updateConfig = (partial: Partial<GameConfig>) => {
    onConfigChange({ ...config, ...partial });
  };

  const setPlayerCount = (n: number) => {
    const nextColors = [...(config.colors ?? [])];
    const nextControllers = [...config.controllerTypes];
    while (nextColors.length < n) {
      nextColors.push('Random');
    }
    while (nextControllers.length < n) {
      nextControllers.push(nextControllers.length >= 2 ? 'bot' : 'human');
    }
    updateConfig({
      playerCount: n,
      colors: nextColors.slice(0, n),
      controllerTypes: nextControllers.slice(0, n),
    });
  };

  return (
    <div className="app setup-screen">
      <header className="setup-header">
        <h1>Trick or Treat</h1>
        <button type="button" className="rules-btn" onClick={onShowRules}>
          Rules
        </button>
      </header>

      <div className="setup-sections">
        <section className="setup-section">
          <h2>Players</h2>
          <label>
            Number of players: {config.playerCount}
            <input
              type="range"
              min={2}
              max={6}
              value={config.playerCount}
              onChange={(e) => setPlayerCount(parseInt(e.target.value, 10))}
            />
          </label>
          {Array.from({ length: config.playerCount }, (_, i) => {
            const availableColors = getAvailableColors(config, i);
            const currentColor = config.colors?.[i] ?? 'Random';
            const effectiveColor = availableColors.includes(currentColor) ? currentColor : 'Random';

            return (
              <div key={i} className="player-setup-row">
                <span className="player-setup-label">Player {i + 1}</span>
                <label className="player-setup-type">
                  <select
                    value={config.controllerTypes[i] || 'human'}
                    onChange={(e) => {
                      const v = e.target.value as ControllerType;
                      const next = [...config.controllerTypes];
                      next[i] = v;
                      updateConfig({ controllerTypes: next });
                    }}
                  >
                    <option value="human">Human</option>
                    <option value="bot">Bot</option>
                  </select>
                </label>
                <label>
                  <select
                    value={effectiveColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      const next = [...(config.colors ?? [])];
                      while (next.length <= i) next.push('Random');
                      next[i] = v;
                      updateConfig({ colors: next });
                    }}
                  >
                    {availableColors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
          <p className="setup-hint">
            Color defaults to Random; chosen options are unique per player.
          </p>
        </section>

        <section className="setup-section setup-section--secondary">
          <h2>Number of Neighborhoods</h2>
          <div className="setup-rounds">
            <input
              type="range"
              min={1}
              max={9}
              value={config.totalRounds}
              onChange={(e) => updateConfig({ totalRounds: parseInt(e.target.value, 10) })}
            />
            <span className="setup-rounds-value">{config.totalRounds}</span>
          </div>
        </section>
      </div>

      <button
        type="button"
        className="setup-start-btn"
        onClick={onStartGame}
      >
        Start Game
      </button>
    </div>
  );
}
