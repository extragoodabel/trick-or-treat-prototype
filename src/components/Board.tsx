import type { GameState } from '../game/types';
import { TileComponent } from './Tile';
import { STREET_COL_LABELS, STREET_ROW_LABELS } from '../game/boardLabels';
import { isOrthogonallyAdjacent } from '../game/movement';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

interface BoardProps {
  state: GameState;
  onTileClick: (row: number, col: number) => void;
  devRevealAll?: boolean;
}

export function Board({ state, onTileClick, devRevealAll }: BoardProps) {
  const selectedAction = state.selectedAction;
  const isMove = selectedAction === 'move';
  const currentPlayer = state.players[state.currentPlayerIndex];
  const pawnPos = currentPlayer?.pawnPosition ?? null;

  const getTileState = (row: number, col: number) => {
    const tile = state.board[row]?.[col];
    if (!tile) return { selectable: false, hasPawn: false };
    const hasPawn = state.players.some(
      (p) => p.pawnPosition?.row === row && p.pawnPosition?.column === col
    );
    const isAdjacent = pawnPos === null || isOrthogonallyAdjacent(pawnPos.row, pawnPos.column, row, col);
    const selectable = isMove && !tile.isClosed && isAdjacent;
    return { selectable, hasPawn };
  };

  return (
    <div className="board">
      <div className="board-labels-col">
        {STREET_ROW_LABELS.map((label, i) => (
          <div key={i} className={`board-row-label ${i === 0 ? 'start' : ''} ${i === 4 ? 'mansion' : ''}`}>
            {label}
          </div>
        ))}
      </div>
      <div className="board-labels-row">
        {STREET_COL_LABELS.map((label, i) => (
          <div key={i} className="board-col-label">{label}</div>
        ))}
      </div>
      <div className="board-grid">
          {state.board.map((row, r) =>
            row.map((tile, c) => {
              const { selectable, hasPawn } = getTileState(r, c);
              const playerWithPawn = state.players.find(
                (p) => p.pawnPosition?.row === r && p.pawnPosition?.column === c
              );
              const colorIdx = playerWithPawn
                ? state.players.findIndex((p) => p.id === playerWithPawn.id)
                : 0;
              const isMansionRow = r === 4;
              return (
                <TileComponent
                  key={`${r}-${c}`}
                  tile={tile}
                  isSelected={selectable}
                  hasPawn={hasPawn}
                  playerColor={PLAYER_COLORS[colorIdx] || '#fff'}
                  onClick={() => onTileClick(r, c)}
                  devRevealAll={devRevealAll}
                  isMansionRow={isMansionRow}
                />
              );
            }          )
        )}
      </div>
    </div>
  );
}
