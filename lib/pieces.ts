// All 21 Blokus Duo pieces
// Each piece is defined as relative [row, col] offsets from anchor point (0,0)

export interface Piece {
  id: number;
  name: string;
  size: number;
  cells: [number, number][]; // [row, col] offsets
}

export const PIECES: Piece[] = [
  // 1-square piece
  { id: 0, name: "I1", size: 1, cells: [[0, 0]] },

  // 2-square piece
  { id: 1, name: "I2", size: 2, cells: [[0, 0], [0, 1]] },

  // 3-square pieces
  { id: 2, name: "I3", size: 3, cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 3, name: "V3", size: 3, cells: [[0, 0], [1, 0], [1, 1]] },

  // 4-square pieces
  { id: 4, name: "I4", size: 4, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: 5, name: "L4", size: 4, cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { id: 6, name: "T4", size: 4, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: 7, name: "O4", size: 4, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: 8, name: "S4", size: 4, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },

  // 5-square pieces (pentominoes)
  { id: 9, name: "I5", size: 5, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
  { id: 10, name: "L5", size: 5, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]] },
  { id: 11, name: "Y5", size: 5, cells: [[0, 1], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: 12, name: "N5", size: 5, cells: [[0, 0], [1, 0], [1, 1], [2, 1], [3, 1]] },
  { id: 13, name: "P5", size: 5, cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]] },
  { id: 14, name: "U5", size: 5, cells: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { id: 15, name: "T5", size: 5, cells: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]] },
  { id: 16, name: "V5", size: 5, cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { id: 17, name: "W5", size: 5, cells: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: 18, name: "Z5", size: 5, cells: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]] },
  { id: 19, name: "F5", size: 5, cells: [[0, 1], [0, 2], [1, 0], [1, 1], [2, 1]] },
  { id: 20, name: "X5", size: 5, cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
];

// Rotate piece 90 degrees clockwise
export function rotateCW(cells: [number, number][]): [number, number][] {
  // Rotate: (r, c) -> (c, -r)
  const rotated = cells.map(([r, c]) => [c, -r] as [number, number]);
  return normalize(rotated);
}

// Rotate piece 90 degrees counter-clockwise
export function rotateCCW(cells: [number, number][]): [number, number][] {
  // Rotate: (r, c) -> (-c, r)
  const rotated = cells.map(([r, c]) => [-c, r] as [number, number]);
  return normalize(rotated);
}

// Flip piece horizontally
export function flipH(cells: [number, number][]): [number, number][] {
  // Flip: (r, c) -> (r, -c)
  const flipped = cells.map(([r, c]) => [r, -c] as [number, number]);
  return normalize(flipped);
}

// Normalize cells so minimum row and column are 0
export function normalize(cells: [number, number][]): [number, number][] {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC] as [number, number]);
}

// Get all unique orientations of a piece (up to 8: 4 rotations × 2 flips)
export function getAllOrientations(cells: [number, number][]): [number, number][][] {
  const orientations: [number, number][][] = [];
  const seen = new Set<string>();

  let current = normalize(cells);

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const key = cellsToKey(current);
      if (!seen.has(key)) {
        seen.add(key);
        orientations.push([...current]);
      }
      current = rotateCW(current);
    }
    current = flipH(cells);
  }

  return orientations;
}

// Convert cells to a string key for deduplication
function cellsToKey(cells: [number, number][]): string {
  const sorted = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return sorted.map(([r, c]) => `${r},${c}`).join("|");
}

// Get the bounding box of cells
export function getBoundingBox(cells: [number, number][]): { rows: number; cols: number } {
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));
  return { rows: maxR + 1, cols: maxC + 1 };
}

// Translate cells by offset
export function translateCells(
  cells: [number, number][],
  rowOffset: number,
  colOffset: number
): [number, number][] {
  return cells.map(([r, c]) => [r + rowOffset, c + colOffset]);
}

// Check if cells are equal (same set of positions)
export function cellsEqual(a: [number, number][], b: [number, number][]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map(([r, c]) => `${r},${c}`));
  const setB = new Set(b.map(([r, c]) => `${r},${c}`));
  for (const key of setA) {
    if (!setB.has(key)) return false;
  }
  return true;
}
