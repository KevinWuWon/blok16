<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConvexMutation, useConvexQuery } from "convex-vue"
import { api } from "../../convex/_generated/api"

const router = useRouter()
const isCreating = ref(false)
const showCreateDialog = ref(false)
const playerName = ref('')
const selectedColor = ref<'blue' | 'orange'>('blue')

// Get or create player ID
const playerId = ref<string>("")

onMounted(() => {
  let id = localStorage.getItem("blokus-player-id")
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem("blokus-player-id", id)
  }
  playerId.value = id
})

// Query for my active games
const { data: myGames } = useConvexQuery(
  api.games.getMyGames,
  () => ({ playerId: playerId.value || "" }),
)

const createGameMutation = useConvexMutation(api.games.createGame)

// Cookie helpers
function setCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

async function createGame() {
  if (!playerId.value || isCreating.value || !playerName.value.trim()) return

  isCreating.value = true
  try {
    const result = await createGameMutation.mutate({
      playerId: playerId.value,
      playerName: playerName.value.trim(),
      playerColor: selectedColor.value,
    })
    if (result?.code) {
      // Set cookies for the new game
      setCookie(`blokus-role-${result.code}`, selectedColor.value)
      setCookie(`blokus-name-${result.code}`, playerName.value.trim())
      router.push(`/game/${result.code}`)
    }
  } finally {
    isCreating.value = false
  }
}

function openCreateDialog() {
  showCreateDialog.value = true
}
</script>

<template>
  <div class="h-dvh flex flex-col items-center justify-center p-4">
    <div class="text-center space-y-8">
      <div>
        <h1 class="text-4xl font-bold mb-2">
          Blokus Duo
        </h1>
        <p class="text-muted">
          Play online with a friend
        </p>
      </div>

      <UButton
        size="xl"
        :disabled="!playerId"
        @click="openCreateDialog"
      >
        Create Game
      </UButton>

      <div class="text-sm text-muted">
        <p>Create a game and share the link with a friend to play.</p>
      </div>

      <!-- My Active Games -->
      <div v-if="myGames && myGames.length > 0" class="w-full max-w-sm">
        <h2 class="text-lg font-semibold mb-3 text-left">My Games</h2>
        <ul class="space-y-2">
          <li v-for="game in myGames" :key="game.code">
            <RouterLink
              :to="`/game/${game.code}`"
              class="block p-3 rounded-lg border border-default hover:bg-muted/50 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div
                    class="w-3 h-3 rounded-full"
                    :class="game.myColor === 'blue' ? 'bg-blue-500' : 'bg-orange-500'"
                  />
                  <span class="font-medium">{{ game.opponentName || 'Waiting for opponent...' }}</span>
                </div>
                <span
                  v-if="game.status === 'playing'"
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="game.isMyTurn ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
                >
                  {{ game.isMyTurn ? 'Your turn' : 'Their turn' }}
                </span>
                <span
                  v-else
                  class="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                >
                  Waiting
                </span>
              </div>
              <div class="text-sm text-muted mt-1 text-left font-mono">
                {{ game.code }}
              </div>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <!-- Create Game Dialog -->
    <UModal
      v-model:open="showCreateDialog"
      title="Create New Game"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField label="Your Name">
            <UInput
              v-model="playerName"
              placeholder="Enter your name"
              autofocus
            />
          </UFormField>

          <UFormField label="Choose Your Color">
            <div class="flex gap-3 mt-2">
              <button
                class="flex-1 p-4 rounded-lg border-2 transition-colors"
                :class="selectedColor === 'blue'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-default hover:border-blue-300'"
                @click="selectedColor = 'blue'"
              >
                <div class="flex items-center justify-center gap-2">
                  <div class="w-4 h-4 rounded-full bg-blue-500" />
                  <span class="font-medium">Blue</span>
                </div>
              </button>
              <button
                class="flex-1 p-4 rounded-lg border-2 transition-colors"
                :class="selectedColor === 'orange'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                  : 'border-default hover:border-orange-300'"
                @click="selectedColor = 'orange'"
              >
                <div class="flex items-center justify-center gap-2">
                  <div class="w-4 h-4 rounded-full bg-orange-500" />
                  <span class="font-medium">Orange</span>
                </div>
              </button>
            </div>
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            @click="showCreateDialog = false"
          >
            Cancel
          </UButton>
          <UButton
            :loading="isCreating"
            :disabled="!playerName.trim()"
            @click="createGame"
          >
            Create Game
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
