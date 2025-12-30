import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  findCornerAnchors,
  findValidPlacementsAtAnchor,
  getNextValidOrientation,
  hasValidMoves,
  getValidAnchorsForPiece,
  type PlayerColor,
  type Board,
} from "../../lib/validation";
import { PIECES, rotateCW, flipH, translateCells, normalize } from "../../lib/pieces";

export type GameState = Doc<"games">;

export function useGame(code: Ref<string>) {
  // Player ID from localStorage
  const playerId = ref<string>("");

  onMounted(() => {
    let id = localStorage.getItem("blokus-player-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("blokus-player-id", id);
    }
    playerId.value = id;
  });

  // Convex query for game state
  const { data: game, isLoading } = useConvexQuery(api.games.getGame, () => ({
    code: code.value,
  }));

  // Mutations
  const createGameMutation = useConvexMutation(api.games.createGame);
  const joinGameMutation = useConvexMutation(api.games.joinGame);
  const placePieceMutation = useConvexMutation(api.games.placePiece);
  const passTurnMutation = useConvexMutation(api.games.passTurn);

  // Local game state
  const selectedPieceId = ref<number | null>(null);
  const previewCells = ref<[number, number][] | null>(null);
  const currentOrientationIndex = ref(0);

  // Computed values
  const myColor = computed<PlayerColor | null>(() => {
    if (!game.value || !playerId.value) return null;
    if (game.value.players.blue === playerId.value) return "blue";
    if (game.value.players.orange === playerId.value) return "orange";
    return null;
  });

  const isMyTurn = computed(() => {
    return game.value?.currentTurn === myColor.value && game.value?.status === "playing";
  });

  const myPieces = computed(() => {
    if (!game.value || !myColor.value) return [];
    return game.value.pieces[myColor.value];
  });

  const opponentPieces = computed(() => {
    if (!game.value || !myColor.value) return [];
    const opponentColor = myColor.value === "blue" ? "orange" : "blue";
    return game.value.pieces[opponentColor];
  });

  const validAnchors = computed(() => {
    if (!game.value || !myColor.value || !isMyTurn.value) return [];
    return findCornerAnchors(game.value.board as Board, myColor.value);
  });

  const validAnchorsForSelectedPiece = computed(() => {
    if (!game.value || !myColor.value || selectedPieceId.value === null) return [];
    return getValidAnchorsForPiece(game.value.board as Board, selectedPieceId.value, myColor.value);
  });

  const canPass = computed(() => {
    if (!game.value || !myColor.value || !isMyTurn.value) return false;
    return !hasValidMoves(game.value.board as Board, myPieces.value, myColor.value);
  });

  const hasAnyValidMoves = computed(() => {
    if (!game.value || !myColor.value) return true;
    return hasValidMoves(game.value.board as Board, myPieces.value, myColor.value);
  });

  // Actions
  async function createGame() {
    if (!playerId.value) return null;
    const result = await createGameMutation.mutate({ playerId: playerId.value });
    return result;
  }

  async function joinGame() {
    if (!playerId.value || !code.value) return null;
    const result = await joinGameMutation.mutate({
      code: code.value,
      playerId: playerId.value,
    });
    return result;
  }

  function selectPiece(pieceId: number) {
    if (!myPieces.value.includes(pieceId)) return;
    selectedPieceId.value = pieceId;
    previewCells.value = null;
    currentOrientationIndex.value = 0;
  }

  function clearSelection() {
    selectedPieceId.value = null;
    previewCells.value = null;
    currentOrientationIndex.value = 0;
  }

  function handleBoardClick(row: number, col: number) {
    if (!game.value || !myColor.value || !isMyTurn.value) return;
    if (selectedPieceId.value === null) return;

    const placements = findValidPlacementsAtAnchor(
      game.value.board as Board,
      selectedPieceId.value,
      row,
      col,
      myColor.value
    );

    if (placements.length > 0) {
      // Use first valid placement (prefer current orientation if valid)
      const matchingOrientation = placements.find(
        (p) => p.orientationIndex === currentOrientationIndex.value
      );
      const placement = matchingOrientation || placements[0];
      previewCells.value = placement.cells;
      currentOrientationIndex.value = placement.orientationIndex;
    }
  }

  function rotatePiece(direction: "cw" | "ccw") {
    if (!game.value || !myColor.value || selectedPieceId.value === null) return;

    if (previewCells.value) {
      // Rotate preview in place, finding next valid orientation
      const nextCells = getNextValidOrientation(
        game.value.board as Board,
        selectedPieceId.value,
        previewCells.value,
        myColor.value,
        direction
      );
      if (nextCells) {
        previewCells.value = nextCells;
      }
    } else {
      // Just cycle through orientations for the tray preview
      const piece = PIECES[selectedPieceId.value];
      const orientations = getAllOrientationsForPiece(selectedPieceId.value);
      const numOrientations = orientations.length;
      if (direction === "cw") {
        currentOrientationIndex.value = (currentOrientationIndex.value + 1) % numOrientations;
      } else {
        currentOrientationIndex.value =
          (currentOrientationIndex.value - 1 + numOrientations) % numOrientations;
      }
    }
  }

  function flipPiece() {
    if (!game.value || !myColor.value || selectedPieceId.value === null) return;

    if (previewCells.value) {
      // Flip preview in place
      const flipped = flipH(previewCells.value);
      // Find valid placement near current position
      const nextCells = getNextValidOrientation(
        game.value.board as Board,
        selectedPieceId.value,
        previewCells.value,
        myColor.value,
        "cw" // direction doesn't matter for flip
      );
      if (nextCells) {
        previewCells.value = nextCells;
      }
    }
  }

  async function confirmPlacement() {
    if (!previewCells.value || selectedPieceId.value === null) return;

    const result = await placePieceMutation.mutate({
      code: code.value,
      playerId: playerId.value,
      pieceId: selectedPieceId.value,
      cells: previewCells.value,
    });

    if (result?.success) {
      clearSelection();
    }

    return result;
  }

  async function passTurn() {
    const result = await passTurnMutation.mutate({
      code: code.value,
      playerId: playerId.value,
    });
    return result;
  }

  return {
    // State
    game,
    isLoading,
    playerId,
    myColor,
    isMyTurn,
    myPieces,
    opponentPieces,
    selectedPieceId,
    previewCells,
    currentOrientationIndex,
    validAnchors,
    validAnchorsForSelectedPiece,
    canPass,
    hasAnyValidMoves,

    // Actions
    createGame,
    joinGame,
    selectPiece,
    clearSelection,
    handleBoardClick,
    rotatePiece,
    flipPiece,
    confirmPlacement,
    passTurn,
  };
}

// Helper to get all orientations for a piece
function getAllOrientationsForPiece(pieceId: number): [number, number][][] {
  const piece = PIECES[pieceId];
  const orientations: [number, number][][] = [];
  const seen = new Set<string>();

  let current = normalize(piece.cells);

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const key = [...current]
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .map(([r, c]) => `${r},${c}`)
        .join("|");
      if (!seen.has(key)) {
        seen.add(key);
        orientations.push([...current]);
      }
      current = rotateCW(current);
    }
    current = flipH(piece.cells);
  }

  return orientations;
}

export { getAllOrientationsForPiece };
