<script setup lang="ts">
import { computed } from 'vue'
import { PIECES, getAllOrientations, getBoundingBox } from "../../lib/pieces"

const props = defineProps<{
  pieceId: number
  playerColor: "blue" | "orange"
  orientationIndex: number
}>()

const piece = computed(() => PIECES[props.pieceId])

const orientations = computed(() => getAllOrientations(piece.value.cells))

const currentCells = computed(() => {
  const idx = Math.min(props.orientationIndex, orientations.value.length - 1)
  return orientations.value[idx] || piece.value.cells
})

const bounds = computed(() => getBoundingBox(currentCells.value))

const gridSize = computed(() => Math.max(bounds.value.rows, bounds.value.cols, 2))

// Create flat list of cells for the grid
const gridCells = computed(() => {
  const result: { row: number; col: number; key: string }[] = []
  for (let row = 0; row < gridSize.value; row++) {
    for (let col = 0; col < gridSize.value; col++) {
      result.push({ row, col, key: `${row}-${col}` })
    }
  }
  return result
})

function isCellFilled(row: number, col: number): boolean {
  return currentCells.value.some(([r, c]) => r === row && c === col)
}
</script>

<template>
  <div
    class="grid gap-px"
    :style="{
      gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
    }"
  >
    <div
      v-for="cell in gridCells"
      :key="cell.key"
      :class="[
        'aspect-square rounded-sm',
        isCellFilled(cell.row, cell.col)
          ? playerColor === 'blue' ? 'bg-blue-500' : 'bg-orange-500'
          : 'bg-transparent'
      ]"
    />
  </div>
</template>
