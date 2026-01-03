<script setup lang="ts">
import type { PlayerColor, Board } from "../../lib/validation";
import PieceTray from "./PieceTray.vue";
import PlacementThumbwheel from "./PlacementThumbwheel.vue";

defineProps<{
  myPieces: number[];
  opponentPieces: number[];
  myColor: PlayerColor;
  opponentColor: PlayerColor;
  selectedPieceId: number | null;
  isMyTurn: boolean;
  board: Board;
  activeTab: "mine" | "opponent";
  opponentName: string;
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

const emit = defineEmits<{
  switchTab: [tab: "mine" | "opponent"];
  select: [pieceId: number];
  placementIndexChange: [index: number];
  confirm: [];
  pass: [];
}>();
</script>

<template>
  <div class="md:hidden border-t border-default bg-background">
    <div class="flex h-48">
      <!-- Left side: Tabbed piece tray -->
      <div class="flex-1 flex flex-col min-w-0">
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
            Mine<span
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
            {{ opponentName }}<span
              v-if="showCellCount"
              class="text-muted font-normal"
            > ({{ opponentRemainingCells }})</span>
          </button>
        </div>
        <!-- Tab content -->
        <div class="flex-1 overflow-y-auto">
          <PieceTray
            v-if="activeTab === 'mine'"
            :pieces="myPieces"
            :player-color="myColor"
            :selected-piece-id="selectedPieceId"
            :disabled="!isMyTurn"
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

      <!-- Right side: Wheel and button column -->
      <div class="w-12 flex flex-col border-l border-default">
        <!-- Thumbwheel -->
        <div
          v-if="selectedPieceId !== null"
          class="flex-1 min-h-0"
        >
          <PlacementThumbwheel
            :placements="allValidPlacements"
            :current-index="currentPlacementIndex"
            @update:current-index="emit('placementIndexChange', $event)"
          />
        </div>

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
      </div>
    </div>
  </div>
</template>
