<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useConvexMutation } from "convex-vue";
import { useClipboard } from "@vueuse/core";
import { api } from "../../convex/_generated/api";
import type { Board } from "../../lib/validation";
import BoardComponent from "@/components/Board.vue";
import PieceTray from "@/components/PieceTray.vue";
import PieceMiniPreview from "@/components/PieceMiniPreview.vue";
import PlacementThumbwheel from "@/components/PlacementThumbwheel.vue";
import RoleSelectionDialog from "@/components/RoleSelectionDialog.vue";
import TakeoverConfirmDialog from "@/components/TakeoverConfirmDialog.vue";
import NotificationStatusDialog from "@/components/NotificationStatusDialog.vue";
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

// Notification dialog state
const notificationDialogOpen = ref(false);

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

// Clipboard
const { copy, copied } = useClipboard();

function copyLink() {
  copy(gameUrl.value);
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
      <!-- Header (hidden on mobile when piece tray is open during active game) -->
      <header
        class="items-center justify-between px-4 py-2 border-b border-default shrink-0"
        :class="derivedUIState === 'browsing' ? 'hidden md:flex' : 'flex'"
      >
        <div class="flex items-center gap-2">
          <RouterLink
            to="/"
            class="text-lg font-bold"
          >
            Blokus Duo
          </RouterLink>
          <UBadge
            variant="subtle"
            color="neutral"
          >
            {{ code }}
          </UBadge>
        </div>
        <!-- Game status in header -->
        <div class="flex items-center gap-2">
          <!-- Notification status button -->
          <UButton
            v-if="notificationsSupported"
            variant="ghost"
            size="xl"
            :icon="bellIcon"
            title="Notification settings"
            @click="notificationDialogOpen = true"
          />
        </div>
      </header>

      <!-- Waiting for opponent -->
      <div
        v-if="game.status === 'waiting'"
        class="flex-1 flex flex-col items-center justify-center p-4"
      >
        <div class="text-center space-y-4">
          <UIcon
            name="i-lucide-users"
            class="w-12 h-12 mx-auto text-muted"
          />
          <h2 class="text-xl font-semibold">
            Waiting for opponent...
          </h2>
          <p class="text-muted">
            Share this link with a friend:
          </p>
          <div class="flex flex-col items-center gap-2">
            <UInput
              :value="gameUrl"
              size="xl"
              readonly
              class="w-64"
            />
            <UTooltip
              :text="copied ? 'Copied!' : 'Copy to clipboard'"
              :open="copied ? true : undefined"
            >
              <UButton
                size="xl"
                :color="copied ? 'success' : 'neutral'"
                :icon="copied ? 'i-lucide-copy-check' : 'i-lucide-copy'"
                @click="copyLink"
              >
                {{ copied ? 'Copied!' : 'Copy Link' }}
              </UButton>
            </UTooltip>
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
                :board="game.board as Board"
                horizontal
                @select="selectPiece"
              />
            </div>
          </aside>

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
                <div class="text-2xl font-bold text-center">
                  <span
                    v-if="game.winner === 'draw'"
                    class="text-muted"
                  >Draw!</span>
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
                    >{{ blueDisplayName }}</span>
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
                    >{{ orangeDisplayName }}</span>
                  </div>
                </div>
              </template>
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
            <div
              v-if="(derivedUIState === 'browsing' || derivedUIState === 'game_over_browsing') && interaction.type === 'browsing'"
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
                  :board="game.board as Board"
                  horizontal
                  @select="selectPiece"
                />
                <PieceTray
                  v-else
                  :pieces="opponentPieces"
                  :player-color="myColor === 'blue' ? 'orange' : 'blue'"
                  :selected-piece-id="null"
                  :disabled="true"
                  :board="game.board as Board"
                  horizontal
                  @select="() => {}"
                />
              </div>
            </div>

            <!-- Mobile: Placement controls (placing state) -->
            <div
              v-if="derivedUIState === 'placing'"
              class="md:hidden flex-1 flex items-center justify-center mt-2 p-4 gap-3"
            >
              <div class="flex flex-col gap-3 max-w-sm mx-auto">
                <!-- Preview + manipulation row -->
                <div class="flex items-center justify-center gap-3">
                  <PieceMiniPreview
                    :piece-id="selectedPieceId!"
                    :player-color="myColor || 'blue'"
                    :orientation-index="currentOrientationIndex"
                    class="w-12 h-12"
                    @click="changePiece"
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

              <!-- Thumbwheel for cycling through placements -->
              <!--              v-if="interaction.type === 'placing'"-->
              <div
                class="w-12 h-28 relative"
              >
                <PlacementThumbwheel
                  :placements="allValidPlacements"
                  :current-index="currentPlacementIndex"
                  @update:current-index="setPlacementByIndex"
                />
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
                :board="game.board as Board"
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
              v-if="derivedUIState === 'my_turn'"
              size="xl"
              class="md:hidden"
              @click="openTray('mine')"
            >
              Select Piece
            </UButton>

            <!-- Mobile: Hide tray button (browsing state) -->
            <UButton
              v-if="derivedUIState === 'browsing' || derivedUIState === 'game_over_browsing'"
              size="xl"
              class="md:hidden"
              variant="outline"
              @click="closeTray"
            >
              Hide
            </UButton>

            <!-- Mobile: View Pieces button (watching/finished state) -->
            <UButton
              v-if="derivedUIState === 'opponent_turn' || derivedUIState === 'game_over'"
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
                :class="{ 'hidden md:flex': derivedUIState === 'placing' }"
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
                :class="{ 'hidden md:flex': derivedUIState === 'placing' }"
              >
                <UButton
                  icon="i-lucide-rotate-ccw"
                  variant="outline"
                  size="xl"
                  title="Rotate (R)"
                  @click="rotatePiece('ccw')"
                />
                <UButton
                  icon="i-lucide-rotate-cw"
                  variant="outline"
                  size="xl"
                  title="Rotate (R)"
                  @click="rotatePiece('cw')"
                />
                <UButton
                  icon="i-lucide-flip-horizontal"
                  variant="outline"
                  size="xl"
                  title="Flip (F)"
                  @click="flipPieceAction"
                />
              </div>

              <!-- Confirm/Cancel when preview is active (desktop only) -->
              <template v-if="previewCells">
                <UButton
                  size="xl"
                  color="primary"
                  :class="{ 'hidden md:inline-flex': derivedUIState === 'placing' }"
                  @click="confirmPlacement"
                >
                  Confirm
                </UButton>
                <UButton
                  size="xl"
                  variant="outline"
                  :class="{ 'hidden md:inline-flex': derivedUIState === 'placing' }"
                  @click="interaction.type === 'placing' && (interaction = { ...interaction, preview: null })"
                >
                  Cancel
                </UButton>
              </template>

              <!-- Change piece button (tablet only, hidden on mobile and lg+) -->
              <UButton
                v-if="!previewCells && interaction.type === 'placing'"
                variant="ghost"
                size="xl"
                class="hidden md:inline-flex lg:hidden"
                @click="changePiece"
              >
                Change
              </UButton>
              <UButton
                v-if="!previewCells"
                variant="ghost"
                size="xl"
                :class="{ 'hidden md:inline-flex': derivedUIState === 'placing' }"
                @click="clearSelection"
              >
                Deselect
              </UButton>
            </template>

            <!-- Pass button -->
            <UButton
              v-if="canPass && !previewCells"
              size="xl"
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
    </template>
  </div>
</template>
