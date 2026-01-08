<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useConvexMutation, useConvexQuery } from "convex-vue";
import { api } from "../../convex/_generated/api";
import { type Board } from "../../lib/validation";
import { PIECES } from "../../convex/shared/pieces";
import BoardComponent from "@/components/Board.vue";
import RoleSelectionDialog from "@/components/RoleSelectionDialog.vue";
import TakeoverConfirmDialog from "@/components/TakeoverConfirmDialog.vue";
import NotificationStatusDialog from "@/components/NotificationStatusDialog.vue";
import HelpDialog from "@/components/HelpDialog.vue";
import RematchPanel from "@/components/RematchPanel.vue";
import GameHeader from "@/components/GameHeader.vue";
import WaitingScreen from "@/components/WaitingScreen.vue";
import PlayerTurnIndicator from "@/components/PlayerTurnIndicator.vue";
import GameResult from "@/components/GameResult.vue";
import PieceSidebar from "@/components/PieceSidebar.vue";
import MobileGameFooter from "@/components/MobileGameFooter.vue";
import GameControlsFooter from "@/components/GameControlsFooter.vue";
import { useGameRole } from "@/composables/useGameRole";
import { useGameState } from "@/composables/useGameState";
import { useGameInteraction } from "@/composables/useGameInteraction";
import { useGameFlow } from "@/composables/useGameFlow";
import { usePlacement } from "@/composables/usePlacement";
import { usePieceDrag } from "@/composables/usePieceDrag";
import {
  useNotifications,
  getSubscriptionData,
} from "@/composables/useNotifications";
import { getStoredValue, setStoredValue } from "@/composables/useStorage";

const route = useRoute();
const code = computed(() => route.params.code as string);

// Player ID from IndexedDB
const playerId = ref<string>("");

onMounted(async () => {
  let id = await getStoredValue("player-id");
  if (!id) {
    id = crypto.randomUUID();
    await setStoredValue("player-id", id);
  }
  playerId.value = id;
});

// Game role from IndexedDB
const gameRole = computed(() => useGameRole(code.value));
const role = computed(() => gameRole.value.role.value);
const storedPlayerName = computed(() => gameRole.value.playerName.value);

// Mutations
const claimColorMutation = useConvexMutation(api.games.claimColor);
const placePieceMutation = useConvexMutation(api.games.placePiece);
const passTurnMutation = useConvexMutation(api.games.passTurn);
const nudgePlayerMutation = useConvexMutation(api.games.nudgePlayer);
const pushSubscribeMutation = useConvexMutation(api.push.subscribe);
const pushUpdateGameCodeMutation = useConvexMutation(api.push.updateGameCode);

// Use composables
const {
  game,
  isLoading,
  myColor,
  isSpectator,
  wasTakenOver,
  isMyTurn,
  myPieces,
  opponentPieces,
  bluePieces,
  orangePieces,
  opponentName,
  blueDisplayName,
  orangeDisplayName,
  turnLabel,
  gameUrl,
  gameBoard,
} = useGameState(code, role, playerId);

// Interaction composable (without isDragging initially)
const {
  interaction,
  selectedPieceId,
  currentOrientationIndex,
  previewCells,
  allValidPlacements,
  currentPlacementIndex,
  activeTab,
  switchTab,
  selectPiece,
  clearSelection,
  rotatePiece,
  flipPieceAction,
  updatePreview,
  handleBoardClick,
  setPlacementByIndex,
} = useGameInteraction(game, myColor, myPieces, isMyTurn);

const interactionType = computed(() => interaction.value.type);

// Flow composable
const {
  onboardingState,
  takeoverColor,
  takeoverPlayerName,
  derivedUIState,
  handleRoleSelect,
  handleTakeoverConfirm,
  handleTakeoverCancel,
  openRoleSelection,
} = useGameFlow(
  game,
  role,
  isLoading,
  isMyTurn,
  wasTakenOver,
  interactionType,
  gameRole,
  claimColorMutation,
  code,
  playerId,
);

// Placement composable
const {
  validAnchors,
  validAnchorsForSelectedPiece,
  canPass,
  confirmPlacement,
  passTurnAction,
} = usePlacement(
  game,
  myColor,
  myPieces,
  isMyTurn,
  selectedPieceId,
  interaction,
  code,
  playerId,
  placePieceMutation,
  passTurnMutation,
  clearSelection,
);

// Board component ref for drag and drop
const boardComponentRef = ref<InstanceType<typeof BoardComponent> | null>(null);
const boardElement = computed(() => boardComponentRef.value?.boardRef ?? null);

// Drag and drop composable
const { isDragging, startDrag } = usePieceDrag(
  boardElement,
  gameBoard,
  selectedPieceId,
  currentOrientationIndex,
  validAnchorsForSelectedPiece,
  myColor,
  previewCells,
  updatePreview,
);

// Push Notifications
const {
  permission: notificationPermission,
  isSupported: notificationsSupported,
  isPushSupported,
  getExistingSubscription,
  storePlayerInfoForServiceWorker,
  updatePermissionState,
} = useNotifications();

// Get Convex URL for service worker subscription refresh
const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

// Dialog states
const notificationDialogOpen = ref(false);
const helpDialogOpen = ref(false);

const currentEndpoint = ref<string | null>(null);
const isPlayerReady = computed(() => playerId.value.trim().length > 0);

// Query backend for endpoint registration - uses sentinel when no endpoint
const { data: isDeviceRegistered } = useConvexQuery(
  api.push.hasSubscriptionForEndpoint,
  () => ({
    endpoint: currentEndpoint.value || "__none__",
    playerId: isPlayerReady.value ? playerId.value : undefined,
  })
);

const isRegisteredOnServer = computed(() => {
  if (!currentEndpoint.value) return false;
  return isDeviceRegistered.value === true;
});

type NotificationStatus =
  | "unsupported"
  | "denied"
  | "not-setup"
  | "not-registered"
  | "working";

const notificationStatus = computed<NotificationStatus>(() => {
  if (!notificationsSupported || !isPushSupported) return "unsupported";
  if (notificationPermission.value === "denied") return "denied";
  if (notificationPermission.value !== "granted") return "not-setup";
  if (!isRegisteredOnServer.value) return "not-registered";
  return "working";
});

const bellIcon = computed(() =>
  notificationStatus.value === "working"
    ? "i-lucide-bell-ring"
    : "i-lucide-bell-off"
);

async function handleNotificationSubscribe(subscription: PushSubscription) {
  if (playerId.value) {
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
      lastSubscriptionSyncKey.value = `${playerId.value}:${code.value}`;
      void refreshNotificationStatus();
    }
  }
}

const lastSubscriptionSyncKey = ref<string>("");

let notificationRefreshToken = 0;

async function refreshNotificationStatus() {
  const token = ++notificationRefreshToken;
  updatePermissionState();

  if (!isPushSupported) {
    if (token === notificationRefreshToken) {
      currentEndpoint.value = null;
    }
    return;
  }

  const existingSub = await getExistingSubscription();
  if (token !== notificationRefreshToken) return;

  currentEndpoint.value = existingSub?.endpoint ?? null;

  if (!existingSub || !playerId.value) return;

  const syncKey = `${playerId.value}:${code.value}`;
  if (lastSubscriptionSyncKey.value === syncKey) return;

  await pushUpdateGameCodeMutation.mutate({
    playerId: playerId.value,
    gameCode: code.value,
  });

  // Ensure service worker has player info for subscription refresh
  storePlayerInfoForServiceWorker(playerId.value, convexUrl);
  lastSubscriptionSyncKey.value = syncKey;
}

watch([playerId, code], () => {
  void refreshNotificationStatus();
}, { immediate: true });

watch(notificationDialogOpen, (isOpen) => {
  if (isOpen) {
    void refreshNotificationStatus();
  }
});

// Calculate remaining cells for each player
function countRemainingCells(pieceIds: number[]): number {
  return pieceIds.reduce((sum, id) => sum + (PIECES[id]?.size ?? 0), 0);
}
const myRemainingCells = computed(() => countRemainingCells(myPieces.value));
const opponentRemainingCells = computed(() => countRemainingCells(opponentPieces.value));
const blueRemainingCells = computed(() => countRemainingCells(bluePieces.value));
const orangeRemainingCells = computed(() => countRemainingCells(orangePieces.value));
const isGameOver = computed(() => game.value?.status === "finished");

// Nudge functionality
const isNudging = ref(false);
const canNudge = computed(() => {
  return !isSpectator.value && !!myColor.value && !isMyTurn.value && game.value?.status === "playing";
});

async function handleNudge() {
  if (!playerId.value || isNudging.value) return;

  isNudging.value = true;
  try {
    await nudgePlayerMutation.mutate({
      code: code.value,
      playerId: playerId.value,
    });
  } catch (error) {
    console.error("Failed to nudge player:", error);
  } finally {
    isNudging.value = false;
  }
}
</script>

<template>
  <div class="h-dvh flex flex-col overflow-hidden">
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin"
      />
    </div>

    <!-- Game not found -->
    <div
      v-else-if="!game"
      class="flex-1 flex flex-col items-center justify-center p-4"
    >
      <h1 class="text-2xl font-bold mb-4">
        Game Not Found
      </h1>
      <p class="text-muted mb-4">
        The game code "{{ code }}" doesn't exist.
      </p>
      <UButton
        size="xl"
        to="/"
      >
        Back to Home
      </UButton>
    </div>

    <!-- Game view -->
    <template v-else>
      <GameHeader
        :code="code"
        :notifications-supported="notificationsSupported"
        :bell-icon="bellIcon"
        :derived-u-i-state="derivedUIState"
        :is-spectator="isSpectator"
        @help-click="helpDialogOpen = true"
        @notification-click="notificationDialogOpen = true"
        @role-click="openRoleSelection"
      />

      <WaitingScreen
        v-if="game.status === 'waiting'"
        :game-url="gameUrl"
      />

      <!-- Game in progress or finished -->
      <template v-else>
        <!-- Main game area -->
        <div
          class="flex-1 flex flex-col md:flex-row md:overflow-hidden min-h-0"
        >
          <!-- Desktop: Left sidebar - Your pieces or Blue pieces for spectators (visible at md+) -->
          <PieceSidebar
            :title="isSpectator ? blueDisplayName : 'Your Pieces'"
            :pieces="isSpectator ? bluePieces : myPieces"
            :player-color="isSpectator ? 'blue' : (myColor || 'blue')"
            :selected-piece-id="isSpectator ? null : selectedPieceId"
            :disabled="isSpectator || !isMyTurn"
            :board="(game.board as Board)"
            :remaining-cells="isSpectator ? blueRemainingCells : myRemainingCells"
            :show-cell-count="isGameOver"
            side="left"
            @select="selectPiece"
          />

          <!-- Board area -->
          <main
            class="flex flex-col items-center py-2 px-4 overflow-hidden justify-center shrink-0 items-stretch"
          >
            <!-- Game status / Turn indicator -->
            <div class="mb-2">
              <template v-if="game.status === 'finished'">
                <GameResult
                  :winner="game.winner!"
                  :my-color="myColor"
                >
                  <RematchPanel
                    v-if="myColor"
                    :game="game"
                    :code="code"
                    :player-id="playerId"
                    :my-color="myColor"
                    :player-name="storedPlayerName ?? 'Anonymous'"
                  />
                </GameResult>
              </template>
              <PlayerTurnIndicator
                v-else
                :current-turn="game.currentTurn"
                :turn-label="turnLabel"
                :blue-display-name="blueDisplayName"
                :orange-display-name="orangeDisplayName"
                :my-color="myColor"
                :can-nudge="canNudge"
                :is-nudging="isNudging"
                @nudge="handleNudge"
              />
            </div>

            <div class="flex flex-col items-center">
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
                :compact="false"
                :last-placement-cells="(game.lastPlacement as [number, number][])"
                @cell-click="handleBoardClick"
                @drag-start="startDrag"
              />
            </div>
          </main>

          <!-- Mobile footer with always-visible tray -->
          <MobileGameFooter
            v-if="game.status === 'playing' || game.status === 'finished'"
            :my-pieces="isSpectator ? bluePieces : myPieces"
            :opponent-pieces="isSpectator ? orangePieces : opponentPieces"
            :my-color="isSpectator ? 'blue' : (myColor || 'blue')"
            :opponent-color="isSpectator ? 'orange' : (myColor === 'blue' ? 'orange' : 'blue')"
            :selected-piece-id="isSpectator ? null : selectedPieceId"
            :is-my-turn="isMyTurn"
            :is-spectator="isSpectator"
            :board="(game.board as Board)"
            :active-tab="activeTab"
            :opponent-name="opponentName"
            :blue-display-name="blueDisplayName"
            :orange-display-name="orangeDisplayName"
            :my-remaining-cells="isSpectator ? blueRemainingCells : myRemainingCells"
            :opponent-remaining-cells="isSpectator ? orangeRemainingCells : opponentRemainingCells"
            :show-cell-count="isGameOver"
            :current-orientation-index="currentOrientationIndex"
            :all-valid-placements="allValidPlacements"
            :current-placement-index="currentPlacementIndex"
            :preview-cells="previewCells"
            :can-pass="canPass"
            @switch-tab="switchTab"
            @select="selectPiece"
            @placement-index-change="setPlacementByIndex"
            @confirm="confirmPlacement"
            @pass="passTurnAction"
          />

          <!-- Desktop: Right sidebar - Opponent pieces or Orange pieces for spectators (visible at lg+ only) -->
          <PieceSidebar
            :title="isSpectator ? orangeDisplayName : `${opponentName}'s Pieces`"
            :pieces="isSpectator ? orangePieces : opponentPieces"
            :player-color="isSpectator ? 'orange' : (myColor === 'blue' ? 'orange' : 'blue')"
            :selected-piece-id="null"
            :disabled="true"
            :board="(game.board as Board)"
            :remaining-cells="isSpectator ? orangeRemainingCells : opponentRemainingCells"
            :show-cell-count="isGameOver"
            side="right"
            @select="() => {}"
          />
        </div>

        <!-- Controls bar (bottom) -->
        <GameControlsFooter
          :derived-u-i-state="derivedUIState"
          :selected-piece-id="selectedPieceId"
          :my-color="myColor"
          :current-orientation-index="currentOrientationIndex"
          :preview-cells="previewCells"
          :can-pass="canPass"
          :interaction-type="interaction.type"
          @rotate="rotatePiece"
          @flip="flipPieceAction"
          @confirm="confirmPlacement"
          @deselect="clearSelection"
          @pass="passTurnAction"
          @clear-preview="updatePreview(null)"
        />
      </template>

      <!-- Role selection dialog -->
      <RoleSelectionDialog
        :open="onboardingState === 'selecting'"
        :blue-player="game?.players.blue"
        :orange-player="game?.players.orange"
        @update:open="(val) => !val && (onboardingState = 'ready')"
        @select="handleRoleSelect"
      />

      <!-- Takeover confirmation dialog -->
      <TakeoverConfirmDialog
        :open="onboardingState === 'confirming'"
        :current-player-name="takeoverPlayerName"
        :color="takeoverColor"
        @confirm="handleTakeoverConfirm"
        @cancel="handleTakeoverCancel"
      />

      <!-- Notification status dialog -->
      <NotificationStatusDialog
        :open="notificationDialogOpen"
        :player-id="playerId"
        :game-code="code"
        :status="notificationStatus"
        @update:open="notificationDialogOpen = $event"
        @subscribe="handleNotificationSubscribe"
      />

      <!-- Help dialog -->
      <HelpDialog
        :open="helpDialogOpen"
        @update:open="helpDialogOpen = $event"
      />
    </template>
  </div>
</template>
