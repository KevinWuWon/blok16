import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

// Re-implement validation logic for server-side (can't import from lib in Convex)
const BOARD_SIZE = 14;
const STARTING_POSITIONS = {
  blue: { row: 4, col: 4 },
  orange: { row: 9, col: 9 },
} as const;

type PlayerColor = "blue" | "orange";
type Board = number[][];

// All 21 piece definitions
const PIECES = [
  { id: 0, name: "I1", size: 1, cells: [[0, 0]] },
  { id: 1, name: "I2", size: 2, cells: [[0, 0], [0, 1]] },
  { id: 2, name: "I3", size: 3, cells: [[0, 0], [0, 1], [0, 2]] },
  { id: 3, name: "V3", size: 3, cells: [[0, 0], [1, 0], [1, 1]] },
  { id: 4, name: "I4", size: 4, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: 5, name: "L4", size: 4, cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { id: 6, name: "T4", size: 4, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: 7, name: "O4", size: 4, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: 8, name: "S4", size: 4, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
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
] as const;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function playerToValue(player: PlayerColor): number {
  return player === "blue" ? 1 : 2;
}

function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getOrthogonalNeighbors(row: number, col: number): [number, number][] {
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
}

function getDiagonalNeighbors(row: number, col: number): [number, number][] {
  return [[row - 1, col - 1], [row - 1, col + 1], [row + 1, col - 1], [row + 1, col + 1]];
}

function hasPlacedPieces(board: Board, player: PlayerColor): boolean {
  const value = playerToValue(player);
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === value) return true;
    }
  }
  return false;
}

function isValidPlacement(
  board: Board,
  cells: [number, number][],
  player: PlayerColor
): boolean {
  const value = playerToValue(player);
  const isFirstMove = !hasPlacedPieces(board, player);

  // Check all cells are in bounds and empty
  for (const [r, c] of cells) {
    if (!isInBounds(r, c) || board[r][c] !== 0) return false;
  }

  // Check no cell orthogonally touches player's own pieces
  for (const [r, c] of cells) {
    for (const [nr, nc] of getOrthogonalNeighbors(r, c)) {
      if (isInBounds(nr, nc) && board[nr][nc] === value) return false;
    }
  }

  // First move: must cover starting position
  if (isFirstMove) {
    const start = STARTING_POSITIONS[player];
    return cells.some(([r, c]) => r === start.row && c === start.col);
  }

  // Subsequent moves: at least one cell must diagonally touch player's piece
  for (const [r, c] of cells) {
    for (const [dr, dc] of getDiagonalNeighbors(r, c)) {
      if (isInBounds(dr, dc) && board[dr][dc] === value) return true;
    }
  }
  return false;
}

function normalize(cells: number[][]): [number, number][] {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}

function rotateCW(cells: number[][]): [number, number][] {
  const rotated = cells.map(([r, c]) => [c, -r]);
  return normalize(rotated);
}

function flipH(cells: number[][]): [number, number][] {
  const flipped = cells.map(([r, c]) => [r, -c]);
  return normalize(flipped);
}

function getAllOrientations(cells: number[][]): [number, number][][] {
  const orientations: [number, number][][] = [];
  const seen = new Set<string>();

  let current = normalize(cells);

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const key = current.map(([r, c]) => `${r},${c}`).sort().join("|");
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

function translateCells(cells: [number, number][], rowOffset: number, colOffset: number): [number, number][] {
  return cells.map(([r, c]) => [r + rowOffset, c + colOffset]);
}

function findCornerAnchors(board: Board, player: PlayerColor): [number, number][] {
  const value = playerToValue(player);
  const anchors: [number, number][] = [];

  if (!hasPlacedPieces(board, player)) {
    const start = STARTING_POSITIONS[player];
    return [[start.row, start.col]];
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) continue;

      let touchesDiagonal = false;
      for (const [dr, dc] of getDiagonalNeighbors(r, c)) {
        if (isInBounds(dr, dc) && board[dr][dc] === value) {
          touchesDiagonal = true;
          break;
        }
      }
      if (!touchesDiagonal) continue;

      let touchesOrthogonal = false;
      for (const [or, oc] of getOrthogonalNeighbors(r, c)) {
        if (isInBounds(or, oc) && board[or][oc] === value) {
          touchesOrthogonal = true;
          break;
        }
      }

      if (!touchesOrthogonal) anchors.push([r, c]);
    }
  }

  return anchors;
}

function canPlacePieceAnywhere(board: Board, pieceId: number, player: PlayerColor): boolean {
  const piece = PIECES[pieceId];
  const orientations = getAllOrientations(piece.cells.map(c => [...c]) as number[][]);
  const anchors = findCornerAnchors(board, player);

  for (const anchor of anchors) {
    for (const orientation of orientations) {
      for (const [cellR, cellC] of orientation) {
        const rowOffset = anchor[0] - cellR;
        const colOffset = anchor[1] - cellC;
        const placedCells = translateCells(orientation, rowOffset, colOffset);
        if (isValidPlacement(board, placedCells, player)) return true;
      }
    }
  }
  return false;
}

function hasValidMoves(board: Board, remainingPieces: number[], player: PlayerColor): boolean {
  for (const pieceId of remainingPieces) {
    if (canPlacePieceAnywhere(board, pieceId, player)) return true;
  }
  return false;
}

function calculateScore(remainingPieces: number[]): number {
  return remainingPieces.reduce((sum, pieceId) => sum + PIECES[pieceId].size, 0);
}

function determineWinner(blueRemaining: number[], orangeRemaining: number[]): "blue" | "orange" | "draw" {
  const blueScore = calculateScore(blueRemaining);
  const orangeScore = calculateScore(orangeRemaining);
  if (blueScore < orangeScore) return "blue";
  if (orangeScore < blueScore) return "orange";
  return "draw";
}

// Queries

export const getGame = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

// Mutations

export const createGame = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    // Generate unique code
    let code: string;
    let existing: Doc<"games"> | null;
    do {
      code = generateCode();
      existing = await ctx.db
        .query("games")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    } while (existing);

    const allPieces = Array.from({ length: 21 }, (_, i) => i);

    const gameId = await ctx.db.insert("games", {
      code,
      board: createEmptyBoard(),
      players: { blue: args.playerId, orange: undefined },
      pieces: { blue: allPieces, orange: [...allPieces] },
      currentTurn: "blue",
      status: "waiting",
      winner: null,
      lastPassedBy: null,
      createdAt: Date.now(),
    });

    return { code, gameId };
  },
});

export const joinGame = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== "waiting") {
      return { success: false, error: "Game already started" };
    }

    if (game.players.blue === args.playerId) {
      // Already the blue player
      return { success: true, color: "blue" as const };
    }

    if (game.players.orange) {
      return { success: false, error: "Game is full" };
    }

    await ctx.db.patch(game._id, {
      players: { ...game.players, orange: args.playerId },
      status: "playing",
    });

    return { success: true, color: "orange" as const };
  },
});

export const placePiece = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    pieceId: v.number(),
    cells: v.array(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== "playing") {
      return { success: false, error: "Game is not in progress" };
    }

    // Determine player color
    let playerColor: PlayerColor;
    if (game.players.blue === args.playerId) {
      playerColor = "blue";
    } else if (game.players.orange === args.playerId) {
      playerColor = "orange";
    } else {
      return { success: false, error: "Not a player in this game" };
    }

    if (game.currentTurn !== playerColor) {
      return { success: false, error: "Not your turn" };
    }

    const playerPieces = game.pieces[playerColor];
    if (!playerPieces.includes(args.pieceId)) {
      return { success: false, error: "Piece not available" };
    }

    const cells = args.cells as [number, number][];
    const piece = PIECES[args.pieceId];
    if (cells.length !== piece.size) {
      return { success: false, error: "Invalid cell count for piece" };
    }

    // Validate placement
    if (!isValidPlacement(game.board, cells, playerColor)) {
      return { success: false, error: "Invalid placement" };
    }

    // Apply placement
    const newBoard = game.board.map((row) => [...row]);
    const value = playerToValue(playerColor);
    for (const [r, c] of cells) {
      newBoard[r][c] = value;
    }

    // Remove piece from player's remaining pieces
    const newPieces = {
      ...game.pieces,
      [playerColor]: playerPieces.filter((id) => id !== args.pieceId),
    };

    // Switch turn
    const nextTurn = playerColor === "blue" ? "orange" : "blue";

    // Check if game should end
    const opponentPieces = newPieces[nextTurn];
    const currentPlayerPieces = newPieces[playerColor];
    const opponentCanMove = hasValidMoves(newBoard, opponentPieces, nextTurn);
    const currentCanMove = hasValidMoves(newBoard, currentPlayerPieces, playerColor);

    let newStatus: "waiting" | "playing" | "finished" = game.status;
    let newWinner: "blue" | "orange" | "draw" | null = game.winner;

    if (!opponentCanMove && !currentCanMove) {
      // Game over
      newStatus = "finished";
      newWinner = determineWinner(newPieces.blue, newPieces.orange);
    }

    await ctx.db.patch(game._id, {
      board: newBoard,
      pieces: newPieces,
      currentTurn: nextTurn,
      status: newStatus,
      winner: newWinner,
      lastPassedBy: null,
    });

    return { success: true };
  },
});

export const passTurn = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== "playing") {
      return { success: false, error: "Game is not in progress" };
    }

    let playerColor: PlayerColor;
    if (game.players.blue === args.playerId) {
      playerColor = "blue";
    } else if (game.players.orange === args.playerId) {
      playerColor = "orange";
    } else {
      return { success: false, error: "Not a player in this game" };
    }

    if (game.currentTurn !== playerColor) {
      return { success: false, error: "Not your turn" };
    }

    // Verify player has no valid moves
    const playerPieces = game.pieces[playerColor];
    if (hasValidMoves(game.board, playerPieces, playerColor)) {
      return { success: false, error: "You have valid moves available" };
    }

    const nextTurn = playerColor === "blue" ? "orange" : "blue";

    // Check if both players have now passed
    if (game.lastPassedBy === nextTurn) {
      // Both passed - game over
      const winner = determineWinner(game.pieces.blue, game.pieces.orange);
      await ctx.db.patch(game._id, {
        status: "finished",
        winner,
        currentTurn: nextTurn,
      });
    } else {
      await ctx.db.patch(game._id, {
        currentTurn: nextTurn,
        lastPassedBy: playerColor,
      });
    }

    return { success: true };
  },
});
