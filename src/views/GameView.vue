<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useConvexMutation } from "convex-vue";
import { api } from "../../convex/_generated/api";
import { hasValidMoves, type Board } from "../../lib/validation";
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
import PieceTabs from "@/components/PieceTabs.vue";
import MobilePlacementControls from "@/components/MobilePlacementControls.vue";
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
const pushSubscribeMutation = useConvexMutation(api.push.subscribe);
const pushUpdateGameCodeMutation = useConvexMutation(api.push.updateGameCode);

// Use composables
const {
  game,
  isLoading,
  myColor,
  isMyTurn,
  myPieces,
  opponentPieces,
  opponentName,
  blueDisplayName,
  orangeDisplayName,
  turnLabel,
  gameUrl,
  gameBoard,
} = useGameState(code, role);

// Interaction composable (without isDragging initially)
const {
  interaction,
  selectedPieceId,
  currentOrientationIndex,
  previewCells,
  allValidPlacements,
  currentPlacementIndex,
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
} = useGameFlow(
  game,
  role,
  isLoading,
  isMyTurn,
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
} = useNotifications();

// Get Convex URL for service worker subscription refresh
const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

// Dialog states
const notificationDialogOpen = ref(false);
const helpDialogOpen = ref(false);

// Bell icon based on permission state
const bellIcon = computed(() => {
  if (!notificationsSupported || !isPushSupported) return "i-lucide-bell-off";
  if (notificationPermission.value === "denied") return "i-lucide-bell-off";
  if (notificationPermission.value === "granted") return "i-lucide-bell-ring";
  return "i-lucide-bell";
});

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
    }
  }
}

const lastSubscriptionSyncKey = ref<string>("");

async function syncExistingSubscription() {
  if (!isPushSupported || !playerId.value) return;
  const syncKey = `${playerId.value}:${code.value}`;
  if (lastSubscriptionSyncKey.value === syncKey) return;

  const existingSub = await getExistingSubscription();
  if (!existingSub) return;

  const subData = getSubscriptionData(existingSub);
  if (!subData) return;

  await pushUpdateGameCodeMutation.mutate({
    playerId: playerId.value,
    gameCode: code.value,
  });

  // Ensure service worker has player info for subscription refresh
  storePlayerInfoForServiceWorker(playerId.value, convexUrl);
  lastSubscriptionSyncKey.value = syncKey;
}

watch([playerId, code], () => {
  void syncExistingSubscription();
}, { immediate: true });

// Calculate remaining cells for each player
function countRemainingCells(pieceIds: number[]): number {
  return pieceIds.reduce((sum, id) => sum + (PIECES[id]?.size ?? 0), 0);
}
const myRemainingCells = computed(() => countRemainingCells(myPieces.value));
const opponentRemainingCells = computed(() => countRemainingCells(opponentPieces.value));

// Check if player has no legal moves (canPass is true when no moves available)
const myHasNoMoves = computed(() => canPass.value);
const opponentHasNoMoves = computed(() => {
  if (!game.value || !myColor.value) return false;
  const opponentColor = myColor.value === "blue" ? "orange" : "blue";
  return !hasValidMoves(
    game.value.board as Board,
    opponentPieces.value,
    opponentColor,
  );
});
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
        @help-click="helpDialogOpen = true"
        @notification-click="notificationDialogOpen = true"
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
          <!-- Desktop: Left sidebar - Your pieces (visible at md+) -->
          <PieceSidebar
            title="Your Pieces"
            :pieces="myPieces"
            :player-color="myColor || 'blue'"
            :selected-piece-id="selectedPieceId"
            :disabled="!isMyTurn"
            :board="(game.board as Board)"
            :has-no-moves="myHasNoMoves"
            :remaining-cells="myRemainingCells"
            side="left"
            @select="selectPiece"
          />

          <!-- Board area -->
          <main
            class="flex flex-col items-center p-4 overflow-hidden"
            :class="derivedUIState === 'browsing' || derivedUIState === 'game_over_browsing' ? 'justify-start pt-2' : 'justify-center'"
          >
            <!-- Game status / Turn indicator (hidden on mobile when piece tray is open during active game) -->
            <div
              class="mb-4"
              :class="{ 'hidden md:block': derivedUIState === 'browsing' }"
            >
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
                :compact="derivedUIState === 'browsing' || derivedUIState === 'game_over_browsing'"
                :last-placement-cells="(game.lastPlacement as [number, number][])"
                @cell-click="handleBoardClick"
                @drag-start="startDrag"
              />
            </div>

            <!-- Mobile: Inline piece tray (browsing state) -->
            <PieceTabs
              v-if="(derivedUIState === 'browsing' || derivedUIState === 'game_over_browsing') && interaction.type === 'browsing'"
              class="md:hidden"
              :my-pieces="myPieces"
              :opponent-pieces="opponentPieces"
              :my-color="myColor || 'blue'"
              :opponent-color="myColor === 'blue' ? 'orange' : 'blue'"
              :selected-piece-id="selectedPieceId"
              :is-my-turn="isMyTurn"
              :board="(game.board as Board)"
              :current-tab="interaction.tab"
              :opponent-name="opponentName"
              :my-has-no-moves="myHasNoMoves"
              :opponent-has-no-moves="opponentHasNoMoves"
              :my-remaining-cells="myRemainingCells"
              :opponent-remaining-cells="opponentRemainingCells"
              @switch-tab="switchTab"
              @select="selectPiece"
            />

            <!-- Mobile: Placement controls (placing state) -->
            <MobilePlacementControls
              v-if="derivedUIState === 'placing'"
              class="md:hidden"
              :selected-piece-id="selectedPieceId!"
              :player-color="myColor || 'blue'"
              :current-orientation-index="currentOrientationIndex"
              :all-valid-placements="allValidPlacements"
              :current-placement-index="currentPlacementIndex"
              @change-piece="changePiece"
              @rotate="rotatePiece"
              @flip="flipPieceAction"
              @confirm="confirmPlacement"
              @placement-index-change="setPlacementByIndex"
            />
          </main>

          <!-- Desktop: Right sidebar - Opponent pieces (visible at lg+ only) -->
          <PieceSidebar
            :title="`${opponentName}'s Pieces`"
            :pieces="opponentPieces"
            :player-color="myColor === 'blue' ? 'orange' : 'blue'"
            :selected-piece-id="null"
            :disabled="true"
            :board="(game.board as Board)"
            :has-no-moves="opponentHasNoMoves"
            :remaining-cells="opponentRemainingCells"
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
          @open-tray="openTray"
          @close-tray="closeTray"
          @rotate="rotatePiece"
          @flip="flipPieceAction"
          @confirm="confirmPlacement"
          @deselect="clearSelection"
          @change-piece="changePiece"
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
