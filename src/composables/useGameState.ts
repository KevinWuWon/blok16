import { computed, type Ref } from "vue";
import { useConvexQuery } from "convex-vue";
import { api } from "../../convex/_generated/api";
import type { PlayerColor, Board } from "../../lib/validation";
import type { GameRole } from "./useGameRole";

type Player = string | { id: string; name: string };

// Helper to get player name from legacy or new format
function getPlayerName(player?: Player): string | null {
  if (!player) return null;
  if (typeof player === "string") return "Anonymous";
  return player.name;
}

// Helper to extract player ID from legacy or new format
function getPlayerId(player?: Player): string | null {
  if (!player) return null;
  if (typeof player === "string") return player;
  return player.id;
}

export function useGameState(code: Ref<string>, role: Ref<GameRole | null>, playerId: Ref<string>) {
  // Convex query for game state
  const { data: game, isPending: isLoading } = useConvexQuery(
    api.games.getGame,
    () => ({
      code: code.value,
    }),
  );

  // Derived player color from role
  const myColor = computed<PlayerColor | null>(() => {
    if (role.value === "blue") return "blue";
    if (role.value === "orange") return "orange";
    return null;
  });

  const isSpectator = computed(() => role.value === "spectator");

  // Detect if player was taken over (their playerId no longer matches the color's player)
  const wasTakenOver = computed(() => {
    if (!game.value || !myColor.value || role.value === "spectator") return false;
    const currentPlayerId = getPlayerId(game.value.players[myColor.value]);
    // Only consider taken over if the slot is occupied by someone else
    return currentPlayerId !== null && currentPlayerId !== playerId.value;
  });

  const isMyTurn = computed(() => {
    if (isSpectator.value || wasTakenOver.value) return false;
    return (
      game.value?.currentTurn === myColor.value &&
      game.value?.status === "playing"
    );
  });

  // Player pieces
  const myPieces = computed(() => {
    if (!game.value || !myColor.value) return [];
    return game.value.pieces[myColor.value];
  });

  const opponentPieces = computed(() => {
    if (!game.value || !myColor.value) return [];
    const opponentColor = myColor.value === "blue" ? "orange" : "blue";
    return game.value.pieces[opponentColor];
  });

  // Player names
  const blueName = computed(() => getPlayerName(game.value?.players.blue));
  const orangeName = computed(() => getPlayerName(game.value?.players.orange));

  const opponentName = computed(() => {
    if (!myColor.value) return "Opponent";
    const name = myColor.value === "blue" ? orangeName.value : blueName.value;
    return name || "Opponent";
  });

  const blueDisplayName = computed(() => blueName.value || "Blue");
  const orangeDisplayName = computed(() => orangeName.value || "Orange");

  // Turn label
  const turnLabel = computed(() => {
    if (!game.value) return "";
    return isMyTurn.value ? "Your turn" : "Their turn";
  });

  // Game URL
  const gameUrl = computed(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/game/${code.value}`;
  });

  // Game board (typed)
  const gameBoard = computed(() => (game.value?.board as Board) ?? []);

  return {
    // Query results
    game,
    isLoading,

    // Derived state
    myColor,
    isSpectator,
    wasTakenOver,
    isMyTurn,
    myPieces,
    opponentPieces,
    blueName,
    orangeName,
    opponentName,
    blueDisplayName,
    orangeDisplayName,
    turnLabel,
    gameUrl,
    gameBoard,
  };
}
