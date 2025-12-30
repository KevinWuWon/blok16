import { describe, it, expect } from 'vitest'
import {
  createEmptyBoard,
  findCornerAnchors,
  findValidPlacementsAtAnchor,
  findNearestValidAnchor,
  findBestPlacementForCursor,
  getCellsCenter,
  isValidPlacement,
  getValidAnchorsForPiece,
  getFlippedOrientation,
  STARTING_POSITIONS,
} from './validation'

describe('findNearestValidAnchor', () => {
  it('returns null for empty anchor list', () => {
    const result = findNearestValidAnchor(5, 5, [])
    expect(result).toBeNull()
  })

  it('returns the only anchor when there is just one', () => {
    const anchors: [number, number][] = [[9, 9]]
    const result = findNearestValidAnchor(5, 5, anchors)
    expect(result).toEqual([9, 9])
  })

  it('returns the nearest anchor by euclidean distance', () => {
    const anchors: [number, number][] = [[0, 0], [5, 5], [10, 10]]

    // Closest to [0, 0]
    expect(findNearestValidAnchor(1, 1, anchors)).toEqual([0, 0])

    // Closest to [5, 5]
    expect(findNearestValidAnchor(4, 6, anchors)).toEqual([5, 5])

    // Closest to [10, 10]
    expect(findNearestValidAnchor(9, 9, anchors)).toEqual([10, 10])
  })

  it('handles ties by returning the first matching anchor', () => {
    const anchors: [number, number][] = [[0, 2], [2, 0]]
    // Both are equidistant from [1, 1], should return first one
    const result = findNearestValidAnchor(1, 1, anchors)
    expect(result).toEqual([0, 2])
  })
})

describe('findCornerAnchors', () => {
  it('returns starting position for first move', () => {
    const board = createEmptyBoard()

    const blueAnchors = findCornerAnchors(board, 'blue')
    expect(blueAnchors).toEqual([[STARTING_POSITIONS.blue.row, STARTING_POSITIONS.blue.col]])

    const orangeAnchors = findCornerAnchors(board, 'orange')
    expect(orangeAnchors).toEqual([[STARTING_POSITIONS.orange.row, STARTING_POSITIONS.orange.col]])
  })

  it('returns diagonal corners after placing a piece', () => {
    const board = createEmptyBoard()
    // Place a single blue piece at the starting position
    board[4][4] = 1 // blue

    const anchors = findCornerAnchors(board, 'blue')

    // Should have 4 diagonal neighbors (minus any out of bounds)
    // (3,3), (3,5), (5,3), (5,5)
    expect(anchors).toContainEqual([3, 3])
    expect(anchors).toContainEqual([3, 5])
    expect(anchors).toContainEqual([5, 3])
    expect(anchors).toContainEqual([5, 5])
    expect(anchors.length).toBe(4)
  })
})

describe('findValidPlacementsAtAnchor - first move', () => {
  it('finds multiple placements for single-cell piece at starting position', () => {
    const board = createEmptyBoard()
    const pieceId = 0 // I1 - single cell

    const placements = findValidPlacementsAtAnchor(
      board,
      pieceId,
      STARTING_POSITIONS.orange.row,
      STARTING_POSITIONS.orange.col,
      'orange'
    )

    // Single cell piece should have exactly 1 placement at the anchor
    expect(placements.length).toBe(1)
    expect(placements[0].cells).toContainEqual([9, 9])
  })

  it('finds multiple placements for multi-cell piece at starting position', () => {
    const board = createEmptyBoard()
    const pieceId = 1 // I2 - two cells horizontal

    const placements = findValidPlacementsAtAnchor(
      board,
      pieceId,
      STARTING_POSITIONS.orange.row,
      STARTING_POSITIONS.orange.col,
      'orange'
    )

    // I2 has 2 orientations (horizontal and vertical)
    // For each orientation, either cell can be on the anchor
    // So: 2 orientations × 2 cells = 4 placements
    expect(placements.length).toBe(4)

    // All placements should include the starting position
    for (const placement of placements) {
      const includesStart = placement.cells.some(
        ([r, c]) => r === 9 && c === 9
      )
      expect(includesStart).toBe(true)
    }
  })

  it('finds many placements for 5-cell piece at starting position', () => {
    const board = createEmptyBoard()
    const pieceId = 20 // X5 - plus shape (most symmetric)

    const placements = findValidPlacementsAtAnchor(
      board,
      pieceId,
      STARTING_POSITIONS.orange.row,
      STARTING_POSITIONS.orange.col,
      'orange'
    )

    // X5 has 1 unique orientation, 5 cells
    // Each cell can be placed on the anchor = 5 placements
    expect(placements.length).toBe(5)

    // All placements should include the starting position
    for (const placement of placements) {
      const includesStart = placement.cells.some(
        ([r, c]) => r === 9 && c === 9
      )
      expect(includesStart).toBe(true)
    }
  })

  it('finds correct number of placements for Z5 piece', () => {
    const board = createEmptyBoard()
    const pieceId = 18 // Z5 - the piece from user's test

    const placements = findValidPlacementsAtAnchor(
      board,
      pieceId,
      STARTING_POSITIONS.orange.row,
      STARTING_POSITIONS.orange.col,
      'orange'
    )

    // Z5 has multiple orientations × cells that can cover anchor
    expect(placements.length).toBeGreaterThan(1)

    // All placements should include the starting position
    for (const placement of placements) {
      const includesStart = placement.cells.some(
        ([r, c]) => r === 9 && c === 9
      )
      expect(includesStart).toBe(true)
    }
  })
})

describe('getValidAnchorsForPiece', () => {
  it('returns starting position as only valid anchor for first move', () => {
    const board = createEmptyBoard()
    const pieceId = 0 // any piece

    const anchors = getValidAnchorsForPiece(board, pieceId, 'orange')

    expect(anchors).toEqual([[9, 9]])
  })

  it('returns multiple anchors after pieces are placed', () => {
    const board = createEmptyBoard()
    // Place an L-shaped piece for orange
    board[9][9] = 2
    board[10][9] = 2
    board[11][9] = 2
    board[11][10] = 2

    const anchors = getValidAnchorsForPiece(board, 0, 'orange') // single cell piece

    // Should have multiple diagonal corners now
    expect(anchors.length).toBeGreaterThan(1)
  })
})

describe('isValidPlacement', () => {
  it('requires first move to cover starting position', () => {
    const board = createEmptyBoard()

    // Placement covering starting position - valid
    const validCells: [number, number][] = [[9, 9]]
    expect(isValidPlacement(board, validCells, 'orange')).toBe(true)

    // Placement NOT covering starting position - invalid
    const invalidCells: [number, number][] = [[5, 5]]
    expect(isValidPlacement(board, invalidCells, 'orange')).toBe(false)
  })

  it('rejects placement touching own pieces orthogonally', () => {
    const board = createEmptyBoard()
    board[9][9] = 2 // orange piece

    // Adjacent placement - invalid (touches orthogonally)
    const adjacentCells: [number, number][] = [[9, 10]]
    expect(isValidPlacement(board, adjacentCells, 'orange')).toBe(false)
  })

  it('accepts placement touching own pieces diagonally', () => {
    const board = createEmptyBoard()
    board[9][9] = 2 // orange piece

    // Diagonal placement - valid
    const diagonalCells: [number, number][] = [[10, 10]]
    expect(isValidPlacement(board, diagonalCells, 'orange')).toBe(true)
  })
})

describe('getCellsCenter', () => {
  it('returns the center of a single cell', () => {
    const center = getCellsCenter([[5, 5]])
    expect(center).toEqual({ row: 5, col: 5 })
  })

  it('returns the center of multiple cells', () => {
    // 3 cells in a row: [0,0], [0,1], [0,2]
    const center = getCellsCenter([[0, 0], [0, 1], [0, 2]])
    expect(center.row).toBe(0)
    expect(center.col).toBe(1) // middle column
  })

  it('returns fractional center for odd-shaped pieces', () => {
    // L-shape: [0,0], [1,0], [1,1]
    const center = getCellsCenter([[0, 0], [1, 0], [1, 1]])
    expect(center.row).toBeCloseTo(2 / 3)
    expect(center.col).toBeCloseTo(1 / 3)
  })
})

describe('findBestPlacementForCursor', () => {
  it('returns null for empty placements list', () => {
    const result = findBestPlacementForCursor(5, 5, [])
    expect(result).toBeNull()
  })

  it('returns the only placement when there is just one', () => {
    const placements = [
      { cells: [[5, 5]] as [number, number][], orientationIndex: 0 },
    ]
    const result = findBestPlacementForCursor(0, 0, placements)
    expect(result).toEqual(placements[0])
  })

  it('returns the placement with center closest to cursor', () => {
    const placements = [
      { cells: [[0, 0], [0, 1]] as [number, number][], orientationIndex: 0 }, // center at (0, 0.5)
      { cells: [[5, 5], [5, 6]] as [number, number][], orientationIndex: 1 }, // center at (5, 5.5)
    ]

    // Cursor near first placement
    expect(findBestPlacementForCursor(0, 0, placements)).toEqual(placements[0])

    // Cursor near second placement
    expect(findBestPlacementForCursor(5, 5, placements)).toEqual(placements[1])
  })

  it('picks correct placement for first move with I2 piece', () => {
    const board = createEmptyBoard()
    const pieceId = 1 // I2 - two cells

    const placements = findValidPlacementsAtAnchor(
      board,
      pieceId,
      STARTING_POSITIONS.orange.row,
      STARTING_POSITIONS.orange.col,
      'orange'
    )

    // When cursor is to the LEFT of starting position, should pick placement
    // where the piece extends to the left
    const leftResult = findBestPlacementForCursor(9, 7, placements)
    expect(leftResult).not.toBeNull()
    // The center of this placement should be to the left of the starting position
    const leftCenter = getCellsCenter(leftResult!.cells)
    expect(leftCenter.col).toBeLessThan(9)

    // When cursor is to the RIGHT of starting position, should pick placement
    // where the piece extends to the right
    const rightResult = findBestPlacementForCursor(9, 11, placements)
    expect(rightResult).not.toBeNull()
    const rightCenter = getCellsCenter(rightResult!.cells)
    expect(rightCenter.col).toBeGreaterThan(9)
  })

  it('prefers matching orientation when distances are close', () => {
    // Two placements with similar centers but different orientations
    const placements = [
      { cells: [[5, 5], [5, 6]] as [number, number][], orientationIndex: 0 },
      { cells: [[5, 5], [5, 6]] as [number, number][], orientationIndex: 1 },
    ]

    // With preferred orientation 1, should pick second placement
    const result = findBestPlacementForCursor(5, 5, placements, 1)
    expect(result?.orientationIndex).toBe(1)
  })
})

describe('getFlippedOrientation', () => {
  it('flips P5 piece without shifting position (first move)', () => {
    // First move scenario - piece must cover starting position
    const board = createEmptyBoard()

    // P5 covering starting position [9,9] at top-left of piece
    // Original P5: XX / XX / X (bottom-left tail)
    const originalCells: [number, number][] = [
      [9, 9], [9, 10],    // top row covers starting position
      [10, 9], [10, 10],  // middle row
      [11, 9],            // bottom left
    ]

    const flipped = getFlippedOrientation(board, originalCells, 'orange')

    expect(flipped).not.toBeNull()

    // The flipped piece should have the same center (or very close)
    const originalCenter = getCellsCenter(originalCells)
    const flippedCenter = getCellsCenter(flipped!)

    // Row should be exactly the same
    expect(flippedCenter.row).toBeCloseTo(originalCenter.row, 0)
    // Column can shift by at most 0.5 (due to asymmetric piece)
    expect(Math.abs(flippedCenter.col - originalCenter.col)).toBeLessThanOrEqual(0.5)
  })

  it('does not shift piece vertically when flipping', () => {
    // First move scenario
    const board = createEmptyBoard()

    // P5 covering starting position
    const originalCells: [number, number][] = [
      [9, 9], [9, 10],    // XX
      [10, 9], [10, 10],  // XX
      [11, 9],            // X  (bottom-left tail)
    ]

    const flipped = getFlippedOrientation(board, originalCells, 'orange')

    expect(flipped).not.toBeNull()

    // Row values should be the same - no vertical shift
    const originalRows = originalCells.map(([r]) => r).sort((a, b) => a - b)
    const flippedRows = flipped!.map(([r]) => r).sort((a, b) => a - b)

    expect(flippedRows).toEqual(originalRows)
  })

  it('flips piece horizontally, moving tail from left to right', () => {
    const board = createEmptyBoard()

    // P5 with tail on the left
    const originalCells: [number, number][] = [
      [9, 9], [9, 10],
      [10, 9], [10, 10],
      [11, 9],            // tail on LEFT (col 9)
    ]

    const flipped = getFlippedOrientation(board, originalCells, 'orange')

    expect(flipped).not.toBeNull()

    // After flip, tail should be on the RIGHT (col 10)
    const tailCell = flipped!.find(([r]) => r === 11)
    expect(tailCell).toBeDefined()
    expect(tailCell![1]).toBe(10) // tail moved from col 9 to col 10
  })
})
