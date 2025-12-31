import { ref, computed, watch, type Ref } from "vue";
import type { Doc } from "../../convex/_generated/dataModel";
import type { useGameRole, GameRole } from "./useGameRole";

// Game flow state machine
type GameFlowState =
  | "loading"
  | "selecting"
  | "claiming"
  | "confirming"
  | "ready";

// Mobile UI state - derived from server state + FSM
type MobileUIState =
  | "loading"
  | "waiting"
  | "idle"
  | "browsing"
  | "placing"
  | "watching"
  | "finished";

type InteractionType = "idle" | "browsing" | "placing";

type ClaimColorMutation = {
  mutate: (args: {
    code: string;
    playerId: string;
    playerName: string;
    color: "blue" | "orange";
    forceTakeover?: boolean;
  }) => Promise<{
    success: boolean;
    requiresConfirmation?: boolean;
    currentPlayerName?: string;
  } | null>;
};

export function useGameFlow(
  game: Ref<Doc<"games"> | null | undefined>,
  role: Ref<GameRole | null>,
  isLoading: Ref<boolean>,
  isMyTurn: Ref<boolean>,
  interactionType: Ref<InteractionType>,
  gameRoleComposable: Ref<ReturnType<typeof useGameRole>>,
  claimColorMutation: ClaimColorMutation,
  code: Ref<string>,
  playerId: Ref<string>,
) {
  const flowState = ref<GameFlowState>("loading");

  // Dialog state
  const takeoverColor = ref<"blue" | "orange">("blue");
  const takeoverPlayerName = ref("");
  const pendingRoleSelection = ref<{
    role: "blue" | "orange";
    name: string;
  } | null>(null);

  // Mobile UI state - derived from server state + FSM
  const mobileUIState = computed<MobileUIState>(() => {
    // Server state takes precedence
    if (flowState.value !== "ready") return "loading";
    if (game.value?.status === "waiting") return "waiting";
    if (game.value?.status === "finished") return "finished";

    // Client FSM state
    if (interactionType.value === "placing") return "placing";
    if (interactionType.value === "browsing") return "browsing";

    // Default based on turn
    return isMyTurn.value ? "idle" : "watching";
  });

  // Manage flow state transitions
  watch(
    [game, role, isLoading],
    () => {
      if (isLoading.value || !game.value) {
        flowState.value = "loading";
        return;
      }

      if (role.value !== null) {
        flowState.value = "ready";
        return;
      }

      // Only trigger 'selecting' if we aren't already in a transition state
      if (flowState.value === "loading" || flowState.value === "ready") {
        flowState.value = "selecting";
      }
    },
    { immediate: true },
  );

  // Handle role selection
  async function handleRoleSelect(
    selectedRole: "blue" | "orange" | "spectator",
    name?: string,
  ) {
    if (selectedRole === "spectator") {
      flowState.value = "claiming";
      gameRoleComposable.value.setRole("spectator");
      flowState.value = "ready";
      return;
    }

    if (!name) return;

    flowState.value = "claiming";
    const result = await claimColorMutation.mutate({
      code: code.value,
      playerId: playerId.value,
      playerName: name,
      color: selectedRole,
    });

    if (result?.success) {
      gameRoleComposable.value.setRole(selectedRole, name);
      flowState.value = "ready";
    } else if (result?.requiresConfirmation) {
      // Need takeover confirmation
      pendingRoleSelection.value = { role: selectedRole, name };
      takeoverColor.value = selectedRole;
      takeoverPlayerName.value = result.currentPlayerName || "Anonymous";
      flowState.value = "confirming";
    } else {
      // If error, go back to selecting
      flowState.value = "selecting";
    }
  }

  async function handleTakeoverConfirm() {
    if (!pendingRoleSelection.value) return;

    flowState.value = "claiming";
    const result = await claimColorMutation.mutate({
      code: code.value,
      playerId: playerId.value,
      playerName: pendingRoleSelection.value.name,
      color: pendingRoleSelection.value.role,
      forceTakeover: true,
    });

    if (result?.success) {
      gameRoleComposable.value.setRole(
        pendingRoleSelection.value.role,
        pendingRoleSelection.value.name,
      );
      flowState.value = "ready";
    } else {
      flowState.value = "selecting";
    }

    pendingRoleSelection.value = null;
  }

  function handleTakeoverCancel() {
    pendingRoleSelection.value = null;
    flowState.value = "selecting";
  }

  return {
    // State
    flowState,
    takeoverColor,
    takeoverPlayerName,
    mobileUIState,

    // Actions
    handleRoleSelect,
    handleTakeoverConfirm,
    handleTakeoverCancel,
  };
}
