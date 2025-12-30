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

// Always use 5x5 grid for consistency (largest piece is 5 squares)
const GRID_SIZE = 5

// Center the piece within the 5x5 grid
const centeredCells = computed(() => {
  const offsetRow = Math.floor((GRID_SIZE - bounds.value.rows) / 2)
  const offsetCol = Math.floor((GRID_SIZE - bounds.value.cols) / 2)
  return currentCells.value.map(([r, c]) => [r + offsetRow, c + offsetCol] as [number, number])
})

// Create flat list of cells for the grid
const gridCells = computed(() => {
  const result: { row: number; col: number; key: string }[] = []
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      result.push({ row, col, key: `${row}-${col}` })
    }
  }
  return result
})

function isCellFilled(row: number, col: number): boolean {
  return centeredCells.value.some(([r, c]) => r === row && c === col)
}
</script>

<template>
  <div
    class="grid gap-px"
    :style="{
      gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`
    }"
  >
    <div
      v-for="cell in gridCells"
      :key="cell.key"
      :class="[
        'aspect-square',
        isCellFilled(cell.row, cell.col)
          ? playerColor === 'blue' ? 'bg-blue-500' : 'bg-orange-500'
          : 'bg-transparent'
      ]"
    />
  </div>
</template>
