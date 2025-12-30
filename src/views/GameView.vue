<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useConvexQuery, useConvexMutation } from "convex-vue"
import { api } from "../../convex/_generated/api"
import type { Doc } from "../../convex/_generated/dataModel"
import {
  findCornerAnchors,
  findValidPlacementsAtAnchor,
  getNextValidOrientation,
  hasValidMoves,
  getValidAnchorsForPiece,
  type PlayerColor,
  type Board,
} from "../../lib/validation"
import { PIECES, flipH, normalize } from "../../lib/pieces"
import BoardComponent from '@/components/Board.vue'
import PieceTray from '@/components/PieceTray.vue'
import PieceMiniPreview from '@/components/PieceMiniPreview.vue'

type GameState = Doc<"games">

const route = useRoute()
const code = computed(() => route.params.code as string)

// Player ID from localStorage
const playerId = ref<string>("")

onMounted(() => {
  let id = localStorage.getItem("blokus-player-id")
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem("blokus-player-id", id)
  }
  playerId.value = id
})

// Convex query for game state
const { data: game, isPending: isLoading } = useConvexQuery(api.games.getGame, () => ({
  code: code.value,
}))

// Mutations
const joinGameMutation = useConvexMutation(api.games.joinGame)
const placePieceMutation = useConvexMutation(api.games.placePiece)
const passTurnMutation = useConvexMutation(api.games.passTurn)

// Local game state
const selectedPieceId = ref<number | null>(null)
const previewCells = ref<[number, number][] | null>(null)
const currentOrientationIndex = ref(0)
const showPieceSheet = ref(false)
const joinError = ref<string | null>(null)

// Computed values
const myColor = computed<PlayerColor | null>(() => {
  if (!game.value || !playerId.value) return null
  if (game.value.players.blue === playerId.value) return "blue"
  if (game.value.players.orange === playerId.value) return "orange"
  return null
})

const isMyTurn = computed(() => {
  return game.value?.currentTurn === myColor.value && game.value?.status === "playing"
})

const myPieces = computed(() => {
  if (!game.value || !myColor.value) return []
  return game.value.pieces[myColor.value]
})

const opponentPieces = computed(() => {
  if (!game.value || !myColor.value) return []
  const opponentColor = myColor.value === "blue" ? "orange" : "blue"
  return game.value.pieces[opponentColor]
})

const validAnchors = computed(() => {
  if (!game.value || !myColor.value || !isMyTurn.value) return []
  return findCornerAnchors(game.value.board as Board, myColor.value)
})

const validAnchorsForSelectedPiece = computed(() => {
  if (!game.value || !myColor.value || selectedPieceId.value === null || !isMyTurn.value) return []
  return getValidAnchorsForPiece(game.value.board as Board, selectedPieceId.value, myColor.value)
})

const canPass = computed(() => {
  if (!game.value || !myColor.value || !isMyTurn.value) return false
  return !hasValidMoves(game.value.board as Board, myPieces.value, myColor.value)
})

const hasAnyValidMoves = computed(() => {
  if (!game.value || !myColor.value) return true
  return hasValidMoves(game.value.board as Board, myPieces.value, myColor.value)
})

const needsToJoin = computed(() => {
  if (!game.value || !playerId.value) return false
  // Not already a player and game is waiting
  return !myColor.value && game.value.status === "waiting"
})

const gameUrl = computed(() => {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/game/${code.value}`
})

// Auto-join when arriving at game page
watch([game, playerId], async () => {
  if (needsToJoin.value && playerId.value) {
    const result = await joinGameMutation.mutate({
      code: code.value,
      playerId: playerId.value,
    })
    if (!result?.success && result?.error) {
      joinError.value = result.error
    }
  }
}, { immediate: true })

// Actions
function selectPiece(pieceId: number) {
  if (!myPieces.value.includes(pieceId)) return
  selectedPieceId.value = pieceId
  previewCells.value = null
  currentOrientationIndex.value = 0
  showPieceSheet.value = false
}

function clearSelection() {
  selectedPieceId.value = null
  previewCells.value = null
  currentOrientationIndex.value = 0
}

function handleBoardClick(row: number, col: number) {
  if (!game.value || !myColor.value || !isMyTurn.value) return
  if (selectedPieceId.value === null) return

  const placements = findValidPlacementsAtAnchor(
    game.value.board as Board,
    selectedPieceId.value,
    row,
    col,
    myColor.value
  )

  if (placements.length > 0) {
    const matchingOrientation = placements.find(
      (p) => p.orientationIndex === currentOrientationIndex.value
    )
    const placement = matchingOrientation || placements[0]
    previewCells.value = placement.cells
    currentOrientationIndex.value = placement.orientationIndex
  }
}

function rotatePiece(direction: "cw" | "ccw") {
  if (!game.value || !myColor.value || selectedPieceId.value === null) return

  if (previewCells.value) {
    const nextCells = getNextValidOrientation(
      game.value.board as Board,
      selectedPieceId.value,
      previewCells.value,
      myColor.value,
      direction
    )
    if (nextCells) {
      previewCells.value = nextCells
    }
  } else {
    const orientations = getAllOrientationsForPiece(selectedPieceId.value)
    const numOrientations = orientations.length
    if (direction === "cw") {
      currentOrientationIndex.value = (currentOrientationIndex.value + 1) % numOrientations
    } else {
      currentOrientationIndex.value = (currentOrientationIndex.value - 1 + numOrientations) % numOrientations
    }
  }
}

function flipPieceAction() {
  if (!game.value || !myColor.value || selectedPieceId.value === null) return

  if (previewCells.value) {
    const nextCells = getNextValidOrientation(
      game.value.board as Board,
      selectedPieceId.value,
      previewCells.value,
      myColor.value,
      "cw"
    )
    if (nextCells) {
      previewCells.value = nextCells
    }
  }
}

async function confirmPlacement() {
  if (!previewCells.value || selectedPieceId.value === null) return

  const result = await placePieceMutation.mutate({
    code: code.value,
    playerId: playerId.value,
    pieceId: selectedPieceId.value,
    cells: previewCells.value,
  })

  if (result?.success) {
    clearSelection()
  }
}

async function passTurnAction() {
  await passTurnMutation.mutate({
    code: code.value,
    playerId: playerId.value,
  })
}

async function copyLink() {
  await navigator.clipboard.writeText(gameUrl.value)
}

// Keyboard shortcuts
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "r" || e.key === "R") {
      rotatePiece("cw")
    } else if (e.key === "f" || e.key === "F") {
      flipPieceAction()
    } else if (e.key === "Escape") {
      if (previewCells.value) {
        previewCells.value = null
      } else {
        clearSelection()
      }
    }
  }

  window.addEventListener("keydown", handleKeydown)
  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown)
  })
})

// Helper functions
function getAllOrientationsForPiece(pieceId: number): [number, number][][] {
  const piece = PIECES[pieceId]
  const orientations: [number, number][][] = []
  const seen = new Set<string>()

  let current = normalize(piece.cells)

  for (let flip = 0; flip < 2; flip++) {
    for (let rot = 0; rot < 4; rot++) {
      const key = [...current]
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
        .map(([r, c]) => `${r},${c}`)
        .join("|")
      if (!seen.has(key)) {
        seen.add(key)
        orientations.push([...current])
      }
      current = rotateCW(current)
    }
    current = flipH(piece.cells)
  }

  return orientations
}

function rotateCW(cells: [number, number][]): [number, number][] {
  const rotated = cells.map(([r, c]) => [c, -r] as [number, number])
  return normalize(rotated)
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin" />
    </div>

    <!-- Game not found -->
    <div v-else-if="!game" class="flex-1 flex flex-col items-center justify-center p-4">
      <h1 class="text-2xl font-bold mb-4">Game Not Found</h1>
      <p class="text-muted mb-4">The game code "{{ code }}" doesn't exist.</p>
      <UButton to="/">Back to Home</UButton>
    </div>

    <!-- Game view -->
    <template v-else>
      <!-- Header -->
      <header class="flex items-center justify-between p-4 border-b border-default">
        <div class="flex items-center gap-2">
          <RouterLink to="/" class="text-lg font-bold">Blokus Duo</RouterLink>
          <UBadge variant="subtle" color="neutral">{{ code }}</UBadge>
        </div>
        <UButton
          v-if="game.status === 'waiting'"
          variant="outline"
          size="sm"
          icon="i-lucide-copy"
          @click="copyLink"
        >
          Copy Link
        </UButton>
      </header>

      <!-- Waiting for opponent -->
      <div v-if="game.status === 'waiting'" class="flex-1 flex flex-col items-center justify-center p-4">
        <div class="text-center space-y-4">
          <UIcon name="i-lucide-users" class="w-12 h-12 mx-auto text-muted" />
          <h2 class="text-xl font-semibold">Waiting for opponent...</h2>
          <p class="text-muted">Share this link with a friend:</p>
          <div class="flex items-center gap-2 justify-center">
            <UInput :value="gameUrl" readonly class="w-64" />
            <UButton icon="i-lucide-copy" @click="copyLink" />
          </div>
        </div>
      </div>

      <!-- Game in progress or finished -->
      <template v-else>
        <!-- Game status bar -->
        <div class="px-4 py-2 border-b border-default">
          <div v-if="game.status === 'finished'" class="text-center">
            <span v-if="game.winner === 'draw'" class="font-semibold">Game Over - Draw!</span>
            <span v-else class="font-semibold">
              <span :class="game.winner === 'blue' ? 'text-blue-500' : 'text-orange-500'">
                {{ game.winner === myColor ? 'You win!' : 'You lose!' }}
              </span>
            </span>
          </div>
          <div v-else class="flex items-center justify-center gap-2">
            <div
              class="w-3 h-3 rounded-full"
              :class="game.currentTurn === 'blue' ? 'bg-blue-500' : 'bg-orange-500'"
            />
            <span>
              {{ isMyTurn ? "Your turn" : "Opponent's turn" }}
            </span>
          </div>
        </div>

        <!-- Main game area -->
        <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <!-- Desktop: Left sidebar - Your pieces -->
          <aside class="hidden lg:block w-48 border-r border-default overflow-y-auto p-2">
            <h3 class="text-sm font-semibold mb-2 px-2">Your Pieces</h3>
            <PieceTray
              :pieces="myPieces"
              :player-color="myColor || 'blue'"
              :selected-piece-id="selectedPieceId"
              :disabled="!isMyTurn"
              @select="selectPiece"
            />
          </aside>

          <!-- Board area -->
          <main class="flex-1 flex flex-col items-center justify-center p-2 overflow-auto">
            <BoardComponent
              :board="game.board as Board"
              :preview-cells="previewCells"
              :preview-color="myColor || 'blue'"
              :valid-anchors="selectedPieceId !== null ? validAnchorsForSelectedPiece : validAnchors"
              :show-anchors="isMyTurn && selectedPieceId !== null"
              @cell-click="handleBoardClick"
            />
          </main>

          <!-- Desktop: Right sidebar - Opponent pieces -->
          <aside class="hidden lg:block w-48 border-l border-default overflow-y-auto p-2">
            <h3 class="text-sm font-semibold mb-2 px-2">Opponent's Pieces</h3>
            <PieceTray
              :pieces="opponentPieces"
              :player-color="myColor === 'blue' ? 'orange' : 'blue'"
              :selected-piece-id="null"
              :disabled="true"
              @select="() => {}"
            />
          </aside>
        </div>

        <!-- Controls bar (bottom) -->
        <footer class="border-t border-default p-4">
          <div class="flex items-center justify-center gap-2 flex-wrap">
            <!-- Mobile: Select piece button -->
            <UButton
              v-if="isMyTurn && selectedPieceId === null"
              class="lg:hidden"
              @click="showPieceSheet = true"
            >
              Select Piece
            </UButton>

            <!-- Selected piece controls -->
            <template v-if="selectedPieceId !== null">
              <div class="flex items-center gap-1">
                <PieceMiniPreview
                  :piece-id="selectedPieceId"
                  :player-color="myColor || 'blue'"
                  :orientation-index="currentOrientationIndex"
                  class="w-10 h-10"
                />
              </div>
              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-rotate-ccw"
                  variant="outline"
                  size="sm"
                  title="Rotate (R)"
                  @click="rotatePiece('ccw')"
                />
                <UButton
                  icon="i-lucide-rotate-cw"
                  variant="outline"
                  size="sm"
                  title="Rotate (R)"
                  @click="rotatePiece('cw')"
                />
                <UButton
                  icon="i-lucide-flip-horizontal"
                  variant="outline"
                  size="sm"
                  title="Flip (F)"
                  @click="flipPieceAction"
                />
              </div>

              <!-- Confirm/Cancel when preview is active -->
              <template v-if="previewCells">
                <UButton color="primary" @click="confirmPlacement">
                  Confirm
                </UButton>
                <UButton variant="outline" @click="previewCells = null">
                  Cancel
                </UButton>
              </template>

              <!-- Change piece button -->
              <UButton
                v-if="!previewCells"
                variant="ghost"
                size="sm"
                class="lg:hidden"
                @click="showPieceSheet = true"
              >
                Change
              </UButton>
              <UButton
                v-if="!previewCells"
                variant="ghost"
                size="sm"
                @click="clearSelection"
              >
                Deselect
              </UButton>
            </template>

            <!-- Pass button -->
            <UButton
              v-if="canPass && !previewCells"
              variant="outline"
              color="warning"
              @click="passTurnAction"
            >
              Pass Turn
            </UButton>
          </div>
        </footer>
      </template>

      <!-- Mobile piece selection sheet -->
      <USlideover v-model:open="showPieceSheet" side="bottom" title="Select a Piece">
        <template #body>
          <div class="p-4">
            <PieceTray
              :pieces="myPieces"
              :player-color="myColor || 'blue'"
              :selected-piece-id="selectedPieceId"
              :disabled="!isMyTurn"
              horizontal
              @select="selectPiece"
            />
          </div>
        </template>
      </USlideover>
    </template>
  </div>
</template>
