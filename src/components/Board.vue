<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Board } from "../../lib/validation"

const props = defineProps<{
  board: Board
  previewCells: [number, number][] | null
  previewColor: "blue" | "orange"
  validAnchors: [number, number][]
  showAnchors: boolean
  isDragging?: boolean
}>()

const emit = defineEmits<{
  cellClick: [row: number, col: number]
  dragStart: [event: PointerEvent]
}>()

// Expose board element ref for coordinate calculations
const boardRef = ref<HTMLElement | null>(null)
defineExpose({ boardRef })

const BOARD_SIZE = 14
const STARTING_POSITIONS = {
  blue: { row: 4, col: 4 },
  orange: { row: 9, col: 9 },
}

// Create flat list of all cells
const cells = computed(() => {
  const result: { row: number; col: number; key: string }[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      result.push({ row, col, key: `${row}-${col}` })
    }
  }
  return result
})

function isPreviewCell(row: number, col: number): boolean {
  if (!props.previewCells) return false
  return props.previewCells.some(([r, c]) => r === row && c === col)
}

function isValidAnchor(row: number, col: number): boolean {
  if (!props.showAnchors) return false
  return props.validAnchors.some(([r, c]) => r === row && c === col)
}

function isStartingPosition(row: number, col: number): "blue" | "orange" | null {
  if (row === STARTING_POSITIONS.blue.row && col === STARTING_POSITIONS.blue.col) return "blue"
  if (row === STARTING_POSITIONS.orange.row && col === STARTING_POSITIONS.orange.col) return "orange"
  return null
}

function getCellClass(row: number, col: number): string {
  const value = props.board[row][col]
  // Base classes - all cells get subtle border for grid visibility
  const classes: string[] = ["w-full", "h-full", "transition-colors", "border", "border-gray-200", "dark:border-gray-700"]

  if (value === 1) {
    classes.push("bg-blue-500")
  } else if (value === 2) {
    classes.push("bg-orange-500")
  } else if (isPreviewCell(row, col)) {
    classes.push(
      props.previewColor === "blue" ? "bg-blue-500/50" : "bg-orange-500/50",
    )
    // Add drag cursor for preview cells
    if (!props.isDragging) {
      classes.push("cursor-grab")
    } else {
      classes.push("cursor-grabbing")
    }
  } else {
    // Empty cell - check for starting position styling
    const start = isStartingPosition(row, col)
    if (start) {
      classes.push(
        start === "blue" ? "bg-blue-500/10" : "bg-orange-500/10",
        "!border-2",
        "!border-dashed",
        start === "blue" ? "!border-blue-500/30" : "!border-orange-500/30"
      )
    } else {
      classes.push("bg-default-50 dark:bg-default-900")
    }

    // Add cursor pointer if it's a valid anchor
    if (isValidAnchor(row, col)) {
      classes.push("cursor-pointer")
    }
  }

  return classes.join(" ")
}

function handlePointerDown(event: PointerEvent, row: number, col: number) {
  if (isPreviewCell(row, col)) {
    emit('dragStart', event)
  }
}

function handleCellClick(row: number, col: number) {
  if (isValidAnchor(row, col) || isPreviewCell(row, col)) {
    emit("cellClick", row, col)
  }
}
</script>

<template>
  <div
    ref="boardRef"
    class="grid rounded-lg shadow-lg ring-2 ring-default-400 dark:ring-default-500 overflow-hidden select-none"
    :style="{
      gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
      width: 'min(calc(100vw - 32px), calc(100dvh - 180px), 560px)',
      aspectRatio: '1',
      height: 'auto',
      touchAction: previewCells ? 'none' : 'auto'
    }"
  >
    <div
      v-for="cell in cells"
      :key="cell.key"
      :class="getCellClass(cell.row, cell.col)"
      class="relative"
      @click="handleCellClick(cell.row, cell.col)"
      @pointerdown="handlePointerDown($event, cell.row, cell.col)"
    >
      <div
        v-if="isValidAnchor(cell.row, cell.col)"
        class="absolute inset-0 m-auto w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500"
      />
    </div>
  </div>
</template>
