<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const PASSWORD_MIN_LENGTH = 8

const step = ref<'details' | 'code'>('details')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const code = ref('')
const message = ref<string | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)

const detailsValid = computed(
  () =>
    email.value.trim().length > 0 &&
    password.value.length >= PASSWORD_MIN_LENGTH &&
    password.value === confirmPassword.value
)

async function onSendCode(): Promise<void> {
  error.value = null
  message.value = null
  if (password.value.length < PASSWORD_MIN_LENGTH) {
    error.value = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  busy.value = true
  try {
    await auth.sendCode(email.value.trim())
    step.value = 'code'
    message.value = `We sent a 6-digit code to ${email.value.trim()}.`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send the code.'
  } finally {
    busy.value = false
  }
}

async function onVerify(): Promise<void> {
  error.value = null
  busy.value = true
  try {
    await auth.completeSignup(email.value.trim(), code.value.trim(), password.value)
    await router.push(auth.isAdmin ? { name: 'animals' } : { name: 'no-access' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not create your account.'
  } finally {
    busy.value = false
  }
}

function restart(): void {
  step.value = 'details'
  code.value = ''
  message.value = null
  error.value = null
}
</script>

<template>
  <div class="mx-auto mt-12 max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h1 class="text-center text-2xl font-semibold text-slate-900">Create your account</h1>
    <p class="mt-1 text-center text-slate-500">We'll email you a code to confirm it's you</p>

    <form v-if="step === 'details'" class="mt-6 space-y-4" @submit.prevent="onSendCode">
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
          autocomplete="new-password"
          required
          placeholder="At least 8 characters"
          class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
        />
      </div>
      <div>
        <label for="confirm" class="block text-sm font-medium text-slate-700">Confirm password</label>
        <input
          id="confirm"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          placeholder="Re-enter your password"
          class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        :disabled="busy || !detailsValid"
        class="min-h-12 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
      >
        {{ busy ? 'Sending…' : 'Send me a code' }}
      </button>
    </form>

    <form v-else class="mt-6 space-y-4" @submit.prevent="onVerify">
      <div>
        <label for="code" class="block text-sm font-medium text-slate-700">6-digit code</label>
        <input
          id="code"
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          required
          placeholder="123456"
          class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-green-600 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        :disabled="busy || code.trim().length === 0"
        class="min-h-12 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
      >
        {{ busy ? 'Creating account…' : 'Confirm and create account' }}
      </button>
      <button
        type="button"
        class="min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
        @click="restart"
      >
        Change details
      </button>
    </form>

    <p v-if="message" class="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{{ message }}</p>
    <p v-if="error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

    <p class="mt-6 text-center text-sm text-slate-500">
      Already have an account?
      <RouterLink :to="{ name: 'login' }" class="font-medium text-green-700 hover:text-green-800">
        Sign in
      </RouterLink>
    </p>
  </div>
</template>
