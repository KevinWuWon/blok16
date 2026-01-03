// Shared validation logic for Blokli piece placement
// Used by both client-side (lib/validation.ts) and server-side (convex/games.ts)

import { PIECES, getAllOrientations, translateCells } from "./pieces";

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
