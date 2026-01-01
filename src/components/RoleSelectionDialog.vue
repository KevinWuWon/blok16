<script setup lang="ts">
import { ref, computed } from 'vue'

type Player = string | { id: string; name: string }

const props = defineProps<{
  open: boolean
  bluePlayer?: Player
  orangePlayer?: Player
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'select', role: 'blue' | 'orange' | 'spectator', name?: string): void
}>()

const selectedRole = ref<'blue' | 'orange' | 'spectator' | null>(null)
const playerName = ref('')
const step = ref<'role' | 'name'>('role')

// Helper to get player name from legacy or new format
function getPlayerName(player?: Player): string | null {
  if (!player) return null
  if (typeof player === 'string') return 'Anonymous'
  return player.name
}

const blueName = computed(() => getPlayerName(props.bluePlayer))
const orangeName = computed(() => getPlayerName(props.orangePlayer))

function selectRole(role: 'blue' | 'orange' | 'spectator') {
  selectedRole.value = role
  if (role === 'spectator') {
    emit('select', role)
    emit('update:open', false)
  } else {
    step.value = 'name'
  }
}

function confirmName() {
  if (selectedRole.value && selectedRole.value !== 'spectator' && playerName.value.trim()) {
    emit('select', selectedRole.value, playerName.value.trim())
    emit('update:open', false)
  }
}

function goBack() {
  step.value = 'role'
  selectedRole.value = null
}

function handleClose() {
  emit('update:open', false)
  // Reset state
  step.value = 'role'
  selectedRole.value = null
  playerName.value = ''
}
</script>

<template>
  <UModal
    :open="open"
    title="Join Game"
    @update:open="handleClose"
  >
    <template #body>
      <!-- Role Selection Step -->
      <div
        v-if="step === 'role'"
        class="space-y-3"
      >
        <p class="text-sm text-muted mb-4">
          Choose how you want to participate:
        </p>

        <!-- Blue Player Option -->
        <button
          class="w-full p-4 rounded-lg border-2 text-left transition-colors"
          :class="[
            blueName
              ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800'
              : 'border-default hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
          ]"
          @click="selectRole('blue')"
        >
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 rounded-full bg-blue-500" />
            <div>
              <div class="font-medium">
                Blue Player
              </div>
              <div class="text-sm text-muted">
                {{ blueName || 'Available' }}
              </div>
            </div>
          </div>
        </button>

        <!-- Orange Player Option -->
        <button
          class="w-full p-4 rounded-lg border-2 text-left transition-colors"
          :class="[
            orangeName
              ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800'
              : 'border-default hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30'
          ]"
          @click="selectRole('orange')"
        >
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 rounded-full bg-orange-500" />
            <div>
              <div class="font-medium">
                Orange Player
              </div>
              <div class="text-sm text-muted">
                {{ orangeName || 'Available' }}
              </div>
            </div>
          </div>
        </button>

        <!-- Spectator Option -->
        <button
          class="w-full p-4 rounded-lg border-2 border-default text-left transition-colors hover:border-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"
          @click="selectRole('spectator')"
        >
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-eye"
              class="w-4 h-4 text-muted"
            />
            <div>
              <div class="font-medium">
                Spectator
              </div>
              <div class="text-sm text-muted">
                Watch the game
              </div>
            </div>
          </div>
        </button>
      </div>

      <!-- Name Entry Step -->
      <div
        v-else
        class="space-y-4"
      >
        <button
          class="flex items-center gap-1 text-sm text-muted hover:text-default"
          @click="goBack"
        >
          <UIcon name="i-lucide-arrow-left" />
          Back
        </button>

        <div class="flex items-center gap-2">
          <div
            class="w-4 h-4 rounded-full"
            :class="selectedRole === 'blue' ? 'bg-blue-500' : 'bg-orange-500'"
          />
          <span class="font-medium">
            Playing as {{ selectedRole === 'blue' ? 'Blue' : 'Orange' }}
          </span>
        </div>

        <UFormField label="Your Name">
          <UInput
            v-model="playerName"
            size="xl"
            placeholder="Enter your name"
            autofocus
            @keyup.enter="confirmName"
          />
        </UFormField>

        <UButton
          size="xl"
          block
          :disabled="!playerName.trim()"
          @click="confirmName"
        >
          Join Game
        </UButton>
      </div>
    </template>
  </UModal>
</template>
