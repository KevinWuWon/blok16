// Client-side validation logic for Blokli piece placement
// Core validation logic is re-exported from convex/shared/validation.ts
// This file adds client-specific functionality like piece rotation/flipping during preview

import { PIECES, getAllOrientations, translateCells, normalize, rotateCW, flipH, flipV } from "./pieces";
import {
  type PlayerColor,
  type Board,
  BOARD_SIZE,
  STARTING_POSITIONS,
  createEmptyBoard,
  playerToValue,
  isInBounds,
  isEmpty,
  getOrthogonalNeighbors,
  getDiagonalNeighbors,
  hasPlacedPieces,
  findCornerAnchors,
  isValidPlacement,
  findValidPlacementsAtAnchor,
  canPlacePiece,
  hasValidMoves,
  applyPlacement,
  calculateScore,
  determineWinner,
} from "../convex/shared/validation";

// Re-export all shared validation logic for client use
export type { PlayerColor, Board };
export {
  BOARD_SIZE,
  STARTING_POSITIONS,
  createEmptyBoard,
  playerToValue,
  isInBounds,
  isEmpty,
  getOrthogonalNeighbors,
  getDiagonalNeighbors,
  hasPlacedPieces,
  findCornerAnchors,
  isValidPlacement,
  findValidPlacementsAtAnchor,
  canPlacePiece,
  hasValidMoves,
  applyPlacement,
  calculateScore,
  determineWinner,
};

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
// If horizontal flip doesn't find a valid placement, tries vertical flip as fallback
// Returns both cells and orientation index for proper tracking
export function getFlippedOrientation(
  board: Board,
  pieceId: number,
  currentCells: [number, number][],
  player: PlayerColor
): { cells: [number, number][]; orientationIndex: number } | null {
  // Try horizontal flip first
  const hResult = tryFlipOrientation(board, pieceId, currentCells, player, flipH);
  if (hResult) return hResult;

  // Fall back to vertical flip
  return tryFlipOrientation(board, pieceId, currentCells, player, flipV);
}

// Helper to try a specific flip transformation
function tryFlipOrientation(
  board: Board,
  pieceId: number,
  currentCells: [number, number][],
  player: PlayerColor,
  flipFn: (cells: [number, number][]) => [number, number][]
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
  const flippedNormalized = flipFn(normalizedCurrent);

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

// Get all valid placements for a piece, sorted in reading order (top-to-bottom, left-to-right)
// Deduplicates placements by cell positions (different anchors can produce same placement)
export function getAllValidPlacements(
  board: Board,
  pieceId: number,
  player: PlayerColor
): { anchor: [number, number]; cells: [number, number][]; orientationIndex: number }[] {
  const anchors = findCornerAnchors(board, player);

  // Sort in reading order (row, then col)
  const sortedAnchors = [...anchors].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const allPlacements: Array<{
    anchor: [number, number];
    cells: [number, number][];
    orientationIndex: number;
  }> = [];

  const seen = new Set<string>();

  for (const anchor of sortedAnchors) {
    const placements = findValidPlacementsAtAnchor(board, pieceId, anchor[0], anchor[1], player);

    for (const placement of placements) {
      // Dedupe by sorted cell positions
      const key = [...placement.cells]
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .map(([r, c]) => `${r},${c}`)
        .join("|");

      if (!seen.has(key)) {
        seen.add(key);
        allPlacements.push({
          anchor,
          cells: placement.cells,
          orientationIndex: placement.orientationIndex,
        });
      }
    }
  }

  return allPlacements;
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
