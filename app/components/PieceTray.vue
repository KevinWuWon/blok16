<script setup lang="ts">
import { PIECES, getAllOrientations, getBoundingBox } from "../../lib/pieces";

const props = defineProps<{
  pieces: number[];
  playerColor: "blue" | "orange";
  selectedPieceId: number | null;
  disabled: boolean;
  horizontal?: boolean;
}>();

const emit = defineEmits<{
  select: [pieceId: number];
}>();

function getPieceCells(pieceId: number): [number, number][] {
  return PIECES[pieceId].cells;
}

function getPieceBounds(pieceId: number): { rows: number; cols: number } {
  return getBoundingBox(PIECES[pieceId].cells);
}
</script>

<template>
  <div
    :class="[
      'flex gap-2 p-2',
      horizontal ? 'flex-row flex-wrap justify-center' : 'flex-col'
    ]"
  >
    <button
      v-for="pieceId in pieces"
      :key="pieceId"
      :disabled="disabled"
      :class="[
        'relative p-1 rounded-lg transition-all',
        'hover:bg-default-100 dark:hover:bg-default-800',
        selectedPieceId === pieceId
          ? 'ring-2 ring-primary bg-primary/10'
          : 'bg-transparent',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      ]"
      @click="!disabled && emit('select', pieceId)"
    >
      <PieceMiniPreview
        :piece-id="pieceId"
        :player-color="playerColor"
        :orientation-index="0"
        class="w-12 h-12"
      />
    </button>
  </div>
</template>
