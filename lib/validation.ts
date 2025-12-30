// Client-side (and shared) validation logic for Blokus piece placement

import { PIECES, getAllOrientations, translateCells, normalize, rotateCW, flipH } from "./pieces";

export const BOARD_SIZE = 14;
export const STARTING_POSITIONS = {
  blue: { row: 4, col: 4 },
  orange: { row: 9, col: 9 },
} as const;

export type PlayerColor = "blue" | "orange";
export type Board = number[][]; // 0 = empty, 1 = blue, 2 = orange

// Create empty 14x14 board
export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

// Get player value on board (1 for blue, 2 for orange)
export function playerToValue(player: PlayerColor): number {
  return player === "blue" ? 1 : 2;
}

// Check if position is within board bounds
export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

// Check if a cell is empty on the board
export function isEmpty(board: Board, row: number, col: number): boolean {
  return isInBounds(row, col) && board[row][col] === 0;
}

// Get orthogonal neighbors (edge-adjacent)
export function getOrthogonalNeighbors(row: number, col: number): [number, number][] {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
}

// Get diagonal neighbors (corner-adjacent)
export function getDiagonalNeighbors(row: number, col: number): [number, number][] {
  return [
    [row - 1, col - 1],
    [row - 1, col + 1],
    [row + 1, col - 1],
    [row + 1, col + 1],
  ];
}

// Check if player has placed any pieces
export function hasPlacedPieces(board: Board, player: PlayerColor): boolean {
  const value = playerToValue(player);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === value) return true;
    }
  }
  return false;
}

// Find all valid corner anchors for a player
// Corner anchor = empty cell that:
// - Diagonally touches at least one of player's pieces
// - Does NOT orthogonally touch any of player's pieces
export function findCornerAnchors(board: Board, player: PlayerColor): [number, number][] {
  const value = playerToValue(player);
  const anchors: [number, number][] = [];

  // First move: only starting position is valid
  if (!hasPlacedPieces(board, player)) {
    const start = STARTING_POSITIONS[player];
    return [[start.row, start.col]];
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) continue; // Must be empty

      // Check diagonal neighbors for player's pieces
      let touchesDiagonal = false;
      for (const [dr, dc] of getDiagonalNeighbors(r, c)) {
        if (isInBounds(dr, dc) && board[dr][dc] === value) {
          touchesDiagonal = true;
          break;
        }
      }

      if (!touchesDiagonal) continue;

      // Check orthogonal neighbors - must NOT touch player's pieces
      let touchesOrthogonal = false;
      for (const [or, oc] of getOrthogonalNeighbors(r, c)) {
        if (isInBounds(or, oc) && board[or][oc] === value) {
          touchesOrthogonal = true;
          break;
        }
      }

      if (!touchesOrthogonal) {
        anchors.push([r, c]);
      }
    }
  }

  return anchors;
}

// Check if a piece placement is valid
// Returns true if:
// 1. All cells are in bounds and empty
// 2. At least one cell is on a valid corner anchor (or starting position for first move)
// 3. No cell orthogonally touches player's own pieces
export function isValidPlacement(
  board: Board,
  cells: [number, number][],
  player: PlayerColor
): boolean {
  const value = playerToValue(player);
  const isFirstMove = !hasPlacedPieces(board, player);

  // Check all cells are in bounds and empty
  for (const [r, c] of cells) {
    if (!isInBounds(r, c) || board[r][c] !== 0) {
      return false;
    }
  }

  // Check no cell orthogonally touches player's own pieces
  for (const [r, c] of cells) {
    for (const [nr, nc] of getOrthogonalNeighbors(r, c)) {
      if (isInBounds(nr, nc) && board[nr][nc] === value) {
        return false;
      }
    }
  }

  // First move: must cover starting position
  if (isFirstMove) {
    const start = STARTING_POSITIONS[player];
    const coversStart = cells.some(([r, c]) => r === start.row && c === start.col);
    return coversStart;
  }

  // Subsequent moves: at least one cell must be on a corner anchor
  // (diagonally touching player's piece)
  let touchesCorner = false;
  for (const [r, c] of cells) {
    for (const [dr, dc] of getDiagonalNeighbors(r, c)) {
      if (isInBounds(dr, dc) && board[dr][dc] === value) {
        touchesCorner = true;
        break;
      }
    }
    if (touchesCorner) break;
  }

  return touchesCorner;
}

// Find all valid placements for a piece at a specific anchor point
// Returns list of { cells, orientation } that are valid
export function findValidPlacementsAtAnchor(
  board: Board,
  pieceId: number,
  anchorRow: number,
  anchorCol: number,
  player: PlayerColor
): { cells: [number, number][]; orientationIndex: number }[] {
  const piece = PIECES[pieceId];
  const orientations = getAllOrientations(piece.cells);
  const validPlacements: { cells: [number, number][]; orientationIndex: number }[] = [];

  for (let oi = 0; oi < orientations.length; oi++) {
    const orientation = orientations[oi];

    // Try placing each cell of the piece on the anchor
    for (const [cellR, cellC] of orientation) {
      const rowOffset = anchorRow - cellR;
      const colOffset = anchorCol - cellC;
      const placedCells = translateCells(orientation, rowOffset, colOffset);

      if (isValidPlacement(board, placedCells, player)) {
        validPlacements.push({ cells: placedCells, orientationIndex: oi });
      }
    }
  }

  return validPlacements;
}

// Check if a piece can be placed anywhere on the board
export function canPlacePiece(
  board: Board,
  pieceId: number,
  player: PlayerColor
): boolean {
  const anchors = findCornerAnchors(board, player);
  for (const [ar, ac] of anchors) {
    const placements = findValidPlacementsAtAnchor(board, pieceId, ar, ac, player);
    if (placements.length > 0) return true;
  }
  return false;
}

// Check if player has any valid moves
export function hasValidMoves(
  board: Board,
  remainingPieces: number[],
  player: PlayerColor
): boolean {
  for (const pieceId of remainingPieces) {
    if (canPlacePiece(board, pieceId, player)) return true;
  }
  return false;
}

// Apply a piece placement to the board (mutates board)
export function applyPlacement(
  board: Board,
  cells: [number, number][],
  player: PlayerColor
): void {
  const value = playerToValue(player);
  for (const [r, c] of cells) {
    board[r][c] = value;
  }
}

// Calculate score (total squares in remaining pieces)
export function calculateScore(remainingPieces: number[]): number {
  return remainingPieces.reduce((sum, pieceId) => sum + PIECES[pieceId].size, 0);
}

// Determine winner based on remaining pieces
export function determineWinner(
  blueRemaining: number[],
  orangeRemaining: number[]
): "blue" | "orange" | "draw" {
  const blueScore = calculateScore(blueRemaining);
  const orangeScore = calculateScore(orangeRemaining);

  if (blueScore < orangeScore) return "blue";
  if (orangeScore < blueScore) return "orange";
  return "draw";
}

// Get the next valid orientation for a piece at current position
// Used when rotating during preview - only cycles through valid orientations
// Returns both cells and orientation index for proper tracking
export function getNextValidOrientation(
  board: Board,
  pieceId: number,
  currentCells: [number, number][],
  player: PlayerColor,
  direction: "cw" | "ccw"
): { cells: [number, number][]; orientationIndex: number } | null {
  const piece = PIECES[pieceId];
  const allOrientations = getAllOrientations(piece.cells);

  // Get anchor cells from current placement - new placement must share at least one
  const anchorCells = getAnchorCellsForPlacement(board, currentCells, player);

  // Normalize current cells to find current orientation index
  const normalizedCurrent = normalize(currentCells);
  let currentIndex = -1;

  for (let i = 0; i < allOrientations.length; i++) {
    if (cellsMatch(allOrientations[i], normalizedCurrent)) {
      currentIndex = i;
      break;
    }
  }

  if (currentIndex === -1) {
    // Current orientation not found in standard orientations, use manual rotation
    const rotated = direction === "cw" ? rotateCW(currentCells) : rotateCCW(currentCells);
    const cells = tryFindValidPosition(board, rotated, currentCells, player, anchorCells);
    if (cells) {
      // Try to find orientation index for the rotated cells
      const normalizedRotated = normalize(cells);
      for (let i = 0; i < allOrientations.length; i++) {
        if (cellsMatch(allOrientations[i], normalizedRotated)) {
          return { cells, orientationIndex: i };
        }
      }
      return { cells, orientationIndex: 0 }; // fallback
    }
    return null;
  }

  // Try subsequent orientations
  const numOrientations = allOrientations.length;
  for (let i = 1; i <= numOrientations; i++) {
    const nextIndex =
      direction === "cw"
        ? (currentIndex + i) % numOrientations
        : (currentIndex - i + numOrientations) % numOrientations;

    const nextOrientation = allOrientations[nextIndex];
    const validPosition = tryFindValidPosition(board, nextOrientation, currentCells, player, anchorCells);
    if (validPosition) {
      return { cells: validPosition, orientationIndex: nextIndex };
    }
  }

  return null; // No valid orientation found
}

// Get the flipped (horizontally mirrored) version of the current placement
// Returns both cells and orientation index for proper tracking
export function getFlippedOrientation(
  board: Board,
  pieceId: number,
  currentCells: [number, number][],
  player: PlayerColor
): { cells: [number, number][]; orientationIndex: number } | null {
  const piece = PIECES[pieceId];
  const allOrientations = getAllOrientations(piece.cells);

  // Get anchor cells from current placement - new placement must share at least one
  const anchorCells = getAnchorCellsForPlacement(board, currentCells, player);
  const anchorSet = new Set(anchorCells.map(([r, c]) => `${r},${c}`));

  // Get the center of the current placement (using floats for precision)
  const currentCenter = getCellsCenter(currentCells);

  // Normalize and flip the cells
  const normalizedCurrent = normalize(currentCells);
  const flippedNormalized = flipH(normalizedCurrent);

  // Get the center of the flipped normalized piece
  const flippedNormalizedCenter = getCellsCenter(flippedNormalized);

  // Calculate offset to position the flipped piece so its center matches the original center
  const rowOffset = Math.round(currentCenter.row - flippedNormalizedCenter.row);
  const colOffset = Math.round(currentCenter.col - flippedNormalizedCenter.col);

  // Position the flipped piece centered on the original position
  const centeredFlipped = translateCells(flippedNormalized, rowOffset, colOffset);

  // Helper to find orientation index for cells
  const findOrientationIndex = (cells: [number, number][]): number => {
    const normalized = normalize(cells);
    for (let i = 0; i < allOrientations.length; i++) {
      if (cellsMatch(allOrientations[i], normalized)) {
        return i;
      }
    }
    return 0; // fallback
  };

  // Helper to check if placement shares an anchor cell
  const sharesAnchorCell = (placedCells: [number, number][]): boolean => {
    if (anchorCells.length === 0) return true;
    return placedCells.some(([r, c]) => anchorSet.has(`${r},${c}`));
  };

  // If the centered position is valid and shares an anchor, use it
  if (isValidPlacement(board, centeredFlipped, player) && sharesAnchorCell(centeredFlipped)) {
    return { cells: centeredFlipped, orientationIndex: findOrientationIndex(centeredFlipped) };
  }

  // Otherwise, search nearby for a valid position that shares an anchor
  const cells = tryFindValidPosition(board, flippedNormalized, currentCells, player, anchorCells);
  if (cells) {
    return { cells, orientationIndex: findOrientationIndex(cells) };
  }
  return null;
}

// Counter-clockwise rotation
function rotateCCW(cells: [number, number][]): [number, number][] {
  const rotated = cells.map(([r, c]) => [-c, r] as [number, number]);
  return normalize(rotated);
}

// Find which cells of a placement are "anchor cells" (cells that connect to existing pieces or starting position)
function getAnchorCellsForPlacement(
  board: Board,
  cells: [number, number][],
  player: PlayerColor
): [number, number][] {
  const value = playerToValue(player);
  const isFirstMove = !hasPlacedPieces(board, player);
  const anchorCells: [number, number][] = [];

  if (isFirstMove) {
    // For first move, the anchor is the starting position
    const start = STARTING_POSITIONS[player];
    for (const [r, c] of cells) {
      if (r === start.row && c === start.col) {
        anchorCells.push([r, c]);
      }
    }
  } else {
    // For subsequent moves, anchor cells are those diagonally touching player's pieces
    for (const [r, c] of cells) {
      for (const [dr, dc] of getDiagonalNeighbors(r, c)) {
        if (isInBounds(dr, dc) && board[dr][dc] === value) {
          anchorCells.push([r, c]);
          break;
        }
      }
    }
  }

  return anchorCells;
}

// Try to find a valid position for the rotated piece near the current position
// If anchorCells is provided, the new placement must share at least one cell position with them
function tryFindValidPosition(
  board: Board,
  newOrientation: [number, number][],
  currentCells: [number, number][],
  player: PlayerColor,
  anchorCells?: [number, number][]
): [number, number][] | null {
  // Get center of current placement
  const centerR = Math.round(currentCells.reduce((sum, [r]) => sum + r, 0) / currentCells.length);
  const centerC = Math.round(currentCells.reduce((sum, [, c]) => sum + c, 0) / currentCells.length);

  // Helper to check if placement shares an anchor cell
  const sharesAnchorCell = (placedCells: [number, number][]): boolean => {
    if (!anchorCells || anchorCells.length === 0) return true;
    const placedSet = new Set(placedCells.map(([r, c]) => `${r},${c}`));
    return anchorCells.some(([r, c]) => placedSet.has(`${r},${c}`));
  };

  // Try offsets in expanding rings to find valid placement close to current position
  const maxOffset = 3;
  for (let dist = 0; dist <= maxOffset; dist++) {
    for (let dr = -dist; dr <= dist; dr++) {
      for (let dc = -dist; dc <= dist; dc++) {
        if (Math.abs(dr) !== dist && Math.abs(dc) !== dist) continue; // Only check ring

        // Try placing each cell of the new orientation at the target position
        for (const [cellR, cellC] of newOrientation) {
          const rowOffset = centerR + dr - cellR;
          const colOffset = centerC + dc - cellC;
          const placedCells = translateCells(newOrientation, rowOffset, colOffset);

          if (isValidPlacement(board, placedCells, player) && sharesAnchorCell(placedCells)) {
            return placedCells;
          }
        }
      }
    }
  }

  return null;
}

// Check if two cell arrays match (ignoring order)
function cellsMatch(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(([r, c]) => `${r},${c}`));
  for (const [r, c] of b) {
    if (!setA.has(`${r},${c}`)) return false;
  }
  return true;
}

// Get valid anchors that work with a specific piece
export function getValidAnchorsForPiece(
  board: Board,
  pieceId: number,
  player: PlayerColor
): [number, number][] {
  const allAnchors = findCornerAnchors(board, player);
  return allAnchors.filter((anchor) => {
    const placements = findValidPlacementsAtAnchor(board, pieceId, anchor[0], anchor[1], player);
    return placements.length > 0;
  });
}

// Find the nearest valid anchor to a given position (for drag and drop snapping)
export function findNearestValidAnchor(
  row: number,
  col: number,
  validAnchors: [number, number][]
): [number, number] | null {
  if (validAnchors.length === 0) return null;

  let nearest = validAnchors[0];
  let minDist = Infinity;

  for (const [r, c] of validAnchors) {
    const dist = (r - row) ** 2 + (c - col) ** 2;
    if (dist < minDist) {
      minDist = dist;
      nearest = [r, c];
    }
  }

  return nearest;
}

// Calculate the center of a set of cells
export function getCellsCenter(cells: [number, number][]): { row: number; col: number } {
  const sumR = cells.reduce((sum, [r]) => sum + r, 0);
  const sumC = cells.reduce((sum, [, c]) => sum + c, 0);
  return {
    row: sumR / cells.length,
    col: sumC / cells.length,
  };
}

// Find the placement whose center is closest to the cursor position
// This is used during drag to pick the best placement when there are multiple
// valid placements at the same anchor (e.g., first move on starting position)
// When preferredOrientationIndex is provided, only placements with that orientation
// are considered (unless none exist, then falls back to all placements)
export function findBestPlacementForCursor(
  cursorRow: number,
  cursorCol: number,
  placements: { cells: [number, number][]; orientationIndex: number }[],
  preferredOrientationIndex?: number
): { cells: [number, number][]; orientationIndex: number } | null {
  if (placements.length === 0) return null;
  if (placements.length === 1) return placements[0];

  // Filter to only placements with the preferred orientation if specified
  let candidatePlacements = placements;
  if (preferredOrientationIndex !== undefined) {
    const matchingOrientation = placements.filter(
      p => p.orientationIndex === preferredOrientationIndex
    );
    if (matchingOrientation.length > 0) {
      candidatePlacements = matchingOrientation;
    }
    // If no matching orientation, fall back to all placements
  }

  let bestPlacement = candidatePlacements[0];
  let minDist = Infinity;

  for (const placement of candidatePlacements) {
    const center = getCellsCenter(placement.cells);
    // Use squared distance (no need for sqrt for comparison)
    const dist = (center.row - cursorRow) ** 2 + (center.col - cursorCol) ** 2;

    if (dist < minDist) {
      minDist = dist;
      bestPlacement = placement;
    }
  }

  return bestPlacement;
}
