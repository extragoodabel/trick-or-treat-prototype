import type { GameState, Player } from '../game/types';
import { TileComponent } from './Tile';
import { STREET_COL_LABELS, STREET_ROW_LABELS } from '../game/boardLabels';
import { isOrthogonallyAdjacent } from '../game/movement';
import { getCostumeIcon } from '../game/icons';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

interface BoardProps {
  state: GameState;
  onTileClick: (row: number, col: number) => void;
  devRevealAll?: boolean;
  playerColors?: string[];
}

export function Board({ state, onTileClick, devRevealAll, playerColors = PLAYER_COLORS }: BoardProps) {
  const selectedAction = state.selectedAction;
  const isMove = selectedAction === 'move';
  const isChooseStart = state.gamePhase === 'chooseStartingPosition';
  const currentPlayer = state.players[state.currentPlayerIndex];
  const pawnPos = currentPlayer?.pawnPosition ?? null;

  const currentPlayerColor = playerColors[state.currentPlayerIndex] || '#fff';
  const lastMove = state.lastMoveForAnimation;

  const getTileState = (row: number, col: number) => {
    const tile = state.board[row]?.[col];
    if (!tile) return { selectable: false, isCurrentPlayerTile: false };
    const occupied = state.players.some(
      (p) => p.pawnPosition?.row === row && p.pawnPosition?.column === col
    );
    const isFirstRow = row === 0;
    const isCurrentPlayerTile = pawnPos !== null && pawnPos.row === row && pawnPos.column === col;
    const isAdjacent = pawnPos === null || isOrthogonallyAdjacent(pawnPos.row, pawnPos.column, row, col);
    const selectable =
      (isMove && !tile.isClosed && (isAdjacent || isCurrentPlayerTile)) ||
      (isChooseStart && isFirstRow && !occupied);
    return { selectable, isCurrentPlayerTile };
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
      <div
        className="board-grid-wrapper"
      >
        {lastMove && (
          <div
            className="moving-pawn-overlay"
            aria-hidden="true"
            style={{
              left: `${lastMove.from.col * 20}%`,
              top: `${lastMove.from.row * 20}%`,
              width: '20%',
              height: '20%',
              '--move-from-col': lastMove.from.col,
              '--move-from-row': lastMove.from.row,
              '--move-to-col': lastMove.to.col,
              '--move-to-row': lastMove.to.row,
            } as React.CSSProperties}
          >
            <span
              className="moving-pawn"
              style={{ backgroundColor: playerColors[lastMove.playerIndex] || '#fff' }}
            >
              {state.players[lastMove.playerIndex] && getCostumeIcon(state.players[lastMove.playerIndex].costume)}
            </span>
          </div>
        )}
        <div className="board-grid">
          {state.board.map((row, r) =>
            row.map((tile, c) => {
              const { selectable, isCurrentPlayerTile } = getTileState(r, c);
              const playersOnTile: { player: Player; colorIndex: number }[] = state.players
                .map((p, i) => (p.pawnPosition?.row === r && p.pawnPosition?.column === c ? { player: p, colorIndex: i } : null))
                .filter((x): x is { player: Player; colorIndex: number } => x !== null);
              const isMansionRow = r === 4;
              const isValidMove = selectable && isMove && !isCurrentPlayerTile;
              const isSelectableForStart = selectable && isChooseStart;
              const isAnimatingMove = lastMove && lastMove.to.row === r && lastMove.to.col === c;
              return (
                <TileComponent
                  key={`${r}-${c}`}
                  tile={tile}
                  isSelected={selectable}
                  isValidMove={isValidMove}
                  isCurrentPlayerTile={isCurrentPlayerTile}
                  isSelectableForStart={isSelectableForStart}
                  playersOnTile={playersOnTile.map(({ player, colorIndex }) => ({
                    costume: player.costume,
                    color: playerColors[colorIndex] || '#fff',
                  }))}
                  movingPawn={isAnimatingMove ? { from: lastMove!.from, playerIndex: lastMove!.playerIndex } : undefined}
                  currentPlayerColor={currentPlayerColor}
                  onClick={() => onTileClick(r, c)}
                  devRevealAll={devRevealAll}
                  isMansionRow={isMansionRow}
                />
              );
            }          )
        )}
        </div>
      </div>
    </div>
  );
}
