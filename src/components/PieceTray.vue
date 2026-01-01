<script setup lang="ts">
import { computed } from 'vue'
import PieceMiniPreview from './PieceMiniPreview.vue'
import { canPlacePiece, type Board, type PlayerColor } from '../../lib/validation'

const props = defineProps<{
  pieces: number[]
  playerColor: PlayerColor
  selectedPieceId: number | null
  disabled: boolean
  horizontal?: boolean
  board?: Board
}>()

const emit = defineEmits<{
  select: [pieceId: number]
}>()

// Compute which pieces can be placed on the board
const unplayablePieces = computed(() => {
  if (!props.board) return new Set<number>()
  const unplayable = new Set<number>()
  for (const pieceId of props.pieces) {
    if (!canPlacePiece(props.board, pieceId, props.playerColor)) {
      unplayable.add(pieceId)
    }
  }
  return unplayable
})
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
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        unplayablePieces.has(pieceId) ? 'opacity-50' : ''
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
