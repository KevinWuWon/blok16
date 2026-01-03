import { computed, type Ref } from "vue";
import {
  findCornerAnchors,
  hasValidMoves,
  getValidAnchorsForPiece,
  type Board,
  type PlayerColor,
} from "../../lib/validation";
import type { Doc } from "../../convex/_generated/dataModel";

type InteractionState =
  | { type: "idle" }
  | {
      type: "placing";
      pieceId: number;
      orientation: number;
      preview: { anchor: [number, number]; cells: [number, number][] } | null;
    };

type PlacePieceMutation = {
  mutate: (args: {
    code: string;
    playerId: string;
    pieceId: number;
    cells: [number, number][];
  }) => Promise<{ success: boolean } | null>;
};

type PassTurnMutation = {
  mutate: (args: {
    code: string;
    playerId: string;
  }) => Promise<{ success: boolean } | null>;
};

export function usePlacement(
  game: Ref<Doc<"games"> | null | undefined>,
  myColor: Ref<PlayerColor | null>,
  myPieces: Ref<number[]>,
  isMyTurn: Ref<boolean>,
  selectedPieceId: Ref<number | null>,
  interaction: Ref<InteractionState>,
  code: Ref<string>,
  playerId: Ref<string>,
  placePieceMutation: PlacePieceMutation,
  passTurnMutation: PassTurnMutation,
  clearSelection: () => void,
) {
  // Valid anchors computation
  const validAnchors = computed(() => {
    if (!game.value || !myColor.value || !isMyTurn.value) return [];
    return findCornerAnchors(game.value.board as Board, myColor.value);
  });

  const validAnchorsForSelectedPiece = computed(() => {
    if (
      !game.value ||
      !myColor.value ||
      selectedPieceId.value === null ||
      !isMyTurn.value
    )
      return [];
    return getValidAnchorsForPiece(
      game.value.board as Board,
      selectedPieceId.value,
      myColor.value,
    );
  });

  const canPass = computed(() => {
    if (!game.value || !myColor.value || !isMyTurn.value) return false;
    return !hasValidMoves(
      game.value.board as Board,
      myPieces.value,
      myColor.value,
    );
  });

  // Confirm placement
  async function confirmPlacement() {
    if (interaction.value.type !== "placing" || !interaction.value.preview)
      return;

    const result = await placePieceMutation.mutate({
      code: code.value,
      playerId: playerId.value,
      pieceId: interaction.value.pieceId,
      cells: interaction.value.preview.cells,
    });

    if (result?.success) {
      clearSelection();
    }
  }

  // Pass turn
  async function passTurnAction() {
    await passTurnMutation.mutate({
      code: code.value,
      playerId: playerId.value,
    });
  }

  return {
    // Computed
    validAnchors,
    validAnchorsForSelectedPiece,
    canPass,

    // Actions
    confirmPlacement,
    passTurnAction,
  };
}
