import { get, set, del } from 'idb-keyval'

const DB_PREFIX = 'blokli-'

export async function getStoredValue(key: string): Promise<string | null> {
  try {
    const value = await get(DB_PREFIX + key)
    return value ?? null
  } catch {
    // Fallback to localStorage if IndexedDB fails
    return localStorage.getItem(DB_PREFIX + key)
  }
}

export async function setStoredValue(key: string, value: string): Promise<void> {
  try {
    await set(DB_PREFIX + key, value)
  } catch {
    // Fallback to localStorage if IndexedDB fails
    localStorage.setItem(DB_PREFIX + key, value)
  }
}

export async function deleteStoredValue(key: string): Promise<void> {
  try {
    await del(DB_PREFIX + key)
  } catch {
    // Fallback to localStorage if IndexedDB fails
    localStorage.removeItem(DB_PREFIX + key)
  }
}

// Sync version for initial load (reads from localStorage as fallback during async load)
export function getStoredValueSync(key: string): string | null {
  return localStorage.getItem(DB_PREFIX + key)
}

// Initialize: migrate any existing localStorage/cookie data to IndexedDB
export async function initStorage(): Promise<void> {
  // Migrate player-id if it exists in localStorage
  const playerId = localStorage.getItem('blokli-player-id')
  if (playerId) {
    await setStoredValue('player-id', playerId)
  }
}
