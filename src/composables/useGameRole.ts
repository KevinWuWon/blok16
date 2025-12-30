import { ref, computed } from 'vue'

export type GameRole = "blue" | "orange" | "spectator"

// Cookie helpers
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

export function useGameRole(gameCode: string) {
  const role = ref<GameRole | null>(null)
  const playerName = ref<string | null>(null)

  const roleKey = computed(() => `blokus-role-${gameCode}`)
  const nameKey = computed(() => `blokus-name-${gameCode}`)

  function loadFromCookies() {
    const savedRole = getCookie(roleKey.value)
    const savedName = getCookie(nameKey.value)

    if (savedRole === "blue" || savedRole === "orange" || savedRole === "spectator") {
      role.value = savedRole
    } else {
      role.value = null
    }

    playerName.value = savedName
  }

  function setRole(newRole: GameRole, name?: string) {
    role.value = newRole
    setCookie(roleKey.value, newRole)

    if (name) {
      playerName.value = name
      setCookie(nameKey.value, name)
    }
  }

  function clearRole() {
    role.value = null
    playerName.value = null
    deleteCookie(roleKey.value)
    deleteCookie(nameKey.value)
  }

  // Computed helpers
  const isPlayer = computed(() => role.value === "blue" || role.value === "orange")
  const isSpectator = computed(() => role.value === "spectator")
  const hasRole = computed(() => role.value !== null)

  // Load on creation
  loadFromCookies()

  return {
    role,
    playerName,
    isPlayer,
    isSpectator,
    hasRole,
    loadFromCookies,
    setRole,
    clearRole,
  }
}
