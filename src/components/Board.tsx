import type { GameState, Player } from '../game/types';
import type { ItemCard } from '../game/types';
import { TileComponent } from './Tile';
import { FlashlightBeamOverlay } from './FlashlightBeamOverlay';
import { STREET_COL_LABELS, STREET_ROW_LABELS } from '../game/boardLabels';
import { isAdjacent } from '../game/movement';

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];

interface BoardProps {
  state: GameState;
  onTileClick: (row: number, col: number) => void;
  devRevealAll?: boolean;
  playerColors?: string[];
  /** When set, tiles are selectable for item targeting (Flashlight, Shortcut, Intrusive Thoughts, Binoculars) */
  pendingItem?: ItemCard | null;
  /** Mobile Info Mode: taps show info instead of gameplay */
  infoMode?: boolean;
  onShowInfo?: (content: string) => void;
  disableTooltipHover?: boolean;
}

export function Board({ state, onTileClick, devRevealAll, playerColors = PLAYER_COLORS, pendingItem, infoMode, onShowInfo, disableTooltipHover }: BoardProps) {
  const selectedAction = state.selectedAction;
  const isMove = selectedAction === 'move';
  const isChooseStart = state.gamePhase === 'chooseStartingPosition';
  const currentPlayer = state.players[state.currentPlayerIndex];
  const pawnPos = currentPlayer?.pawnPosition ?? null;

  const currentPlayerColor = playerColors[state.currentPlayerIndex] || '#fff';
  const lastMove = state.lastMoveForAnimation;
  const rowCount = state.board.length;

  const isItemTargeting = !!pendingItem;
  const getTileState = (row: number, col: number) => {
    const tile = state.board[row]?.[col];
    if (!tile) return { selectable: false, isCurrentPlayerTile: false, isItemTarget: false };
    const isFirstRow = row === 0;
    const isCurrentPlayerTile = pawnPos !== null && pawnPos.row === row && pawnPos.column === col;
    const isAdjacentTile = pawnPos === null || isAdjacent(pawnPos.row, pawnPos.column, row, col);
    const selectableForMove = isMove && !tile.isClosed && (isAdjacentTile || isCurrentPlayerTile);
    const selectableForStart = isChooseStart && isFirstRow;
    const isMansionRow = row === 4;
    const selectableForShortcut = pendingItem?.type === 'Shortcut' ? !isMansionRow : true;
    const selectableForIntrusiveThoughts =
      pendingItem?.type === 'IntrusiveThoughts'
        ? isCurrentPlayerTile && tile.card?.type === 'CandyBucket' && tile.isFlipped && !tile.isClosed && tile.candyTokensOnTile > 0
        : true;
    const selectableForBinoculars = pendingItem?.type === 'Binoculars' ? !tile.isFlipped && !tile.isClosed : true;
    const monsterEnc = state.monsterEncountered;
    const isDefensiveFlashlightTarget = pendingItem?.type === 'Flashlight' && monsterEnc && monsterEnc.row === row && monsterEnc.col === col;
    const selectableForFlashlight =
      pendingItem?.type === 'Flashlight'
        ? (isDefensiveFlashlightTarget || (isAdjacentTile && !tile.isClosed))
        : true;
    const selectableForItem = isItemTargeting && !tile.isClosed && selectableForShortcut && selectableForIntrusiveThoughts && selectableForBinoculars && selectableForFlashlight;
    const isBinocularsSelected = pendingItem?.type === 'Binoculars' && state.binocularsSelection?.some((s) => s.row === row && s.col === col);
    const selectable =
      selectableForMove || selectableForStart || (selectableForItem && (selectableForShortcut || pendingItem?.type === 'Binoculars'));
    const isItemTarget = isItemTargeting && selectableForItem;
    const isBinocularsRevealed = state.binocularsReveal?.some((s) => s.row === row && s.col === col);
    return { selectable, isCurrentPlayerTile, isItemTarget, isBinocularsSelected, isBinocularsRevealed };
  };

  const rowLabels = [...STREET_ROW_LABELS];

  return (
    <div
      className={`board ${lastMove && lastMove.to.row === 4 ? 'board--mansion-entry' : ''}`}
      style={{ gridTemplateRows: `auto repeat(${rowCount}, minmax(0, 1fr))` }}
    >
      {/* Empty corner: row 1, col 1 */}
      <div className="board-corner" aria-hidden="true" />

      {/* Column headers: row 1, cols 2–6 */}
      {STREET_COL_LABELS.map((label, i) => (
        <div key={`col-${i}`} className="board-col-label" style={{ gridRow: 1, gridColumn: i + 2 }}>
          {label}
        </div>
      ))}

      {/* Row labels: col 1, rows 2–(rowCount+1) */}
      {rowLabels.map((label, i) => (
        <div
          key={`row-${i}`}
          className={`board-row-label ${i === 0 ? 'start' : ''} ${i === 4 ? 'mansion' : ''}`}
          style={{ gridRow: i + 2, gridColumn: 1 }}
        >
          {label}
        </div>
      ))}

      {/* Tiles: rows 2–(rowCount+1), cols 2–6 */}
      {state.board.map((row, r) =>
        row.map((tile, c) => {
          const { selectable, isCurrentPlayerTile, isItemTarget, isBinocularsSelected, isBinocularsRevealed } = getTileState(r, c);
          const tileKey = `${r},${c}`;
          const occupancyOrder = state.tileOccupancyOrder?.[tileKey];
          const playersOnTileRaw: { player: Player; colorIndex: number }[] = state.players
            .map((p, i) => (p.pawnPosition?.row === r && p.pawnPosition?.column === c ? { player: p, colorIndex: i } : null))
            .filter((x): x is { player: Player; colorIndex: number } => x !== null);
          const playersOnTile = occupancyOrder?.length
            ? [...occupancyOrder]
                .map((id) => playersOnTileRaw.find((x) => x.player.id === id))
                .filter((x): x is { player: Player; colorIndex: number } => x != null)
            : playersOnTileRaw;
          const isMansionRow = r === 4;
          const isFirstMansionTile = isMansionRow && c === 0;
          const isAnimatingItemReveal =
            state.lastRevealedItem?.row === r && state.lastRevealedItem?.col === c;
          const isFlashlightTarget =
            state.flashlightReveal?.row === r && state.flashlightReveal?.col === c;
          const forceRevealed =
            isFlashlightTarget && state.flashlightReveal?.phase === 'reveal';
          const isBeamPhaseTarget = isFlashlightTarget && state.flashlightReveal?.phase === 'beam';
          const isBeamPhase = !!state.flashlightReveal && state.flashlightReveal.phase === 'beam';
          const isValidMove = (selectable && isMove && !isCurrentPlayerTile) || isItemTarget;
          const isSelectableForStart = selectable && isChooseStart;
          const isAnimatingMove = lastMove && lastMove.to.row === r && lastMove.to.col === c;
          const isMoveDestination = isAnimatingMove;

          const collectedBy =
            tile.card?.type === 'CandyBucket' && tile.bucketVisits
              ? state.players
                  .filter((p) => (tile.bucketVisits![p.id] ?? 0) >= 1)
                  .map((p) => ({
                    playerIndex: state.players.indexOf(p),
                    color: playerColors[state.players.indexOf(p)] || '#fff',
                    name: p.name,
                  }))
              : [];

          return (
            <div key={`${r}-${c}`} className="board-tile-cell" style={{ gridRow: r + 2, gridColumn: c + 2 }}>
              <TileComponent
                tile={tile}
                isSelected={selectable}
                collectedBy={collectedBy}
                isValidMove={isValidMove}
                isCurrentPlayerTile={isCurrentPlayerTile}
                isSelectableForStart={isSelectableForStart}
                playersOnTile={playersOnTile.map(({ colorIndex }) => ({
                  color: playerColors[colorIndex] || '#fff',
                }))}
                movingPawn={isAnimatingMove ? { from: lastMove!.from, playerIndex: lastMove!.playerIndex } : undefined}
                currentPlayerColor={currentPlayerColor}
                onClick={() => onTileClick(r, c)}
                onInfoClick={infoMode ? onShowInfo : undefined}
                infoMode={!!infoMode}
                disableTooltipHover={!!disableTooltipHover}
                devRevealAll={devRevealAll}
                isMansionRow={isMansionRow}
                isFirstMansionTile={isFirstMansionTile}
                isAnimatingItemReveal={isAnimatingItemReveal}
                forceRevealed={forceRevealed || isBinocularsRevealed}
                isBinocularsSelected={isBinocularsSelected}
                isFlashlightBeamTarget={isBeamPhaseTarget}
                isFlashlightBeamPhase={isBeamPhase}
                isMoveDestination={isMoveDestination}
                moveDestinationColor={isMoveDestination && lastMove ? (playerColors[lastMove.playerIndex] ?? undefined) : undefined}
              />
            </div>
          );
        })
      )}

      {/* Flashlight beam overlay */}
      {state.flashlightReveal && (
        <FlashlightBeamOverlay
          fromRow={state.flashlightReveal.fromRow}
          fromCol={state.flashlightReveal.fromCol}
          toRow={state.flashlightReveal.row}
          toCol={state.flashlightReveal.col}
          rowCount={rowCount}
          isBeamPhase={state.flashlightReveal.phase === 'beam'}
        />
      )}

      {/* Moving pawn overlay: grid cell spanning tile area for correct % positioning */}
      {lastMove && (
        <div
          className="board-tile-area board-tile-area--overlay"
          style={{ gridRow: '2 / -1', gridColumn: '2 / -1' }}
          aria-hidden="true"
        >
          <div
            className="moving-pawn-overlay"
            style={{
              left: `${lastMove.from.col * (100 / 5)}%`,
              top: `${lastMove.from.row * (100 / rowCount)}%`,
              width: `${100 / 5}%`,
              height: `${100 / rowCount}%`,
              '--move-from-col': lastMove.from.col,
              '--move-from-row': lastMove.from.row,
              '--move-to-col': lastMove.to.col,
              '--move-to-row': lastMove.to.row,
            } as React.CSSProperties}
          >
            <span
              className="moving-pawn"
              style={{ backgroundColor: playerColors[lastMove.playerIndex] || '#fff' }}
              aria-label={`Player ${lastMove.playerIndex + 1} moving`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
