<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useConvexQuery, useConvexMutation } from "convex-vue"
import { api } from "../../convex/_generated/api"
import {
  findCornerAnchors,
  findValidPlacementsAtAnchor,
  getNextValidOrientation,
  getFlippedOrientation,
  hasValidMoves,
  getValidAnchorsForPiece,
  type PlayerColor,
  type Board,
} from "../../lib/validation"
import { PIECES, normalize, flipH } from "../../lib/pieces"
import BoardComponent from '@/components/Board.vue'
import PieceTray from '@/components/PieceTray.vue'
import PieceMiniPreview from '@/components/PieceMiniPreview.vue'
import RoleSelectionDialog from '@/components/RoleSelectionDialog.vue'
import TakeoverConfirmDialog from '@/components/TakeoverConfirmDialog.vue'
import { useGameRole, type GameRole } from '@/composables/useGameRole'
import { usePieceDrag } from '@/composables/usePieceDrag'

type Player = string | { id: string; name: string }

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

// Game role from cookies
const gameRole = computed(() => useGameRole(code.value))
const role = computed(() => gameRole.value.role.value)
const roleName = computed(() => gameRole.value.playerName.value)

// Convex query for game state
const { data: game, isPending: isLoading } = useConvexQuery(api.games.getGame, () => ({
  code: code.value,
}))

// Mutations
const claimColorMutation = useConvexMutation(api.games.claimColor)
const placePieceMutation = useConvexMutation(api.games.placePiece)
const passTurnMutation = useConvexMutation(api.games.passTurn)

// Local game state
const selectedPieceId = ref<number | null>(null)
const previewCells = ref<[number, number][] | null>(null)
const currentOrientationIndex = ref(0)
const showPieceSheet = ref(false)

// Board component ref for drag and drop
const boardComponentRef = ref<InstanceType<typeof BoardComponent> | null>(null)
// Note: defineExpose unwraps refs, so boardRef is the element directly
const boardElement = computed(() => boardComponentRef.value?.boardRef ?? null)

// Game flow state machine
type GameFlowState = 'loading' | 'selecting' | 'claiming' | 'confirming' | 'ready'
const flowState = ref<GameFlowState>('loading')

// Dialog state
const takeoverColor = ref<'blue' | 'orange'>('blue')
const takeoverPlayerName = ref('')
const pendingRoleSelection = ref<{ role: 'blue' | 'orange'; name: string } | null>(null)

// Helper to get player name from legacy or new format
function getPlayerName(player?: Player): string | null {
  if (!player) return null
  if (typeof player === 'string') return 'Anonymous'
  return player.name
}

// Computed values
const myColor = computed<PlayerColor | null>(() => {
  if (role.value === 'blue') return 'blue'
  if (role.value === 'orange') return 'orange'
  return null
})

const isSpectator = computed(() => role.value === 'spectator')

const isMyTurn = computed(() => {
  if (isSpectator.value) return false
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

// Drag and drop composable
const gameBoard = computed(() => (game.value?.board as Board) ?? [])
const {
  isDragging,
  startDrag,
} = usePieceDrag(
  boardElement,
  gameBoard,
  selectedPieceId,
  currentOrientationIndex,
  validAnchorsForSelectedPiece,
  myColor,
  previewCells,
  (cells) => { previewCells.value = cells }
)

const canPass = computed(() => {
  if (!game.value || !myColor.value || !isMyTurn.value) return false
  return !hasValidMoves(game.value.board as Board, myPieces.value, myColor.value)
})

const blueName = computed(() => getPlayerName(game.value?.players.blue))
const orangeName = computed(() => getPlayerName(game.value?.players.orange))

const opponentName = computed(() => {
  if (!myColor.value) return 'Opponent'
  const name = myColor.value === 'blue' ? orangeName.value : blueName.value
  return name || 'Opponent'
})

const blueDisplayName = computed(() => blueName.value || 'Blue')
const orangeDisplayName = computed(() => orangeName.value || 'Orange')

const turnLabel = computed(() => {
  if (!game.value) return ''
  return isMyTurn.value ? 'Your turn' : 'Their turn'
})

const gameUrl = computed(() => {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/game/${code.value}`
})

// Manage flow state transitions
watch([game, role, isLoading], () => {
  if (isLoading.value || !game.value) {
    flowState.value = 'loading'
    return
  }

  if (role.value !== null) {
    flowState.value = 'ready'
    return
  }

  // Only trigger 'selecting' if we aren't already in a transition state
  if (flowState.value === 'loading' || flowState.value === 'ready') {
    flowState.value = 'selecting'
  }
}, { immediate: true })

// Handle role selection
async function handleRoleSelect(selectedRole: 'blue' | 'orange' | 'spectator', name?: string) {
  if (selectedRole === 'spectator') {
    flowState.value = 'claiming'
    gameRole.value.setRole('spectator')
    flowState.value = 'ready'
    return
  }

  if (!name) return

  flowState.value = 'claiming'
  const result = await claimColorMutation.mutate({
    code: code.value,
    playerId: playerId.value,
    playerName: name,
    color: selectedRole,
  })

  if (result?.success) {
    gameRole.value.setRole(selectedRole, name)
    flowState.value = 'ready'
  } else if (result?.requiresConfirmation) {
    // Need takeover confirmation
    pendingRoleSelection.value = { role: selectedRole, name }
    takeoverColor.value = selectedRole
    takeoverPlayerName.value = result.currentPlayerName || 'Anonymous'
    flowState.value = 'confirming'
  } else {
    // If error, go back to selecting
    flowState.value = 'selecting'
  }
}

async function handleTakeoverConfirm() {
  if (!pendingRoleSelection.value) return

  flowState.value = 'claiming'
  const result = await claimColorMutation.mutate({
    code: code.value,
    playerId: playerId.value,
    playerName: pendingRoleSelection.value.name,
    color: pendingRoleSelection.value.role,
    forceTakeover: true,
  })

  if (result?.success) {
    gameRole.value.setRole(pendingRoleSelection.value.role, pendingRoleSelection.value.name)
    flowState.value = 'ready'
  } else {
    flowState.value = 'selecting'
  }

  pendingRoleSelection.value = null
}

function handleTakeoverCancel() {
  pendingRoleSelection.value = null
  flowState.value = 'selecting'
}

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
  if (isDragging.value) return // Don't recompute when starting a drag

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
    const flippedCells = getFlippedOrientation(
      game.value.board as Board,
      previewCells.value,
      myColor.value
    )
    if (flippedCells) {
      previewCells.value = flippedCells
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
  <div class="h-dvh flex flex-col overflow-hidden">
    <!-- Loading state -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-8 h-8 animate-spin"
      />
    </div>

    <!-- Game not found -->
    <div
      v-else-if="!game"
      class="flex-1 flex flex-col items-center justify-center p-4"
    >
      <h1 class="text-2xl font-bold mb-4">
        Game Not Found
      </h1>
      <p class="text-muted mb-4">
        The game code "{{ code }}" doesn't exist.
      </p>
      <UButton to="/">
        Back to Home
      </UButton>
    </div>

    <!-- Game view -->
    <template v-else>
      <!-- Header -->
      <header class="flex items-center justify-between px-4 py-2 border-b border-default shrink-0">
        <div class="flex items-center gap-2">
          <RouterLink
            to="/"
            class="text-lg font-bold"
          >
            Blokus Duo
          </RouterLink>
          <UBadge
            variant="subtle"
            color="neutral"
          >
            {{ code }}
          </UBadge>
        </div>
        <!-- Game status in header -->
        <div class="flex items-center gap-2">
          <template v-if="game.status === 'waiting'">
            <UButton
              variant="outline"
              size="sm"
              icon="i-lucide-copy"
              @click="copyLink"
            >
              Copy Link
            </UButton>
          </template>
          <template v-else />
        </div>
      </header>

      <!-- Waiting for opponent -->
      <div
        v-if="game.status === 'waiting'"
        class="flex-1 flex flex-col items-center justify-center p-4"
      >
        <div class="text-center space-y-4">
          <UIcon
            name="i-lucide-users"
            class="w-12 h-12 mx-auto text-muted"
          />
          <h2 class="text-xl font-semibold">
            Waiting for opponent...
          </h2>
          <p class="text-muted">
            Share this link with a friend:
          </p>
          <div class="flex items-center gap-2 justify-center">
            <UInput
              :value="gameUrl"
              readonly
              class="w-64"
            />
            <UButton
              icon="i-lucide-copy"
              @click="copyLink"
            />
          </div>
        </div>
      </div>

      <!-- Game in progress or finished -->
      <template v-else>
        <!-- Main game area -->
        <div class="flex-1 flex flex-col md:flex-row md:overflow-hidden md:min-h-0">
          <!-- Desktop: Left sidebar - Your pieces (visible at md+) -->
          <aside class="hidden md:flex md:flex-col flex-1 min-w-48 border-r border-default">
            <h3 class="text-sm font-semibold py-2 px-3 border-b border-default shrink-0">
              Your Pieces
            </h3>
            <div class="flex-1 overflow-y-auto p-2">
              <PieceTray
                :pieces="myPieces"
                :player-color="myColor || 'blue'"
                :selected-piece-id="selectedPieceId"
                :disabled="!isMyTurn"
                horizontal
                @select="selectPiece"
              />
            </div>
          </aside>

          <!-- Board area -->
          <main class="shrink-0 flex flex-col items-center justify-center p-4 overflow-auto">
            <!-- Game status / Turn indicator -->
            <div class="mb-8">
              <template v-if="game.status === 'finished'">
                <div class="text-2xl font-bold text-center">
                  <span
                    v-if="game.winner === 'draw'"
                    class="text-muted"
                  >Draw!</span>
                  <span
                    v-else
                    :class="game.winner === 'blue' ? 'text-blue-500' : 'text-orange-500'"
                  >
                    {{ game.winner === myColor ? 'You win!' : 'You lose!' }}
                  </span>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-6">
                  <!-- Blue Player -->
                  <div
                    class="relative px-4 py-2 border-2 rounded-xl min-w-[140px] text-center transition-all duration-300"
                    :class="game.currentTurn === 'blue' ? 'border-blue-500' : 'border-transparent opacity-50'"
                  >
                    <span
                      v-if="game.currentTurn === 'blue'"
                      class="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-neutral-900 text-[10px] uppercase font-black tracking-wider text-blue-500 whitespace-nowrap"
                    >
                      {{ turnLabel }}
                    </span>
                    <span
                      class="font-bold text-lg"
                      :class="game.currentTurn === 'blue' ? 'text-blue-600 dark:text-blue-400' : 'text-blue-500'"
                    >{{ blueDisplayName }}</span>
                  </div>

                  <!-- Orange Player -->
                  <div
                    class="relative px-4 py-2 border-2 rounded-xl min-w-[140px] text-center transition-all duration-300"
                    :class="game.currentTurn === 'orange' ? 'border-orange-500' : 'border-transparent opacity-50'"
                  >
                    <span
                      v-if="game.currentTurn === 'orange'"
                      class="absolute -top-3 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-neutral-900 text-[10px] uppercase font-black tracking-wider text-orange-500 whitespace-nowrap"
                    >
                      {{ turnLabel }}
                    </span>
                    <span
                      class="font-bold text-lg"
                      :class="game.currentTurn === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-orange-500'"
                    >{{ orangeDisplayName }}</span>
                  </div>
                </div>
              </template>
            </div>

            <BoardComponent
              ref="boardComponentRef"
              :board="game.board as Board"
              :preview-cells="previewCells"
              :preview-color="myColor || 'blue'"
              :valid-anchors="selectedPieceId !== null ? validAnchorsForSelectedPiece : validAnchors"
              :show-anchors="isMyTurn && selectedPieceId !== null"
              :is-dragging="isDragging"
              @cell-click="handleBoardClick"
              @drag-start="startDrag"
            />
          </main>

          <!-- Desktop: Right sidebar - Opponent pieces (visible at lg+ only) -->
          <aside class="hidden lg:flex lg:flex-col flex-1 min-w-48 border-l border-default">
            <h3 class="text-sm font-semibold py-2 px-3 border-b border-default shrink-0">
              {{ opponentName }}'s Pieces
            </h3>
            <div class="flex-1 overflow-y-auto p-2">
              <PieceTray
                :pieces="opponentPieces"
                :player-color="myColor === 'blue' ? 'orange' : 'blue'"
                :selected-piece-id="null"
                :disabled="true"
                horizontal
                @select="() => {}"
              />
            </div>
          </aside>
        </div>

        <!-- Controls bar (bottom) -->
        <footer class="border-t border-default p-4 lg:py-2 shrink-0">
          <div class="flex items-center justify-center gap-2 flex-wrap">
            <!-- Mobile: Select piece button -->
            <UButton
              v-if="isMyTurn && selectedPieceId === null"
              class="md:hidden"
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
                <UButton
                  color="primary"
                  @click="confirmPlacement"
                >
                  Confirm
                </UButton>
                <UButton
                  variant="outline"
                  @click="previewCells = null"
                >
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
      <USlideover
        v-model:open="showPieceSheet"
        side="bottom"
        title="Select a Piece"
      >
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

      <!-- Role selection dialog -->
      <RoleSelectionDialog
        :open="flowState === 'selecting'"
        :blue-player="game?.players.blue"
        :orange-player="game?.players.orange"
        @update:open="(val) => !val && (flowState = 'ready')"
        @select="handleRoleSelect"
      />

      <!-- Takeover confirmation dialog -->
      <TakeoverConfirmDialog
        :open="flowState === 'confirming'"
        :current-player-name="takeoverPlayerName"
        :color="takeoverColor"
        @confirm="handleTakeoverConfirm"
        @cancel="handleTakeoverCancel"
      />
    </template>
  </div>
</template>
