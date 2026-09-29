import type { AuthUser } from './authClient'

export interface LastUser {
  userId: string
  email?: string
}

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORAGE_KEY = 'sheep.lastUser'

export function browserStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function rememberUser(store: KeyValueStore | null, user: AuthUser): void {
  if (!store) return
  const hint: LastUser = user.email ? { userId: user.userId, email: user.email } : { userId: user.userId }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(hint))
  } catch {
    return
  }
}

export function recallUser(store: KeyValueStore | null): LastUser | null {
  if (!store) return null
  let raw: string | null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    return toLastUser(JSON.parse(raw))
  } catch {
    return null
  }
}

export function forgetUser(store: KeyValueStore | null): void {
  if (!store) return
  try {
    store.removeItem(STORAGE_KEY)
  } catch {
    return
  }
}

function toLastUser(value: unknown): LastUser | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.userId !== 'string' || record.userId.length === 0) return null
  return typeof record.email === 'string'
    ? { userId: record.userId, email: record.email }
    : { userId: record.userId }
}
