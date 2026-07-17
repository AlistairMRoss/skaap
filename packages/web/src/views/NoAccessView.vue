<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function onSignOut(): Promise<void> {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
    <h1 class="text-xl font-semibold text-slate-900">Welcome to Skaap</h1>
    <p class="mt-2 text-slate-600">Please contact an admin to grant you access.</p>
    <button
      type="button"
      class="mt-6 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
      @click="onSignOut"
    >
      Sign out
    </button>
  </div>
</template>
