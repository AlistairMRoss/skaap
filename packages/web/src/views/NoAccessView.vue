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
  <div class="mx-auto mt-16 max-w-md card p-6 text-center">
    <h1 class="text-xl font-semibold text-slate-900">Welcome to Skaap</h1>
    <p class="mt-2 text-slate-600">Please contact an admin to grant you access.</p>
    <button type="button" class="btn-secondary mt-6 w-full" @click="onSignOut">Sign out</button>
  </div>
</template>
