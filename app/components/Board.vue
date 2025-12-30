<script setup lang="ts">
import type { Board } from "../../lib/validation";

const props = defineProps<{
  board: Board;
  previewCells: [number, number][] | null;
  previewColor: "blue" | "orange";
  validAnchors: [number, number][];
  showAnchors: boolean;
}>();

const emit = defineEmits<{
  cellClick: [row: number, col: number];
}>();

const BOARD_SIZE = 14;
const STARTING_POSITIONS = {
  blue: { row: 4, col: 4 },
  orange: { row: 9, col: 9 },
};

// Create flat list of all cells
const cells = computed(() => {
  const result: { row: number; col: number; key: string }[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      result.push({ row, col, key: `${row}-${col}` });
    }
  }
  return result;
});

function isPreviewCell(row: number, col: number): boolean {
  if (!props.previewCells) return false;
  return props.previewCells.some(([r, c]) => r === row && c === col);
}

function isValidAnchor(row: number, col: number): boolean {
  if (!props.showAnchors) return false;
  return props.validAnchors.some(([r, c]) => r === row && c === col);
}

function isStartingPosition(row: number, col: number): "blue" | "orange" | null {
  if (row === STARTING_POSITIONS.blue.row && col === STARTING_POSITIONS.blue.col) return "blue";
  if (row === STARTING_POSITIONS.orange.row && col === STARTING_POSITIONS.orange.col) return "orange";
  return null;
}

function getCellClass(row: number, col: number): string {
  const value = props.board[row][col];
  const classes: string[] = ["w-full", "h-full", "transition-colors"];

  if (value === 1) {
    classes.push("bg-blue-500");
  } else if (value === 2) {
    classes.push("bg-orange-500");
  } else if (isPreviewCell(row, col)) {
    classes.push(
      props.previewColor === "blue" ? "bg-blue-500/50" : "bg-orange-500/50",
      "ring-2",
      props.previewColor === "blue" ? "ring-blue-500" : "ring-orange-500"
    );
  } else if (isValidAnchor(row, col)) {
    classes.push(
      "cursor-pointer",
      props.previewColor === "blue" ? "bg-blue-500/20" : "bg-orange-500/20",
      "hover:bg-opacity-40"
    );
  } else {
    const start = isStartingPosition(row, col);
    if (start) {
      classes.push(
        start === "blue" ? "bg-blue-500/10" : "bg-orange-500/10",
        "border-2",
        "border-dashed",
        start === "blue" ? "border-blue-500/30" : "border-orange-500/30"
      );
    } else {
      classes.push("bg-default-50 dark:bg-default-900");
    }
  }

  return classes.join(" ");
}

function handleCellClick(row: number, col: number) {
  if (isValidAnchor(row, col) || isPreviewCell(row, col)) {
    emit("cellClick", row, col);
  }
}
</script>

<template>
  <div
    class="grid gap-px bg-default-200 dark:bg-default-700 p-px rounded-lg shadow-lg"
    :style="{
      gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
      width: 'min(90vw, 90vh, 560px)',
      aspectRatio: '1'
    }"
  >
    <div
      v-for="cell in cells"
      :key="cell.key"
      :class="getCellClass(cell.row, cell.col)"
      @click="handleCellClick(cell.row, cell.col)"
    />
  </div>
</template>
