<script setup lang="ts">
import { computed } from "vue";
import type { PlayerColor, Board } from "../../lib/validation";
import PieceTray from "./PieceTray.vue";
import PlacementThumbwheel from "./PlacementThumbwheel.vue";

const props = defineProps<{
  myPieces: number[];
  opponentPieces: number[];
  myColor: PlayerColor;
  opponentColor: PlayerColor;
  selectedPieceId: number | null;
  isMyTurn: boolean;
  isSpectator: boolean;
  board: Board;
  activeTab: "mine" | "opponent";
  opponentName: string;
  blueDisplayName: string;
  orangeDisplayName: string;
  myRemainingCells: number;
  opponentRemainingCells: number;
  showCellCount: boolean;
  currentOrientationIndex: number;
  allValidPlacements: Array<{
    anchor: [number, number];
    cells: [number, number][];
    orientationIndex: number;
  }>;
  currentPlacementIndex: number;
  previewCells: [number, number][] | null;
  canPass: boolean;
}>();

// Computed labels for tabs (spectators see color names, players see Mine/Opponent)
const firstTabLabel = computed(() => props.isSpectator ? props.blueDisplayName : "Mine");
const secondTabLabel = computed(() => props.isSpectator ? props.orangeDisplayName : props.opponentName);

const emit = defineEmits<{
  switchTab: [tab: "mine" | "opponent"];
  select: [pieceId: number];
  placementIndexChange: [index: number];
  confirm: [];
  pass: [];
}>();
</script>

<template>
  <div class="md:hidden flex-1 flex border-t border-default bg-background items-stretch">
    <!-- Left side: Tabbed piece tray -->
    <div class="flex-1 relative">
      <div class="absolute inset-0 flex flex-col min-w-0">
        <!-- Tabs -->
        <div class="flex border-b border-default shrink-0">
          <button
            :class="[
              'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'mine'
                ? 'border-b-2 border-primary text-primary'
                : 'text-default-500 hover:text-default-700',
            ]"
            @click="emit('switchTab', 'mine')"
          >
            {{ firstTabLabel }}<span
              v-if="showCellCount"
              class="text-muted font-normal"
            > ({{ myRemainingCells }})</span>
          </button>
          <button
            :class="[
              'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === 'opponent'
                ? 'border-b-2 border-primary text-primary'
                : 'text-default-500 hover:text-default-700',
            ]"
            @click="emit('switchTab', 'opponent')"
          >
            {{ secondTabLabel }}<span
              v-if="showCellCount"
              class="text-muted font-normal"
            > ({{ opponentRemainingCells }})</span>
          </button>
        </div>
        <!-- Tab content -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <PieceTray
            v-if="activeTab === 'mine'"
            :pieces="myPieces"
            :player-color="myColor"
            :selected-piece-id="isSpectator ? null : selectedPieceId"
            :disabled="isSpectator || !isMyTurn"
            :board="board"
            horizontal
            @select="emit('select', $event)"
          />
          <PieceTray
            v-else
            :pieces="opponentPieces"
            :player-color="opponentColor"
            :selected-piece-id="null"
            :disabled="true"
            :board="board"
            horizontal
            @select="() => {}"
          />
        </div>
      </div>
    </div>

    <!-- Right side: Wheel and button column -->
    <div
      v-if="isMyTurn"
      class="w-12 flex flex-col border-l border-default"
    >
      <!-- Confirm/Pass button -->
      <div class="shrink-0 p-1">
        <UButton
          v-if="canPass && !previewCells"
          icon="i-lucide-skip-forward"
          size="xl"
          variant="outline"
          color="warning"
          class="w-full"
          @click="emit('pass')"
        />
        <UButton
          v-else
          icon="i-lucide-check"
          size="xl"
          :disabled="!previewCells"
          class="w-full"
          @click="emit('confirm')"
        />
      </div>

      <!-- Thumbwheel -->
      <div
        class="flex-1 min-h-0 relative my-2 mx-1"
        :class="{ invisible: selectedPieceId === null }"
      >
        <PlacementThumbwheel
          :placements="allValidPlacements"
          :current-index="currentPlacementIndex"
          @update:current-index="emit('placementIndexChange', $event)"
        />
      </div>
    </div>
  </div>
</template>
