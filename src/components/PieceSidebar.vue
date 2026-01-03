<script setup lang="ts">
import type { PlayerColor, Board } from "../../lib/validation";
import PieceTray from "./PieceTray.vue";

defineProps<{
  title: string;
  pieces: number[];
  playerColor: PlayerColor;
  selectedPieceId: number | null;
  disabled: boolean;
  board: Board;
  remainingCells: number;
  showCellCount: boolean;
  side: "left" | "right";
}>();

const emit = defineEmits<{
  select: [pieceId: number];
}>();
</script>

<template>
  <aside
    class="hidden flex-col flex-1 min-w-48"
    :class="[
      side === 'left' ? 'md:flex border-r border-default' : 'lg:flex border-l border-default',
    ]"
  >
    <h3
      class="text-sm font-semibold py-2 px-3 border-b border-default shrink-0 flex items-center justify-between"
    >
      <span>{{ title }}</span>
      <span
        v-if="showCellCount"
        class="text-muted font-normal"
      >{{ remainingCells }} cells</span>
    </h3>
    <div class="flex-1 overflow-y-auto p-2">
      <PieceTray
        :pieces="pieces"
        :player-color="playerColor"
        :selected-piece-id="selectedPieceId"
        :disabled="disabled"
        :board="board"
        horizontal
        @select="emit('select', $event)"
      />
    </div>
  </aside>
</template>
