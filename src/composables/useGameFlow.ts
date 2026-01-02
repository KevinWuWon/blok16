import { ref, computed, watch, type Ref } from "vue";
import type { Doc } from "../../convex/_generated/dataModel";
import type { useGameRole, GameRole } from "./useGameRole";

// Onboarding state machine - handles role selection before gameplay begins
type OnboardingState =
  | "loading"
  | "selecting"
  | "claiming"
  | "confirming"
  | "ready";

// Derived UI state - combines server game state with client interaction state
// This is the single source of truth for what the UI should display
export type DerivedUIState =
  | "onboarding" // Onboarding not complete (role selection in progress)
  | "waiting_for_opponent" // Game created, waiting for player 2
  | "my_turn" // Active game, it's my turn, no piece selected
  | "browsing" // Active game, viewing piece tray
  | "placing" // Active game, piece selected and positioning
  | "opponent_turn" // Active game, waiting for opponent to move
  | "game_over" // Game ended, not browsing pieces
  | "game_over_browsing"; // Game ended, viewing pieces

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
  const onboardingState = ref<OnboardingState>("loading");

  // Dialog state for takeover confirmation
  const takeoverColor = ref<"blue" | "orange">("blue");
  const takeoverPlayerName = ref("");
  const pendingRoleSelection = ref<{
    role: "blue" | "orange";
    name: string;
  } | null>(null);

  // Derived UI state - combines server game state with client interaction state
  const derivedUIState = computed<DerivedUIState>(() => {
    // Onboarding takes precedence
    if (onboardingState.value !== "ready") return "onboarding";
    if (game.value?.status === "waiting") return "waiting_for_opponent";

    // Game over states
    if (game.value?.status === "finished") {
      if (interactionType.value === "browsing") return "game_over_browsing";
      return "game_over";
    }

    // Active game - client interaction state
    if (interactionType.value === "placing") return "placing";
    if (interactionType.value === "browsing") return "browsing";

    // Default based on turn
    return isMyTurn.value ? "my_turn" : "opponent_turn";
  });

  // Manage onboarding state transitions
  watch(
    [game, role, isLoading],
    () => {
      if (isLoading.value || !game.value) {
        onboardingState.value = "loading";
        return;
      }

      if (role.value !== null) {
        onboardingState.value = "ready";
        return;
      }

      // Only trigger 'selecting' if we aren't already in a transition state
      if (onboardingState.value === "loading" || onboardingState.value === "ready") {
        onboardingState.value = "selecting";
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
      onboardingState.value = "claiming";
      gameRoleComposable.value.setRole("spectator");
      onboardingState.value = "ready";
      return;
    }

    if (!name) return;

    onboardingState.value = "claiming";
    const result = await claimColorMutation.mutate({
      code: code.value,
      playerId: playerId.value,
      playerName: name,
      color: selectedRole,
    });

    if (result?.success) {
      gameRoleComposable.value.setRole(selectedRole, name);
      onboardingState.value = "ready";
    } else if (result?.requiresConfirmation) {
      // Need takeover confirmation
      pendingRoleSelection.value = { role: selectedRole, name };
      takeoverColor.value = selectedRole;
      takeoverPlayerName.value = result.currentPlayerName || "Anonymous";
      onboardingState.value = "confirming";
    } else {
      // If error, go back to selecting
      onboardingState.value = "selecting";
    }
  }

  async function handleTakeoverConfirm() {
    if (!pendingRoleSelection.value) return;

    onboardingState.value = "claiming";
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
      onboardingState.value = "ready";
    } else {
      onboardingState.value = "selecting";
    }

    pendingRoleSelection.value = null;
  }

  function handleTakeoverCancel() {
    pendingRoleSelection.value = null;
    onboardingState.value = "selecting";
  }

  return {
    // State
    onboardingState,
    takeoverColor,
    takeoverPlayerName,
    derivedUIState,

    // Actions
    handleRoleSelect,
    handleTakeoverConfirm,
    handleTakeoverCancel,
  };
}
