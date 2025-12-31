// Re-export all piece definitions and transformations from the shared source
// The single source of truth is in convex/shared/pieces.ts
// This eliminates duplication between client and server code

export type { Piece } from "../convex/shared/pieces";
export {
  PIECES,
  normalize,
  rotateCW,
  rotateCCW,
  flipH,
  getAllOrientations,
  getBoundingBox,
  translateCells,
  cellsEqual,
} from "../convex/shared/pieces";
