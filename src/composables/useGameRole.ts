import { ref, computed } from 'vue'
import { getStoredValue, setStoredValue, deleteStoredValue, getStoredValueSync } from './useStorage'

export type GameRole = "blue" | "orange" | "spectator"

export function useGameRole(gameCode: string) {
  const role = ref<GameRole | null>(null)
  const playerName = ref<string | null>(null)
  const isLoading = ref(true)

  const roleKey = computed(() => `role-${gameCode}`)
  const nameKey = computed(() => `name-${gameCode}`)

  // Sync load for immediate display (from localStorage fallback)
  function loadFromStorageSync() {
    const savedRole = getStoredValueSync(roleKey.value)
    const savedName = getStoredValueSync(nameKey.value)

    if (savedRole === "blue" || savedRole === "orange" || savedRole === "spectator") {
      role.value = savedRole
    } else {
      role.value = null
    }

    playerName.value = savedName
  }

  // Async load from IndexedDB (more reliable)
  async function loadFromStorage() {
    isLoading.value = true
    try {
      const savedRole = await getStoredValue(roleKey.value)
      const savedName = await getStoredValue(nameKey.value)

      if (savedRole === "blue" || savedRole === "orange" || savedRole === "spectator") {
        role.value = savedRole
      } else {
        role.value = null
      }

      playerName.value = savedName
    } finally {
      isLoading.value = false
    }
  }

  async function setRole(newRole: GameRole, name?: string) {
    role.value = newRole
    await setStoredValue(roleKey.value, newRole)

    if (name) {
      playerName.value = name
      await setStoredValue(nameKey.value, name)
    }
  }

  async function clearRole() {
    role.value = null
    playerName.value = null
    await deleteStoredValue(roleKey.value)
    await deleteStoredValue(nameKey.value)
  }

  // Computed helpers
  const isPlayer = computed(() => role.value === "blue" || role.value === "orange")
  const isSpectator = computed(() => role.value === "spectator")
  const hasRole = computed(() => role.value !== null)

  // Load sync first for immediate display, then async for accuracy
  loadFromStorageSync()
  loadFromStorage()

  return {
    role,
    playerName,
    isLoading,
    isPlayer,
    isSpectator,
    hasRole,
    loadFromStorage,
    setRole,
    clearRole,
  }
}
