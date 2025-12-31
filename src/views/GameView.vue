<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useConvexQuery, useConvexMutation } from "convex-vue";
import { api } from "../../convex/_generated/api";
import {
  findCornerAnchors,
  findValidPlacementsAtAnchor,
  getNextValidOrientation,
  getFlippedOrientation,
  hasValidMoves,
  getValidAnchorsForPiece,
  type PlayerColor,
  type Board,
} from "../../lib/validation";
import { PIECES, normalize, flipH } from "../../lib/pieces";
import BoardComponent from "@/components/Board.vue";
import PieceTray from "@/components/PieceTray.vue";
import PieceMiniPreview from "@/components/PieceMiniPreview.vue";
import RoleSelectionDialog from "@/components/RoleSelectionDialog.vue";
import TakeoverConfirmDialog from "@/components/TakeoverConfirmDialog.vue";
import { useGameRole } from "@/composables/useGameRole";
import { usePieceDrag } from "@/composables/usePieceDrag";
import {
  useNotifications,
  getSubscriptionData,
} from "@/composables/useNotifications";

type Player = string | { id: string; name: string };

const route = useRoute();
const code = computed(() => route.params.code as string);

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

// Game role from cookies
const gameRole = computed(() => useGameRole(code.value));
const role = computed(() => gameRole.value.role.value);

// Convex query for game state
const { data: game, isPending: isLoading } = useConvexQuery(
  api.games.getGame,
  () => ({
    code: code.value,
  }),
);

// Mutations
const claimColorMutation = useConvexMutation(api.games.claimColor);
const placePieceMutation = useConvexMutation(api.games.placePiece);
const passTurnMutation = useConvexMutation(api.games.passTurn);
const pushSubscribeMutation = useConvexMutation(api.push.subscribe);
const pushUpdateGameCodeMutation = useConvexMutation(api.push.updateGameCode);

// Interaction FSM state
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

const interaction = ref<InteractionState>({ type: "idle" });

// Derived values for backward compatibility with template and composables
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

// Board component ref for drag and drop
const boardComponentRef = ref<InstanceType<typeof BoardComponent> | null>(null);
// Note: defineExpose unwraps refs, so boardRef is the element directly
const boardElement = computed(() => boardComponentRef.value?.boardRef ?? null);

// Game flow state machine
type GameFlowState =
  | "loading"
  | "selecting"
  | "claiming"
  | "confirming"
  | "ready";
const flowState = ref<GameFlowState>("loading");

// Dialog state
const takeoverColor = ref<"blue" | "orange">("blue");
const takeoverPlayerName = ref("");
const pendingRoleSelection = ref<{
  role: "blue" | "orange";
  name: string;
} | null>(null);

// Helper to get player name from legacy or new format
function getPlayerName(player?: Player): string | null {
  if (!player) return null;
  if (typeof player === "string") return "Anonymous";
  return player.name;
}

// Computed values
const myColor = computed<PlayerColor | null>(() => {
  if (role.value === "blue") return "blue";
  if (role.value === "orange") return "orange";
  return null;
});

const isSpectator = computed(() => role.value === "spectator");

const isMyTurn = computed(() => {
  if (isSpectator.value) return false;
  return (
    game.value?.currentTurn === myColor.value &&
    game.value?.status === "playing"
  );
});

// Mobile UI state - derived from server state + FSM
type MobileUIState =
  | "loading"
  | "waiting"
  | "idle"
  | "browsing"
  | "placing"
  | "watching"
  | "finished";

const mobileUIState = computed<MobileUIState>(() => {
  // Server state takes precedence
  if (flowState.value !== "ready") return "loading";
  if (game.value?.status === "waiting") return "waiting";
  if (game.value?.status === "finished") return "finished";

  // Client FSM state
  if (interaction.value.type === "placing") return "placing";
  if (interaction.value.type === "browsing") return "browsing";

  // Default based on turn
  return isMyTurn.value ? "idle" : "watching";
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

// Drag and drop composable
const gameBoard = computed(() => (game.value?.board as Board) ?? []);
const { isDragging, startDrag } = usePieceDrag(
  boardElement,
  gameBoard,
  selectedPieceId,
  currentOrientationIndex,
  validAnchorsForSelectedPiece,
  myColor,
  previewCells,
  (cells) => {
    // Update FSM state with new preview
    if (interaction.value.type === "placing" && cells) {
      // Find anchor from cells (first cell is typically the anchor)
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
  },
);

const canPass = computed(() => {
  if (!game.value || !myColor.value || !isMyTurn.value) return false;
  return !hasValidMoves(
    game.value.board as Board,
    myPieces.value,
    myColor.value,
  );
});

// Push Notifications
const {
  permission: notificationPermission,
  isSupported: notificationsSupported,
  isPushSupported,
  subscribeToPush,
  getExistingSubscription,
  storePlayerInfoForServiceWorker,
  updatePermissionState,
} = useNotifications();

// Get Convex URL for service worker subscription refresh
const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

const showNotificationButton = computed(() => {
  return notificationsSupported && notificationPermission.value !== "granted";
});

async function enableNotifications() {
  if (isPushSupported) {
    // Use Push API for background notifications
    const subscription = await subscribeToPush();
    if (subscription && playerId.value) {
      const subData = getSubscriptionData(subscription);
      if (subData) {
        await pushSubscribeMutation.mutate({
          playerId: playerId.value,
          endpoint: subData.endpoint,
          keys: subData.keys,
          gameCode: code.value,
        });
        // Store player info in service worker for subscription refresh handling
        storePlayerInfoForServiceWorker(playerId.value, convexUrl);
      }
    }
  }
  updatePermissionState();
}

// Register existing push subscription on mount
onMounted(async () => {
  if (isPushSupported && playerId.value) {
    const existingSub = await getExistingSubscription();
    if (existingSub) {
      const subData = getSubscriptionData(existingSub);
      if (subData) {
        // Update the game code for existing subscription
        await pushUpdateGameCodeMutation.mutate({
          playerId: playerId.value,
          gameCode: code.value,
        });
        // Ensure service worker has player info for subscription refresh
        storePlayerInfoForServiceWorker(playerId.value, convexUrl);
      }
    }
  }
});

const blueName = computed(() => getPlayerName(game.value?.players.blue));
const orangeName = computed(() => getPlayerName(game.value?.players.orange));

const opponentName = computed(() => {
  if (!myColor.value) return "Opponent";
  const name = myColor.value === "blue" ? orangeName.value : blueName.value;
  return name || "Opponent";
});

const blueDisplayName = computed(() => blueName.value || "Blue");
const orangeDisplayName = computed(() => orangeName.value || "Orange");

const turnLabel = computed(() => {
  if (!game.value) return "";
  return isMyTurn.value ? "Your turn" : "Their turn";
});

const gameUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/game/${code.value}`;
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
    gameRole.value.setRole("spectator");
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
    gameRole.value.setRole(selectedRole, name);
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
    gameRole.value.setRole(
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
  interaction.value = { type: "placing", pieceId, orientation: 0, preview: null };
}

function changePiece() {
  // Go back to browsing (tray opens, piece highlighted)
  interaction.value = { type: "browsing", tab: "mine" };
}

function clearSelection() {
  interaction.value = { type: "idle" };
}

function handleBoardClick(row: number, col: number) {
  if (!game.value || !myColor.value || !isMyTurn.value) return;
  if (interaction.value.type !== "placing") return;
  if (isDragging.value) return; // Don't recompute when starting a drag

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
  }
}

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
    const newOrientation = (orientation + delta + numOrientations) % numOrientations;
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

async function confirmPlacement() {
  if (interaction.value.type !== "placing" || !interaction.value.preview) return;

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

async function passTurnAction() {
  await passTurnMutation.mutate({
    code: code.value,
    playerId: playerId.value,
  });
}

async function copyLink() {
  await navigator.clipboard.writeText(gameUrl.value);
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

// Watch for turn changes - reset placing state when turn ends
watch(isMyTurn, (myTurn, wasMyTurn) => {
  if (wasMyTurn && !myTurn && interaction.value.type === "placing") {
    interaction.value = { type: "idle" };
  }
});

// Helper functions
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

function rotateCW(cells: [number, number][]): [number, number][] {
  const rotated = cells.map(([r, c]) => [c, -r] as [number, number]);
  return normalize(rotated);
}
</script>

<template>
  <div class="h-dvh flex flex-col overflow-hidden">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin" />
    </div>

    <!-- Game not found -->
    <div
      v-else-if="!game"
      class="flex-1 flex flex-col items-center justify-center p-4"
    >
      <h1 class="text-2xl font-bold mb-4">Game Not Found</h1>
      <p class="text-muted mb-4">The game code "{{ code }}" doesn't exist.</p>
      <UButton to="/"> Back to Home </UButton>
    </div>

    <!-- Game view -->
    <template v-else>
      <!-- Header (hidden on mobile when piece tray is open) -->
      <header
        class="items-center justify-between px-4 py-2 border-b border-default shrink-0"
        :class="interaction.type === 'browsing' ? 'hidden md:flex' : 'flex'"
      >
        <div class="flex items-center gap-2">
          <RouterLink to="/" class="text-lg font-bold"> Blokus Duo </RouterLink>
          <UBadge variant="subtle" color="neutral">
            {{ code }}
          </UBadge>
        </div>
        <!-- Game status in header -->
        <div class="flex items-center gap-2">
          <!-- Notification enable button -->
          <UButton
            v-if="showNotificationButton"
            variant="ghost"
            size="sm"
            :icon="
              notificationPermission === 'denied'
                ? 'i-lucide-bell-off'
                : 'i-lucide-bell'
            "
            :title="
              notificationPermission === 'denied'
                ? 'Notifications blocked - enable in browser settings'
                : 'Enable notifications'
            "
            :disabled="notificationPermission === 'denied'"
            @click="enableNotifications"
          />
          <template v-if="game.status === 'waiting'">
            <UButton
              variant="outline"
              size="sm"
              icon="i-lucide-copy"
              @click="copyLink"
            >
              Copy Link
            </UButton>
          </template>
          <template v-else />
        </div>
      </header>

      <!-- Waiting for opponent -->
      <div
        v-if="game.status === 'waiting'"
        class="flex-1 flex flex-col items-center justify-center p-4"
      >
        <div class="text-center space-y-4">
          <UIcon name="i-lucide-users" class="w-12 h-12 mx-auto text-muted" />
          <h2 class="text-xl font-semibold">Waiting for opponent...</h2>
          <p class="text-muted">Share this link with a friend:</p>
          <div class="flex items-center gap-2 justify-center">
            <UInput :value="gameUrl" readonly class="w-64" />
            <UButton icon="i-lucide-copy" @click="copyLink" />
          </div>
        </div>
      </div>

      <!-- Game in progress or finished -->
      <template v-else>
        <!-- Main game area -->
        <div
          class="flex-1 flex flex-col md:flex-row md:overflow-hidden min-h-0"
        >
          <!-- Desktop: Left sidebar - Your pieces (visible at md+) -->
          <aside
            class="hidden md:flex md:flex-col flex-1 min-w-48 border-r border-default"
          >
            <h3
              class="text-sm font-semibold py-2 px-3 border-b border-default shrink-0"
            >
              Your Pieces
            </h3>
            <div class="flex-1 overflow-y-auto p-2">
              <PieceTray
                :pieces="myPieces"
                :player-color="myColor || 'blue'"
                :selected-piece-id="selectedPieceId"
                :disabled="!isMyTurn"
                horizontal
                @select="selectPiece"
              />
            </div>
          </aside>

          <!-- Board area -->
          <main
            class="flex flex-col items-center p-4 overflow-hidden"
            :class="interaction.type === 'browsing' ? 'justify-start pt-2' : 'justify-center'"
          >
            <!-- Game status / Turn indicator (hidden on mobile when piece tray is open) -->
            <div class="mb-8" :class="{ 'hidden md:block': interaction.type === 'browsing' }">
              <template v-if="game.status === 'finished'">
                <div class="text-2xl font-bold text-center">
                  <span v-if="game.winner === 'draw'" class="text-muted"
                    >Draw!</span
                  >
                  <span
                    v-else
                    :class="
                      game.winner === 'blue'
                        ? 'text-blue-500'
                        : 'text-orange-500'
                    "
                  >
                    {{ game.winner === myColor ? "You win!" : "You lose!" }}
                  </span>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-6">
                  <!-- Blue Player -->
                  <div
                    class="relative px-4 py-2 border-2 rounded-xl min-w-[140px] text-center transition-all duration-300"
                    :class="
                      game.currentTurn === 'blue'
                        ? 'border-blue-500'
                        : 'border-transparent opacity-50'
                    "
                  >
                    <span
                      v-if="game.currentTurn === 'blue'"
                      class="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-neutral-900 text-[10px] uppercase font-black tracking-wider text-blue-500 whitespace-nowrap"
                    >
                      {{ turnLabel }}
                    </span>
                    <span
                      class="font-bold text-lg"
                      :class="
                        game.currentTurn === 'blue'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-blue-500'
                      "
                      >{{ blueDisplayName }}</span
                    >
                  </div>

                  <!-- Orange Player -->
                  <div
                    class="relative px-4 py-2 border-2 rounded-xl min-w-[140px] text-center transition-all duration-300"
                    :class="
                      game.currentTurn === 'orange'
                        ? 'border-orange-500'
                        : 'border-transparent opacity-50'
                    "
                  >
                    <span
                      v-if="game.currentTurn === 'orange'"
                      class="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-neutral-900 text-[10px] uppercase font-black tracking-wider text-orange-500 whitespace-nowrap"
                    >
                      {{ turnLabel }}
                    </span>
                    <span
                      class="font-bold text-lg"
                      :class="
                        game.currentTurn === 'orange'
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-orange-500'
                      "
                      >{{ orangeDisplayName }}</span
                    >
                  </div>
                </div>
              </template>
            </div>

            <BoardComponent
              ref="boardComponentRef"
              :board="game.board as Board"
              :preview-cells="previewCells"
              :preview-color="myColor || 'blue'"
              :valid-anchors="
                selectedPieceId !== null
                  ? validAnchorsForSelectedPiece
                  : validAnchors
              "
              :show-anchors="isMyTurn && selectedPieceId !== null"
              :is-dragging="isDragging"
              :compact="interaction.type === 'browsing'"
              :last-placement-cells="game.lastPlacement as [number, number][] | undefined"
              @cell-click="handleBoardClick"
              @drag-start="startDrag"
            />

            <!-- Mobile: Inline piece tray (browsing state) -->
            <div
              v-if="interaction.type === 'browsing'"
              class="md:hidden w-full flex-1 flex flex-col border-t border-default mt-2 min-h-0"
            >
              <!-- Tabs -->
              <div class="flex border-b border-default shrink-0">
                <button
                  :class="[
                    'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
                    interaction.tab === 'mine'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-default-500 hover:text-default-700',
                  ]"
                  @click="switchTab('mine')"
                >
                  Mine
                </button>
                <button
                  :class="[
                    'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
                    interaction.tab === 'opponent'
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-default-500 hover:text-default-700',
                  ]"
                  @click="switchTab('opponent')"
                >
                  {{ opponentName }}
                </button>
              </div>
              <!-- Tab content -->
              <div class="flex-1 overflow-y-auto">
                <PieceTray
                  v-if="interaction.tab === 'mine'"
                  :pieces="myPieces"
                  :player-color="myColor || 'blue'"
                  :selected-piece-id="selectedPieceId"
                  :disabled="!isMyTurn"
                  horizontal
                  @select="selectPiece"
                />
                <PieceTray
                  v-else
                  :pieces="opponentPieces"
                  :player-color="myColor === 'blue' ? 'orange' : 'blue'"
                  :selected-piece-id="null"
                  :disabled="true"
                  horizontal
                  @select="() => {}"
                />
              </div>
            </div>

            <!-- Mobile: Placement controls (placing state) -->
            <div
              v-if="mobileUIState === 'placing'"
              class="md:hidden w-full border-t border-default mt-2 p-4"
            >
              <div class="flex flex-col gap-3 max-w-sm mx-auto">
                <!-- Preview + manipulation row -->
                <div class="flex items-center justify-center gap-3">
                  <PieceMiniPreview
                    :piece-id="selectedPieceId!"
                    :player-color="myColor || 'blue'"
                    :orientation-index="currentOrientationIndex"
                    class="w-12 h-12"
                  />
                  <UButton
                    icon="i-lucide-arrow-down-up"
                    size="xl"
                    variant="outline"
                    title="Change Piece"
                    @click="changePiece"
                  />
                  <UButton
                    icon="i-lucide-check"
                    size="xl"
                    title="Confirm"
                    @click="confirmPlacement"
                  />
                </div>
                <div class="flex items-center justify-center gap-3">
                  <UButton
                    icon="i-lucide-rotate-ccw"
                    size="xl"
                    variant="outline"
                    title="Rotate counter-clockwise"
                    @click="rotatePiece('ccw')"
                  />
                  <UButton
                    icon="i-lucide-rotate-cw"
                    size="xl"
                    variant="outline"
                    title="Rotate clockwise (R)"
                    @click="rotatePiece('cw')"
                  />
                  <UButton
                    icon="i-lucide-flip-horizontal"
                    size="xl"
                    variant="outline"
                    title="Flip (F)"
                    @click="flipPieceAction"
                  />
                </div>
              </div>
            </div>
          </main>

          <!-- Desktop: Right sidebar - Opponent pieces (visible at lg+ only) -->
          <aside
            class="hidden lg:flex lg:flex-col flex-1 min-w-48 border-l border-default"
          >
            <h3
              class="text-sm font-semibold py-2 px-3 border-b border-default shrink-0"
            >
              {{ opponentName }}'s Pieces
            </h3>
            <div class="flex-1 overflow-y-auto p-2">
              <PieceTray
                :pieces="opponentPieces"
                :player-color="myColor === 'blue' ? 'orange' : 'blue'"
                :selected-piece-id="null"
                :disabled="true"
                horizontal
                @select="() => {}"
              />
            </div>
          </aside>
        </div>

        <!-- Controls bar (bottom) -->
        <footer class="border-t border-default p-4 lg:py-2 shrink-0">
          <div class="flex items-center justify-center gap-2 flex-wrap">
            <!-- Mobile: Select piece button (idle state) -->
            <UButton
              v-if="mobileUIState === 'idle'"
              size="xl"
              class="md:hidden"
              @click="openTray('mine')"
            >
              Select Piece
            </UButton>

            <!-- Mobile: Hide tray button (browsing state) -->
            <UButton
              v-if="mobileUIState === 'browsing'"
              size="xl"
              class="md:hidden"
              variant="outline"
              @click="closeTray"
            >
              Hide
            </UButton>

            <!-- Mobile: View Pieces button (watching/finished state) -->
            <UButton
              v-if="(mobileUIState === 'watching' || mobileUIState === 'finished') && interaction.type === 'idle'"
              class="md:hidden"
              variant="outline"
              size="xl"
              @click="openTray('mine')"
            >
              View Pieces
            </UButton>

            <!-- Desktop: Selected piece controls (hidden on mobile when placing) -->
            <template v-if="selectedPieceId !== null">
              <div
                class="flex items-center gap-1"
                :class="{ 'hidden md:flex': mobileUIState === 'placing' }"
              >
                <PieceMiniPreview
                  :piece-id="selectedPieceId"
                  :player-color="myColor || 'blue'"
                  :orientation-index="currentOrientationIndex"
                  class="w-10 h-10"
                />
              </div>
              <div
                class="flex items-center gap-1"
                :class="{ 'hidden md:flex': mobileUIState === 'placing' }"
              >
                <UButton
                  icon="i-lucide-rotate-ccw"
                  variant="outline"
                  size="sm"
                  title="Rotate (R)"
                  @click="rotatePiece('ccw')"
                />
                <UButton
                  icon="i-lucide-rotate-cw"
                  variant="outline"
                  size="sm"
                  title="Rotate (R)"
                  @click="rotatePiece('cw')"
                />
                <UButton
                  icon="i-lucide-flip-horizontal"
                  variant="outline"
                  size="sm"
                  title="Flip (F)"
                  @click="flipPieceAction"
                />
              </div>

              <!-- Confirm/Cancel when preview is active (desktop only) -->
              <template v-if="previewCells">
                <UButton
                  color="primary"
                  :class="{ 'hidden md:inline-flex': mobileUIState === 'placing' }"
                  @click="confirmPlacement"
                >
                  Confirm
                </UButton>
                <UButton
                  variant="outline"
                  :class="{ 'hidden md:inline-flex': mobileUIState === 'placing' }"
                  @click="interaction.type === 'placing' && (interaction = { ...interaction, preview: null })"
                >
                  Cancel
                </UButton>
              </template>

              <!-- Change piece button (tablet only, hidden on mobile and lg+) -->
              <UButton
                v-if="!previewCells && interaction.type === 'placing'"
                variant="ghost"
                size="sm"
                class="hidden md:inline-flex lg:hidden"
                @click="changePiece"
              >
                Change
              </UButton>
              <UButton
                v-if="!previewCells"
                variant="ghost"
                size="sm"
                :class="{ 'hidden md:inline-flex': mobileUIState === 'placing' }"
                @click="clearSelection"
              >
                Deselect
              </UButton>
            </template>

            <!-- Pass button -->
            <UButton
              v-if="canPass && !previewCells"
              variant="outline"
              color="warning"
              @click="passTurnAction"
            >
              Pass Turn
            </UButton>
          </div>
        </footer>
      </template>

      <!-- Role selection dialog -->
      <RoleSelectionDialog
        :open="flowState === 'selecting'"
        :blue-player="game?.players.blue"
        :orange-player="game?.players.orange"
        @update:open="(val) => !val && (flowState = 'ready')"
        @select="handleRoleSelect"
      />

      <!-- Takeover confirmation dialog -->
      <TakeoverConfirmDialog
        :open="flowState === 'confirming'"
        :current-player-name="takeoverPlayerName"
        :color="takeoverColor"
        @confirm="handleTakeoverConfirm"
        @cancel="handleTakeoverCancel"
      />
    </template>
  </div>
</template>
