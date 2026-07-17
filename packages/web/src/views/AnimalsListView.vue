<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import type { AnimalListItem, Status } from '@sheep/core'
import { STATUSES } from '@sheep/core'
import { useAnimalsStore } from '../stores/animals'
import { animalsApi } from '../lib/animalsApi'
import { ApiError } from '../lib/api'
import { downloadAnimalsXlsx } from '../lib/export'
import { SEX_LABELS, STATUS_LABELS, statusBadgeClass, todayIso } from '../lib/display'

const store = useAnimalsStore()
const router = useRouter()
const { filtered, loading, error, search, status } = storeToRefs(store)

const statusOptions = STATUSES

const pendingDelete = ref<AnimalListItem | null>(null)
const deleteError = ref<string | null>(null)
const deleting = ref(false)
const exporting = ref(false)

const canExport = computed(() => filtered.value.length > 0)

onMounted(() => {
  void store.load()
})

function openDelete(animal: AnimalListItem): void {
  deleteError.value = null
  pendingDelete.value = animal
}

function closeDelete(): void {
  pendingDelete.value = null
  deleteError.value = null
}

async function confirmDelete(): Promise<void> {
  if (!pendingDelete.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await animalsApi.remove(pendingDelete.value.id)
    closeDelete()
    await store.load()
  } catch (err) {
    deleteError.value = err instanceof ApiError ? err.message : 'Could not delete this animal.'
  } finally {
    deleting.value = false
  }
}

async function onExport(): Promise<void> {
  if (!canExport.value || exporting.value) return
  exporting.value = true
  try {
    const activeStatus: Status | undefined = status.value === '' ? undefined : status.value
    await downloadAnimalsXlsx(
      filtered.value,
      { status: activeStatus, q: search.value.trim() || undefined },
      todayIso()
    )
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-slate-900">Flock</h1>
      <RouterLink :to="{ name: 'animal-new' }" class="btn-primary">+ Add</RouterLink>
    </div>

    <div class="mt-4 space-y-3">
      <input
        v-model="search"
        type="search"
        placeholder="Search by tag, colour, breed, notes…"
        class="input-field"
      />
      <div class="flex flex-col gap-3 sm:flex-row">
        <select v-model="status" class="select-field sm:flex-1">
          <option value="">All statuses</option>
          <option v-for="option in statusOptions" :key="option" :value="option">{{ STATUS_LABELS[option] }}</option>
        </select>
        <button type="button" :disabled="!canExport || exporting" class="btn-outline" @click="onExport">
          {{ exporting ? 'Exporting…' : 'Export to Excel' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
    <p v-if="loading" class="mt-6 text-center text-slate-500">Loading…</p>

    <p v-else-if="filtered.length === 0" class="mt-10 text-center text-slate-500">
      No animals match. Add one to get started.
    </p>

    <ul v-else class="mt-4 space-y-3">
      <li v-for="animal in filtered" :key="animal.id" class="card">
        <div class="flex items-start justify-between gap-3">
          <RouterLink :to="{ name: 'animal-detail', params: { id: animal.id } }" class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-lg font-semibold text-slate-900">#{{ animal.id }}</span>
              <span :class="['rounded-full px-2 py-0.5 text-xs font-medium', statusBadgeClass(animal.status)]">
                {{ STATUS_LABELS[animal.status] }}
              </span>
            </div>
            <p class="mt-1 text-sm text-slate-600">
              {{ SEX_LABELS[animal.sex] }} · {{ animal.colour }}
              <span v-if="animal.breed"> · {{ animal.breed }}</span>
            </p>
            <p class="mt-1 text-sm text-slate-500">
              <span v-if="animal.dob">Born {{ animal.dob }}</span>
              <span v-if="animal.motherId"> · Mother #{{ animal.motherId }}</span>
              <span> · {{ animal.lambCount }} lamb{{ animal.lambCount === 1 ? '' : 's' }}</span>
            </p>
          </RouterLink>
          <div class="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              class="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              @click="router.push({ name: 'animal-edit', params: { id: animal.id } })"
            >
              Edit
            </button>
            <button
              type="button"
              class="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              @click="openDelete(animal)"
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div
      v-if="pendingDelete"
      class="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      @click.self="closeDelete"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 class="text-lg font-semibold text-slate-900">Delete #{{ pendingDelete.id }}?</h2>
        <p class="mt-2 text-sm text-slate-600">This cannot be undone.</p>
        <p v-if="deleteError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ deleteError }}</p>
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn-secondary flex-1" @click="closeDelete">Cancel</button>
          <button type="button" :disabled="deleting" class="btn-danger flex-1" @click="confirmDelete">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
