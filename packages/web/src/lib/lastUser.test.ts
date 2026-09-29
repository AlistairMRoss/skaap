import { describe, expect, it } from 'vitest'
import type { AuthUser } from './authClient'
import { forgetUser, recallUser, rememberUser, type KeyValueStore } from './lastUser'

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    }
  }
}

function throwingStore(): KeyValueStore {
  const fail = (): never => {
    throw new Error('storage disabled')
  }
  return { getItem: fail, setItem: fail, removeItem: fail }
}

const USER: AuthUser = {
  userId: 'u_8821',
  email: 'jo@acme.io',
  roles: ['admin'],
  status: 'active'
}

describe('lastUser', () => {
  it('remembers only the user id and email', () => {
    const store = memoryStore()
    rememberUser(store, USER)
    expect(recallUser(store)).toEqual({ userId: 'u_8821', email: 'jo@acme.io' })
    expect([...store.data.values()].join('')).not.toContain('admin')
  })

  it('omits the email when the user has none', () => {
    const store = memoryStore()
    rememberUser(store, { ...USER, email: undefined })
    expect(recallUser(store)).toEqual({ userId: 'u_8821' })
  })

  it('forgets the user on logout', () => {
    const store = memoryStore()
    rememberUser(store, USER)
    forgetUser(store)
    expect(recallUser(store)).toBeNull()
  })

  it('returns null for missing, corrupt or malformed entries', () => {
    const store = memoryStore()
    expect(recallUser(store)).toBeNull()
    store.setItem('sheep.lastUser', '{not json')
    expect(recallUser(store)).toBeNull()
    store.setItem('sheep.lastUser', JSON.stringify({ userId: 42 }))
    expect(recallUser(store)).toBeNull()
    store.setItem('sheep.lastUser', JSON.stringify({ userId: '' }))
    expect(recallUser(store)).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    const store = throwingStore()
    expect(() => rememberUser(store, USER)).not.toThrow()
    expect(recallUser(store)).toBeNull()
    expect(() => forgetUser(store)).not.toThrow()
    expect(recallUser(null)).toBeNull()
  })
})
