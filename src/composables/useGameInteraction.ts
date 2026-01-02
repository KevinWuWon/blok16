import { ref, computed, watch, onMounted, onUnmounted, type Ref } from "vue";
import {
  getNextValidOrientation,
  getFlippedOrientation,
  findValidPlacementsAtAnchor,
  getAllValidPlacements,
  type Board,
  type PlayerColor,
} from "../../lib/validation";
import { PIECES, normalize, flipH, rotateCW } from "../../lib/pieces";
import type { Doc } from "../../convex/_generated/dataModel";

// Interaction FSM state types
type PreviewData = { anchor: [number, number]; cells: [number, number][] };
type InteractionState =
  | { type: "idle" }
  | { type: "browsing"; tab: "mine" | "opponent" }
  | {
      type: "placing";
      pieceId: number;
      orientation: number;
      preview: PreviewData | null;
    };

export function useGameInteraction(
  game: Ref<Doc<"games"> | null | undefined>,
  myColor: Ref<PlayerColor | null>,
  myPieces: Ref<number[]>,
  isMyTurn: Ref<boolean>,
  isDragging?: Ref<boolean>,
) {
  const interaction = ref<InteractionState>({ type: "idle" });

  // Derived values for backward compatibility
  const selectedPieceId = computed(() =>
    interaction.value.type === "placing" ? interaction.value.pieceId : null,
  );

  const currentOrientationIndex = computed(() =>
    interaction.value.type === "placing" ? interaction.value.orientation : 0,
  );

  const previewCells = computed(() =>
    interaction.value.type === "placing"
      ? (interaction.value.preview?.cells ?? null)
      : null,
  );

  // All valid placements for the current piece (for thumbwheel)
  const allValidPlacements = computed(() => {
    if (!game.value || !myColor.value || interaction.value.type !== "placing")
      return [];
    return getAllValidPlacements(
      game.value.board as Board,
      interaction.value.pieceId,
      myColor.value,
    );
  });

  // Current placement index (for thumbwheel sync)
  const currentPlacementIndex = ref(0);

  // FSM transition functions
  function openTray(tab: "mine" | "opponent" = "mine") {
    interaction.value = { type: "browsing", tab };
  }

  function closeTray() {
    interaction.value = { type: "idle" };
  }

  function switchTab(tab: "mine" | "opponent") {
    if (interaction.value.type === "browsing") {
      interaction.value = { ...interaction.value, tab };
    }
  }

  function selectPiece(pieceId: number) {
    if (!myPieces.value.includes(pieceId)) return;
    if (!isMyTurn.value) return;
    interaction.value = {
      type: "placing",
      pieceId,
      orientation: 0,
      preview: null,
    };
  }

  function changePiece() {
    // Go back to browsing (tray opens, piece highlighted)
    interaction.value = { type: "browsing", tab: "mine" };
  }

  function clearSelection() {
    interaction.value = { type: "idle" };
  }

  // Rotation and flip logic
  function rotatePiece(direction: "cw" | "ccw") {
    if (!game.value || !myColor.value) return;
    if (interaction.value.type !== "placing") return;

    const { pieceId, orientation, preview } = interaction.value;

    if (preview) {
      const result = getNextValidOrientation(
        game.value.board as Board,
        pieceId,
        preview.cells,
        myColor.value,
        direction,
      );
      if (result) {
        interaction.value = {
          ...interaction.value,
          orientation: result.orientationIndex,
          preview: { anchor: preview.anchor, cells: result.cells },
        };
      }
    } else {
      const orientations = getAllOrientationsForPiece(pieceId);
      const numOrientations = orientations.length;
      const delta = direction === "cw" ? 1 : -1;
      const newOrientation =
        (orientation + delta + numOrientations) % numOrientations;
      interaction.value = {
        ...interaction.value,
        orientation: newOrientation,
      };
    }
  }

  function flipPieceAction() {
    if (!game.value || !myColor.value) return;
    if (interaction.value.type !== "placing") return;

    const { pieceId, preview } = interaction.value;

    if (preview) {
      const result = getFlippedOrientation(
        game.value.board as Board,
        pieceId,
        preview.cells,
        myColor.value,
      );
      if (result) {
        interaction.value = {
          ...interaction.value,
          orientation: result.orientationIndex,
          preview: { anchor: preview.anchor, cells: result.cells },
        };
      }
    }
  }

  // Update preview (called from drag and drop or board click)
  function updatePreview(cells: [number, number][] | null) {
    if (interaction.value.type === "placing" && cells) {
      const anchor: [number, number] = cells[0];
      interaction.value = {
        ...interaction.value,
        preview: { anchor, cells },
      };
    } else if (interaction.value.type === "placing" && !cells) {
      interaction.value = {
        ...interaction.value,
        preview: null,
      };
    }
  }

  // Set placement by index (called from thumbwheel)
  function setPlacementByIndex(index: number) {
    if (interaction.value.type !== "placing") return;
    const placements = allValidPlacements.value;
    if (index < 0 || index >= placements.length) return;

    const placement = placements[index];
    interaction.value = {
      ...interaction.value,
      orientation: placement.orientationIndex,
      preview: {
        anchor: placement.anchor,
        cells: placement.cells,
      },
    };
    currentPlacementIndex.value = index;
  }

  // Helper to create cell key for deduplication
  function cellsToKey(cells: [number, number][]): string {
    return [...cells]
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([r, c]) => `${r},${c}`)
      .join("|");
  }

  // Sync placement index when preview changes
  function syncPlacementIndex(cells: [number, number][]) {
    const key = cellsToKey(cells);
    const idx = allValidPlacements.value.findIndex(
      (p) => cellsToKey(p.cells) === key,
    );
    if (idx >= 0) {
      currentPlacementIndex.value = idx;
    }
  }

  // Keyboard shortcuts
  onMounted(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        rotatePiece("cw");
      } else if (e.key === "f" || e.key === "F") {
        flipPieceAction();
      } else if (e.key === "Escape") {
        if (interaction.value.type === "placing") {
          if (interaction.value.preview) {
            // Clear preview but stay in placing state
            interaction.value = { ...interaction.value, preview: null };
          } else {
            clearSelection();
          }
        } else if (interaction.value.type === "browsing") {
          closeTray();
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    onUnmounted(() => {
      window.removeEventListener("keydown", handleKeydown);
    });
  });

  // Handle board click
  function handleBoardClick(row: number, col: number) {
    if (!game.value || !myColor.value || !isMyTurn.value) return;
    if (interaction.value.type !== "placing") return;
    if (isDragging?.value) return; // Don't recompute when starting a drag

    const currentInteraction = interaction.value;
    const placements = findValidPlacementsAtAnchor(
      game.value.board as Board,
      currentInteraction.pieceId,
      row,
      col,
      myColor.value,
    );

    if (placements.length > 0) {
      // Try to keep the current orientation if valid at this anchor
      const matchingOrientation = placements.find(
        (p) => p.orientationIndex === currentInteraction.orientation,
      );
      const placement = matchingOrientation || placements[0];
      const anchor: [number, number] = [row, col];
      interaction.value = {
        ...currentInteraction,
        orientation: placement.orientationIndex,
        preview: { anchor, cells: placement.cells },
      };
      // Sync thumbwheel index
      syncPlacementIndex(placement.cells);
    }
  }

  // Watch for turn changes - reset placing state when turn ends
  watch(isMyTurn, (myTurn, wasMyTurn) => {
    if (wasMyTurn && !myTurn && interaction.value.type === "placing") {
      interaction.value = { type: "idle" };
    }
  });

  return {
    // State
    interaction,
    selectedPieceId,
    currentOrientationIndex,
    previewCells,
    allValidPlacements,
    currentPlacementIndex,

    // Actions
    openTray,
    closeTray,
    switchTab,
    selectPiece,
    changePiece,
    clearSelection,
    rotatePiece,
    flipPieceAction,
    updatePreview,
    handleBoardClick,
    setPlacementByIndex,
  };
}

// Helper function to get all orientations for a piece
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
