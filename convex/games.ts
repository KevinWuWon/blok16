import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { PIECES } from "./shared/pieces";
import {
  createEmptyBoard,
  playerToValue,
  isValidPlacement,
  hasValidMoves,
  determineWinner,
  type PlayerColor,
} from "./shared/validation";

// Helper to schedule push notification
async function schedulePushNotification(
  scheduler: MutationCtx["scheduler"],
  playerId: string,
  title: string,
  body: string,
  gameCode: string,
  tag: string
) {
  await scheduler.runAfter(0, api.pushActions.sendPushNotification, {
    playerId,
    title,
    body,
    gameCode,
    tag,
  });
}

type Player = string | { id: string; name: string };

// Helper to extract player ID from legacy or new format
function normalizePlayer(player: Player | undefined): string | undefined {
  if (!player) return undefined;
  if (typeof player === "string") return player;
  return player.id;
}

// Helper to get player name (returns "Anonymous" for legacy format)
function getPlayerName(player: Player | undefined): string | undefined {
  if (!player) return undefined;
  if (typeof player === "string") return "Anonymous";
  return player.name;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

export const getMyGames = query({
  args: { playerId: v.string() },
  handler: async (ctx, args) => {
    // Get all games and filter by player ID and active status
    const allGames = await ctx.db.query("games").collect();

    return allGames.filter((game) => {
      // Only active games (waiting or playing)
      if (game.status !== "waiting" && game.status !== "playing") {
        return false;
      }

      // Check if player is in this game
      const blueId = normalizePlayer(game.players.blue);
      const orangeId = normalizePlayer(game.players.orange);
      return blueId === args.playerId || orangeId === args.playerId;
    }).map((game) => {
      // Determine player's color and opponent info
      const blueId = normalizePlayer(game.players.blue);
      const isBlue = blueId === args.playerId;
      const myColor = isBlue ? "blue" : "orange";
      const opponentColor = isBlue ? "orange" : "blue";
      const opponent = game.players[opponentColor];
      const opponentName = getPlayerName(opponent);

      return {
        code: game.code,
        status: game.status,
        myColor,
        currentTurn: game.currentTurn,
        isMyTurn: game.currentTurn === myColor,
        opponentName: opponentName || null,
      };
    });
  },
});

// Mutations

export const createGame = mutation({
  args: {
    playerId: v.string(),
    playerName: v.optional(v.string()),
    playerColor: v.optional(v.union(v.literal("blue"), v.literal("orange"))),
  },
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
    const color = args.playerColor || "blue";
    const player = args.playerName
      ? { id: args.playerId, name: args.playerName }
      : args.playerId;

    const gameId = await ctx.db.insert("games", {
      code,
      board: createEmptyBoard(),
      players: {
        blue: color === "blue" ? player : undefined,
        orange: color === "orange" ? player : undefined,
      },
      pieces: { blue: allPieces, orange: [...allPieces] },
      currentTurn: "blue",
      status: "waiting",
      winner: null,
      lastPassedBy: null,
      createdAt: Date.now(),
    });

    return { code, gameId, color };
  },
});

export const joinGame = mutation({
  args: { code: v.string(), playerId: v.string(), playerName: v.optional(v.string()) },
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

    if (normalizePlayer(game.players.blue) === args.playerId) {
      // Already the blue player
      return { success: true, color: "blue" as const };
    }

    if (game.players.orange) {
      return { success: false, error: "Game is full" };
    }

    const player = args.playerName
      ? { id: args.playerId, name: args.playerName }
      : args.playerId;

    await ctx.db.patch(game._id, {
      players: { ...game.players, orange: player },
      status: "playing",
    });

    return { success: true, color: "orange" as const };
  },
});

export const claimColor = mutation({
  args: {
    code: v.string(),
    playerId: v.string(),
    playerName: v.string(),
    color: v.union(v.literal("blue"), v.literal("orange")),
    forceTakeover: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    const currentPlayer = game.players[args.color];
    const currentPlayerId = normalizePlayer(currentPlayer);
    const currentPlayerName = getPlayerName(currentPlayer);

    // Check if this player already has this color
    if (currentPlayerId === args.playerId) {
      return { success: true, alreadyClaimed: true };
    }

    // Check if color is taken by someone else
    if (currentPlayer && !args.forceTakeover) {
      return {
        success: false,
        requiresConfirmation: true,
        currentPlayerName: currentPlayerName || "Anonymous",
      };
    }

    // Check if player is already the other color
    const otherColor = args.color === "blue" ? "orange" : "blue";
    const otherPlayer = game.players[otherColor];
    if (normalizePlayer(otherPlayer) === args.playerId) {
      // Player is switching colors - clear their old slot
      await ctx.db.patch(game._id, {
        players: {
          ...game.players,
          [otherColor]: undefined,
          [args.color]: { id: args.playerId, name: args.playerName },
        },
      });
      return { success: true };
    }

    const newPlayer = { id: args.playerId, name: args.playerName };
    const updatedPlayers = {
      ...game.players,
      [args.color]: newPlayer,
    };

    // Check if both players are now claimed to start the game
    const blueId = normalizePlayer(updatedPlayers.blue);
    const orangeId = normalizePlayer(updatedPlayers.orange);
    const shouldStartGame = blueId && orangeId && blueId !== orangeId;

    await ctx.db.patch(game._id, {
      players: updatedPlayers,
      status: shouldStartGame ? "playing" : game.status,
    });

    return { success: true, gameStarted: shouldStartGame };
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
    if (normalizePlayer(game.players.blue) === args.playerId) {
      playerColor = "blue";
    } else if (normalizePlayer(game.players.orange) === args.playerId) {
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
    let nextTurnFinal: "blue" | "orange" = nextTurn;
    let nextLastPassedBy: "blue" | "orange" | null = null;

    if (!opponentCanMove && !currentCanMove) {
      // Game over
      newStatus = "finished";
      newWinner = determineWinner(newPieces.blue, newPieces.orange);
    } else if (!opponentCanMove && currentCanMove) {
      // Opponent has no moves; auto-skip their turn back to the current player.
      nextTurnFinal = playerColor;
      nextLastPassedBy = nextTurn;
    }

    await ctx.db.patch(game._id, {
      board: newBoard,
      pieces: newPieces,
      currentTurn: nextTurnFinal,
      status: newStatus,
      winner: newWinner,
      lastPassedBy: newStatus === "playing" ? nextLastPassedBy : null,
      lastPlacement: args.cells,
    });

    // Send push notification to the next player (if game is still playing)
    if (newStatus === "playing") {
      const nextPlayer = game.players[nextTurnFinal];
      const nextPlayerId = normalizePlayer(nextPlayer);
      if (nextPlayerId) {
        await schedulePushNotification(
          ctx.scheduler,
          nextPlayerId,
          "Blokli",
          "It's your turn!",
          args.code,
          "your-turn"
        );
      }
    } else if (newStatus === "finished") {
      // Notify both players about game end
      const bluePlayerId = normalizePlayer(game.players.blue);
      const orangePlayerId = normalizePlayer(game.players.orange);

      if (bluePlayerId) {
        const message = newWinner === "blue" ? "You won! 🎉" : newWinner === "draw" ? "It's a draw!" : "You lost!";
        await schedulePushNotification(
          ctx.scheduler,
          bluePlayerId,
          "Blokli - Game Over",
          message,
          args.code,
          "game-end"
        );
      }
      if (orangePlayerId) {
        const message = newWinner === "orange" ? "You won! 🎉" : newWinner === "draw" ? "It's a draw!" : "You lost!";
        await schedulePushNotification(
          ctx.scheduler,
          orangePlayerId,
          "Blokli - Game Over",
          message,
          args.code,
          "game-end"
        );
      }
    }

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
    if (normalizePlayer(game.players.blue) === args.playerId) {
      playerColor = "blue";
    } else if (normalizePlayer(game.players.orange) === args.playerId) {
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
    const opponentPieces = game.pieces[nextTurn];
    const opponentCanMove = hasValidMoves(game.board, opponentPieces, nextTurn);

    const shouldEndGame = !opponentCanMove || game.lastPassedBy === nextTurn;

    if (shouldEndGame) {
      // Neither player has moves available, or both passed - game over
      const winner = determineWinner(game.pieces.blue, game.pieces.orange);
      await ctx.db.patch(game._id, {
        status: "finished",
        winner,
        currentTurn: nextTurn,
      });

      // Notify both players about game end
      const bluePlayerId = normalizePlayer(game.players.blue);
      const orangePlayerId = normalizePlayer(game.players.orange);

      if (bluePlayerId) {
        const message = winner === "blue" ? "You won! 🎉" : winner === "draw" ? "It's a draw!" : "You lost!";
        await schedulePushNotification(
          ctx.scheduler,
          bluePlayerId,
          "Blokli - Game Over",
          message,
          args.code,
          "game-end"
        );
      }
      if (orangePlayerId) {
        const message = winner === "orange" ? "You won! 🎉" : winner === "draw" ? "It's a draw!" : "You lost!";
        await schedulePushNotification(
          ctx.scheduler,
          orangePlayerId,
          "Blokli - Game Over",
          message,
          args.code,
          "game-end"
        );
      }
    } else {
      await ctx.db.patch(game._id, {
        currentTurn: nextTurn,
        lastPassedBy: playerColor,
      });

      // Notify next player it's their turn
      const nextPlayer = game.players[nextTurn];
      const nextPlayerId = normalizePlayer(nextPlayer);
      if (nextPlayerId) {
        await schedulePushNotification(
          ctx.scheduler,
          nextPlayerId,
          "Blokli",
          "It's your turn!",
          args.code,
          "your-turn"
        );
      }
    }

    return { success: true };
  },
});

export const requestRematch = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== "finished") {
      return { success: false, error: "Game is not finished" };
    }

    if (game.nextGameCode) {
      return { success: false, error: "Rematch already started", nextGameCode: game.nextGameCode };
    }

    // Determine player color
    let playerColor: PlayerColor;
    if (normalizePlayer(game.players.blue) === args.playerId) {
      playerColor = "blue";
    } else if (normalizePlayer(game.players.orange) === args.playerId) {
      playerColor = "orange";
    } else {
      return { success: false, error: "Not a player in this game" };
    }

    // Update rematch requests
    const newRematchRequests = {
      ...game.rematchRequests,
      [playerColor]: true as const,
    };

    // Check if both players want rematch
    if (newRematchRequests.blue && newRematchRequests.orange) {
      // Create new game with swapped colors
      let newCode: string;
      let existing: Doc<"games"> | null;
      do {
        newCode = generateCode();
        existing = await ctx.db
          .query("games")
          .withIndex("by_code", (q) => q.eq("code", newCode))
          .first();
      } while (existing);

      const allPieces = Array.from({ length: 21 }, (_, i) => i);

      // Swap colors: old blue becomes new orange, old orange becomes new blue
      await ctx.db.insert("games", {
        code: newCode,
        board: createEmptyBoard(),
        players: {
          blue: game.players.orange,
          orange: game.players.blue,
        },
        pieces: { blue: allPieces, orange: [...allPieces] },
        currentTurn: "blue",
        status: "playing",
        winner: null,
        lastPassedBy: null,
        previousGameCode: args.code,
        createdAt: Date.now(),
      });

      // Update old game with link to new game
      await ctx.db.patch(game._id, {
        rematchRequests: newRematchRequests,
        nextGameCode: newCode,
      });

      // Notify both players
      const bluePlayerId = normalizePlayer(game.players.blue);
      const orangePlayerId = normalizePlayer(game.players.orange);

      if (bluePlayerId) {
        await schedulePushNotification(
          ctx.scheduler,
          bluePlayerId,
          "Blokli",
          "Rematch is starting!",
          newCode,
          "rematch-starting"
        );
      }
      if (orangePlayerId) {
        await schedulePushNotification(
          ctx.scheduler,
          orangePlayerId,
          "Blokli",
          "Rematch is starting!",
          newCode,
          "rematch-starting"
        );
      }

      return { success: true, newGameCode: newCode };
    }

    // First request - just store it
    await ctx.db.patch(game._id, {
      rematchRequests: newRematchRequests,
    });

    return { success: true, waiting: true };
  },
});

export const nudgePlayer = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, args) => {
    console.log("[Nudge] nudgePlayer mutation called", args);

    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!game) {
      console.log("[Nudge] Game not found");
      return { success: false, error: "Game not found" };
    }

    console.log("[Nudge] Game found", { status: game.status, currentTurn: game.currentTurn });

    if (game.status !== "playing") {
      console.log("[Nudge] Game not in progress");
      return { success: false, error: "Game is not in progress" };
    }

    // Determine player color
    let playerColor: PlayerColor;
    if (normalizePlayer(game.players.blue) === args.playerId) {
      playerColor = "blue";
    } else if (normalizePlayer(game.players.orange) === args.playerId) {
      playerColor = "orange";
    } else {
      console.log("[Nudge] Not a player in this game");
      return { success: false, error: "Not a player in this game" };
    }

    console.log("[Nudge] Player color:", playerColor);

    // Can only nudge when it's NOT your turn
    if (game.currentTurn === playerColor) {
      console.log("[Nudge] It's your turn, can't nudge");
      return { success: false, error: "It's your turn, not the opponent's" };
    }

    // Get opponent player ID
    const opponentColor = playerColor === "blue" ? "orange" : "blue";
    const opponent = game.players[opponentColor];
    const opponentId = normalizePlayer(opponent);

    console.log("[Nudge] Opponent info", { opponentColor, opponentId });

    if (!opponentId) {
      console.log("[Nudge] Opponent not found");
      return { success: false, error: "Opponent not found" };
    }

    // Send push notification
    console.log("[Nudge] Scheduling push notification to", opponentId);
    await schedulePushNotification(
      ctx.scheduler,
      opponentId,
      "Blokli",
      "Still waiting for your move!",
      args.code,
      "nudge"
    );

    console.log("[Nudge] Push notification scheduled successfully");
    return { success: true };
  },
});
