<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const router = useRouter()

const showChrome = computed(() => auth.isAuthenticated && auth.isAdmin)

async function onLogout(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen">
    <header v-if="showChrome" class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <RouterLink :to="{ name: 'animals' }" class="text-lg font-bold tracking-tight text-brand-700">Skaap</RouterLink>
        <button
          type="button"
          class="min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          @click="onLogout"
        >
          Sign out
        </button>
      </div>
    </header>
    <main class="mx-auto max-w-3xl px-4 py-5">
      <RouterView />
    </main>
  </div>
</template>
