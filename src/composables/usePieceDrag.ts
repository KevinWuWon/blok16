import { ref, computed, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { findNearestValidAnchor, findValidPlacementsAtAnchor, findBestPlacementForCursor, type Board, type PlayerColor } from '../../lib/validation'

export interface DragState {
  isDragging: boolean
  // Pixel position of cursor relative to board
  cursorX: number
  cursorY: number
  // Grid position (row, col) of cursor
  gridRow: number
  gridCol: number
  // Snapped anchor position
  snapRow: number | null
  snapCol: number | null
  // Original anchor position before drag started
  originalAnchor: [number, number] | null
}

export function usePieceDrag(
  boardElement: Ref<HTMLElement | null>,
  board: Ref<Board>,
  selectedPieceId: Ref<number | null>,
  currentOrientationIndex: Ref<number>,
  validAnchors: Ref<[number, number][]>,
  playerColor: Ref<PlayerColor | null>,
  previewCells: Ref<[number, number][] | null>,
  onPreviewUpdate: (cells: [number, number][] | null) => void
) {
  const BOARD_SIZE = 14

  const isDragging = ref(false)
  const cursorX = ref(0)
  const cursorY = ref(0)
  const originalAnchor = ref<[number, number] | null>(null)
  // Store the orientation at drag start (currentOrientationIndex is now properly tracked)
  const dragOrientationIndex = ref(0)

  // Calculate cell size based on board element
  const cellSize = computed(() => {
    if (!boardElement.value) return 40
    return boardElement.value.getBoundingClientRect().width / BOARD_SIZE
  })

  // Convert cursor position to grid coordinates
  const gridPosition = computed(() => {
    if (!boardElement.value) return { row: 0, col: 0 }
    const rect = boardElement.value.getBoundingClientRect()
    const row = Math.floor((cursorY.value - rect.top) / cellSize.value)
    const col = Math.floor((cursorX.value - rect.left) / cellSize.value)
    return { row, col }
  })

  // Find nearest valid anchor to current cursor position
  const snappedAnchor = computed(() => {
    if (!isDragging.value || validAnchors.value.length === 0) return null
    return findNearestValidAnchor(gridPosition.value.row, gridPosition.value.col, validAnchors.value)
  })

  // Floating piece position (for smooth cursor follow)
  const floatingPosition = computed(() => {
    if (!boardElement.value || !isDragging.value || !previewCells.value) return null

    const rect = boardElement.value.getBoundingClientRect()
    // Calculate offset from original anchor to cursor
    return {
      x: cursorX.value - rect.left,
      y: cursorY.value - rect.top,
    }
  })

  // Start drag from a preview cell
  function startDrag(event: PointerEvent) {
    if (!previewCells.value || !boardElement.value || selectedPieceId.value === null) return

    event.preventDefault()
    isDragging.value = true
    cursorX.value = event.clientX
    cursorY.value = event.clientY

    // Capture the current orientation at drag start
    // (currentOrientationIndex is now properly tracked by GameView)
    dragOrientationIndex.value = currentOrientationIndex.value

    // Store original anchor (find from current preview cells)
    const firstCell = previewCells.value[0]
    originalAnchor.value = firstCell ? [firstCell[0], firstCell[1]] : null
  }

  // Update during drag
  function updateDrag(event: PointerEvent) {
    if (!isDragging.value) return

    cursorX.value = event.clientX
    cursorY.value = event.clientY

    // Update preview to snapped position
    if (snappedAnchor.value && selectedPieceId.value !== null && playerColor.value) {
      const placements = findValidPlacementsAtAnchor(
        board.value,
        selectedPieceId.value,
        snappedAnchor.value[0],
        snappedAnchor.value[1],
        playerColor.value
      )

      // Only consider placements with the orientation detected at drag start
      // This ensures dragging never rotates the piece
      const matchingPlacements = placements.filter(
        p => p.orientationIndex === dragOrientationIndex.value
      )

      if (matchingPlacements.length > 0) {
        // Find the best placement based on cursor position among matching orientations
        const placement = findBestPlacementForCursor(
          gridPosition.value.row,
          gridPosition.value.col,
          matchingPlacements,
          dragOrientationIndex.value
        )

        if (placement) {
          onPreviewUpdate(placement.cells)
        }
      }
      // If no valid placement with current orientation, don't update preview
    }
  }

  // End drag
  function endDrag() {
    if (!isDragging.value) return

    isDragging.value = false
    // Preview is already at snapped position from updateDrag
    originalAnchor.value = null
  }

  // Cancel drag (e.g., on Escape)
  function cancelDrag() {
    if (!isDragging.value) return

    isDragging.value = false

    // Restore original position with the orientation we started with
    if (originalAnchor.value && selectedPieceId.value !== null && playerColor.value) {
      const placements = findValidPlacementsAtAnchor(
        board.value,
        selectedPieceId.value,
        originalAnchor.value[0],
        originalAnchor.value[1],
        playerColor.value
      )
      const matchingPlacement = placements.find(p => p.orientationIndex === dragOrientationIndex.value)
      if (matchingPlacement) {
        onPreviewUpdate(matchingPlacement.cells)
      }
    }

    originalAnchor.value = null
  }

  // Global event listeners for drag
  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (isDragging.value) {
      updateDrag(e)
    }
  })

  useEventListener(window, 'pointerup', () => {
    if (isDragging.value) {
      endDrag()
    }
  })

  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDragging.value) {
      cancelDrag()
    }
  })

  return {
    isDragging,
    floatingPosition,
    gridPosition,
    snappedAnchor,
    cellSize,
    startDrag,
    cancelDrag,
  }
}
