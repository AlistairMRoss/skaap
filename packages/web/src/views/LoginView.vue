<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function onLogin(): Promise<void> {
  error.value = null
  busy.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    if (!auth.isAdmin) {
      await router.push({ name: 'no-access' })
      return
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    await router.push(redirect ?? { name: 'animals' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not sign in.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto mt-12 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h1 class="text-center text-2xl font-semibold text-slate-900">Skaap</h1>
    <p class="mt-1 text-center text-slate-500">Sign in to manage your flock</p>

    <form class="mt-6 space-y-4" @submit.prevent="onLogin">
      <div>
        <label for="email" class="block text-sm font-medium text-slate-700">Email address</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          placeholder="farmer@example.com"
          class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
        />
      </div>
      <div>
        <label for="password" class="block text-sm font-medium text-slate-700">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          placeholder="Your password"
          class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        :disabled="busy || email.trim().length === 0 || password.length === 0"
        class="min-h-12 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
      >
        {{ busy ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <p v-if="error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

    <p class="mt-6 text-center text-sm text-slate-500">
      No account yet?
      <RouterLink :to="{ name: 'signup' }" class="font-medium text-green-700 hover:text-green-800">
        Create one
      </RouterLink>
    </p>
  </div>
</template>
