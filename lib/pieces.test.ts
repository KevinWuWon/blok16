import { describe, it, expect } from "vitest";
import {
  normalize,
  rotateCW,
  rotateCCW,
  flipH,
  getAllOrientations,
  translateCells,
  getBoundingBox,
  cellsEqual,
  PIECES,
} from "./pieces";

describe("normalize", () => {
  it("keeps cells already at origin unchanged", () => {
    const cells: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    const result = normalize(cells);
    expect(cellsEqual(result, cells)).toBe(true);
  });

  it("shifts negative coords to origin", () => {
    const cells: [number, number][] = [
      [-2, -3],
      [-2, -2],
      [-1, -3],
    ];
    const result = normalize(cells);
    const expected: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    expect(cellsEqual(result, expected)).toBe(true);
  });

  it("shifts positive offset coords to origin", () => {
    const cells: [number, number][] = [
      [5, 3],
      [5, 4],
      [6, 3],
    ];
    const result = normalize(cells);
    const expected: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    expect(cellsEqual(result, expected)).toBe(true);
  });

  it("is idempotent (double normalize = same result)", () => {
    const cells: [number, number][] = [
      [3, 5],
      [4, 5],
      [4, 6],
    ];
    const once = normalize(cells);
    const twice = normalize(once);
    expect(cellsEqual(once, twice)).toBe(true);
  });
});

describe("rotateCW", () => {
  it("rotates I2 horizontal to vertical", () => {
    // I2 horizontal: [[0,0],[0,1]]
    const horizontal: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const result = rotateCW(horizontal);
    // After rotation: (0,0) -> (0,0), (0,1) -> (1,0)
    const expected: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    expect(cellsEqual(result, expected)).toBe(true);
  });

  it("4x rotateCW returns to original", () => {
    const original: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ]; // L4
    let current = original;
    for (let i = 0; i < 4; i++) {
      current = rotateCW(current);
    }
    expect(cellsEqual(current, original)).toBe(true);
  });

  it("preserves cell count", () => {
    const cells: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 1],
      [2, 1],
    ]; // T5
    const result = rotateCW(cells);
    expect(result.length).toBe(cells.length);
  });
});

describe("rotateCCW", () => {
  it("rotates I2 horizontal to vertical", () => {
    const horizontal: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const result = rotateCCW(horizontal);
    // After CCW rotation: (0,0) -> (0,0), (0,1) -> (-1,0) normalized to (0,0) and (1,0)
    const expected: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    expect(cellsEqual(result, expected)).toBe(true);
  });

  it("is inverse of rotateCW", () => {
    const original: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ]; // L4
    const rotatedCW = rotateCW(original);
    const backToCCW = rotateCCW(rotatedCW);
    expect(cellsEqual(backToCCW, original)).toBe(true);
  });

  it("4x rotateCCW returns to original", () => {
    const original: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 1],
    ]; // F5
    let current = original;
    for (let i = 0; i < 4; i++) {
      current = rotateCCW(current);
    }
    expect(cellsEqual(current, original)).toBe(true);
  });

  it("preserves cell count", () => {
    const cells: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ]; // I5
    const result = rotateCCW(cells);
    expect(result.length).toBe(cells.length);
  });
});

describe("flipH", () => {
  it("keeps symmetric piece I2 unchanged", () => {
    // I2 vertical is symmetric about horizontal axis
    const vertical: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    const result = flipH(vertical);
    expect(cellsEqual(result, vertical)).toBe(true);
  });

  it("changes asymmetric piece L4", () => {
    const L4: [number, number][] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ];
    const result = flipH(L4);
    // Flipped L4 should have the foot on the other side
    const expected: [number, number][] = [
      [0, 1],
      [1, 1],
      [2, 0],
      [2, 1],
    ];
    expect(cellsEqual(result, expected)).toBe(true);
  });

  it("double flip returns original", () => {
    const original: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [2, 1],
    ]; // F5
    const flippedOnce = flipH(original);
    const flippedTwice = flipH(flippedOnce);
    expect(cellsEqual(flippedTwice, original)).toBe(true);
  });

  it("keeps horizontally symmetric O4 unchanged", () => {
    const O4: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    const result = flipH(O4);
    expect(cellsEqual(result, O4)).toBe(true);
  });
});

describe("getAllOrientations", () => {
  it("I1 (id=0) has exactly 1 orientation", () => {
    const I1 = PIECES.find((p) => p.id === 0)!;
    const orientations = getAllOrientations(I1.cells);
    expect(orientations.length).toBe(1);
  });

  it("I2 (id=1) has exactly 2 orientations", () => {
    const I2 = PIECES.find((p) => p.id === 1)!;
    const orientations = getAllOrientations(I2.cells);
    expect(orientations.length).toBe(2);
  });

  it("O4 (id=7) has exactly 1 orientation (square)", () => {
    const O4 = PIECES.find((p) => p.id === 7)!;
    const orientations = getAllOrientations(O4.cells);
    expect(orientations.length).toBe(1);
  });

  it("X5 (id=20) has exactly 1 orientation (plus sign)", () => {
    const X5 = PIECES.find((p) => p.id === 20)!;
    const orientations = getAllOrientations(X5.cells);
    expect(orientations.length).toBe(1);
  });

  it("L4 (id=5) has exactly 8 orientations", () => {
    // L4 is asymmetric: 4 rotations x 2 flips = 8 unique orientations
    const L4 = PIECES.find((p) => p.id === 5)!;
    const orientations = getAllOrientations(L4.cells);
    expect(orientations.length).toBe(8);
  });

  it("F5 (id=19) has exactly 8 orientations (fully asymmetric)", () => {
    const F5 = PIECES.find((p) => p.id === 19)!;
    const orientations = getAllOrientations(F5.cells);
    expect(orientations.length).toBe(8);
  });

  it("I4 (id=4) has exactly 2 orientations", () => {
    const I4 = PIECES.find((p) => p.id === 4)!;
    const orientations = getAllOrientations(I4.cells);
    expect(orientations.length).toBe(2);
  });

  it("T4 (id=6) has exactly 4 orientations", () => {
    const T4 = PIECES.find((p) => p.id === 6)!;
    const orientations = getAllOrientations(T4.cells);
    expect(orientations.length).toBe(4);
  });

  it("all orientations have the same cell count as original", () => {
    for (const piece of PIECES) {
      const orientations = getAllOrientations(piece.cells);
      for (const orientation of orientations) {
        expect(orientation.length).toBe(piece.cells.length);
      }
    }
  });
});

describe("translateCells", () => {
  it("positive offsets work correctly", () => {
    const cells: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const result = translateCells(cells, 3, 5);
    const expected: [number, number][] = [
      [3, 5],
      [3, 6],
    ];
    expect(cellsEqual(result, expected)).toBe(true);
  });

  it("negative offsets work correctly", () => {
    const cells: [number, number][] = [
      [5, 5],
      [5, 6],
    ];
    const result = translateCells(cells, -3, -2);
    const expected: [number, number][] = [
      [2, 3],
      [2, 4],
    ];
    expect(cellsEqual(result, expected)).toBe(true);
  });

  it("zero offset is identity", () => {
    const cells: [number, number][] = [
      [1, 2],
      [3, 4],
    ];
    const result = translateCells(cells, 0, 0);
    expect(cellsEqual(result, cells)).toBe(true);
  });

  it("preserves cell count", () => {
    const cells: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ];
    const result = translateCells(cells, 10, 20);
    expect(result.length).toBe(cells.length);
  });
});

describe("getBoundingBox", () => {
  it("I1 has bounding box 1x1", () => {
    const I1 = PIECES.find((p) => p.id === 0)!;
    const box = getBoundingBox(I1.cells);
    expect(box.rows).toBe(1);
    expect(box.cols).toBe(1);
  });

  it("I2 horizontal has bounding box 1x2", () => {
    const I2 = PIECES.find((p) => p.id === 1)!;
    const box = getBoundingBox(I2.cells);
    expect(box.rows).toBe(1);
    expect(box.cols).toBe(2);
  });

  it("I5 (id=9) has bounding box 1x5", () => {
    const I5 = PIECES.find((p) => p.id === 9)!;
    const box = getBoundingBox(I5.cells);
    expect(box.rows).toBe(1);
    expect(box.cols).toBe(5);
  });

  it("O4 (id=7) has bounding box 2x2", () => {
    const O4 = PIECES.find((p) => p.id === 7)!;
    const box = getBoundingBox(O4.cells);
    expect(box.rows).toBe(2);
    expect(box.cols).toBe(2);
  });

  it("L4 (id=5) has bounding box 3x2", () => {
    const L4 = PIECES.find((p) => p.id === 5)!;
    const box = getBoundingBox(L4.cells);
    expect(box.rows).toBe(3);
    expect(box.cols).toBe(2);
  });

  it("T5 (id=15) has bounding box 3x3", () => {
    const T5 = PIECES.find((p) => p.id === 15)!;
    const box = getBoundingBox(T5.cells);
    expect(box.rows).toBe(3);
    expect(box.cols).toBe(3);
  });
});

describe("cellsEqual", () => {
  it("same cells same order returns true", () => {
    const a: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    const b: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    expect(cellsEqual(a, b)).toBe(true);
  });

  it("same cells different order returns true", () => {
    const a: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    const b: [number, number][] = [
      [1, 0],
      [0, 0],
      [0, 1],
    ];
    expect(cellsEqual(a, b)).toBe(true);
  });

  it("different cells returns false", () => {
    const a: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const b: [number, number][] = [
      [0, 0],
      [1, 0],
    ];
    expect(cellsEqual(a, b)).toBe(false);
  });

  it("different lengths returns false", () => {
    const a: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const b: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    expect(cellsEqual(a, b)).toBe(false);
  });

  it("empty arrays are equal", () => {
    const a: [number, number][] = [];
    const b: [number, number][] = [];
    expect(cellsEqual(a, b)).toBe(true);
  });
});

describe("PIECES", () => {
  it("contains exactly 21 pieces", () => {
    expect(PIECES.length).toBe(21);
  });

  it("has unique ids from 0 to 20", () => {
    const ids = PIECES.map((p) => p.id).sort((a, b) => a - b);
    expect(ids).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it("has unique names", () => {
    const names = PIECES.map((p) => p.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(21);
  });

  it("each piece has correct size matching cell count", () => {
    for (const piece of PIECES) {
      expect(piece.cells.length).toBe(piece.size);
    }
  });

  it("all pieces are normalized (min row and col are 0)", () => {
    for (const piece of PIECES) {
      const minR = Math.min(...piece.cells.map(([r]) => r));
      const minC = Math.min(...piece.cells.map(([, c]) => c));
      expect(minR).toBe(0);
      expect(minC).toBe(0);
    }
  });
});
