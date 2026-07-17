import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authClient, type AuthUser } from '../lib/authClient'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => accessToken.value !== null && user.value !== null)
  const isAdmin = computed(() => (user.value?.roles ?? []).includes('admin'))

  async function refresh(): Promise<boolean> {
    try {
      const result = await authClient.refresh()
      accessToken.value = result.accessToken
      if (!user.value) {
        user.value = await authClient.me(result.accessToken)
      }
      return true
    } catch {
      accessToken.value = null
      user.value = null
      return false
    }
  }

  async function init(): Promise<void> {
    await refresh()
    ready.value = true
  }

  async function login(email: string, password: string): Promise<void> {
    const result = await authClient.login(email, password)
    accessToken.value = result.accessToken
    user.value = result.user
  }

  async function logout(): Promise<void> {
    const token = accessToken.value
    accessToken.value = null
    user.value = null
    if (token) {
      try {
        await authClient.logout(token)
      } catch (err) {
        console.warn('Logout request failed', err)
      }
    }
  }

  return { accessToken, user, ready, isAuthenticated, isAdmin, refresh, init, login, logout }
})
