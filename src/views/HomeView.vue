<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConvexMutation } from "convex-vue"
import { api } from "../../convex/_generated/api"

const router = useRouter()
const isCreating = ref(false)

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

const createGameMutation = useConvexMutation(api.games.createGame)

async function createGame() {
  if (!playerId.value || isCreating.value) return

  isCreating.value = true
  try {
    const result = await createGameMutation.mutate({ playerId: playerId.value })
    if (result?.code) {
      router.push(`/game/${result.code}`)
    }
  } finally {
    isCreating.value = false
  }
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
        :loading="isCreating"
        :disabled="!playerId"
        @click="createGame"
      >
        Create Game
      </UButton>

      <div class="text-sm text-muted">
        <p>Create a game and share the link with a friend to play.</p>
      </div>
    </div>
  </div>
</template>
