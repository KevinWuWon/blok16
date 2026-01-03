<script setup lang="ts">
import type { PlayerColor, Board } from "../../lib/validation";
import PieceTray from "./PieceTray.vue";

defineProps<{
  myPieces: number[];
  opponentPieces: number[];
  myColor: PlayerColor;
  opponentColor: PlayerColor;
  selectedPieceId: number | null;
  isMyTurn: boolean;
  board: Board;
  currentTab: "mine" | "opponent";
  opponentName: string;
  myRemainingCells: number;
  opponentRemainingCells: number;
  showCellCount: boolean;
}>();

const emit = defineEmits<{
  switchTab: [tab: "mine" | "opponent"];
  select: [pieceId: number];
}>();
</script>

<template>
  <div class="w-full flex-1 flex flex-col border-t border-default mt-2 min-h-0">
    <!-- Tabs -->
    <div class="flex border-b border-default shrink-0">
      <button
        :class="[
          'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
          currentTab === 'mine'
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
          currentTab === 'opponent'
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
        v-if="currentTab === 'mine'"
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
</template>
