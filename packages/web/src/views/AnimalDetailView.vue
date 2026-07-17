<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { AnimalDetail } from '@sheep/core'
import { animalsApi } from '../lib/animalsApi'
import { ApiError } from '../lib/api'
import { SEX_LABELS, STATUS_LABELS, statusBadgeClass } from '../lib/display'

const props = defineProps<{ id: string }>()
const router = useRouter()

const detail = ref<AnimalDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load(id: number): Promise<void> {
  loading.value = true
  error.value = null
  detail.value = null
  try {
    detail.value = await animalsApi.get(id)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      error.value = `Animal #${id} was not found.`
    } else {
      error.value = err instanceof ApiError ? err.message : 'Could not load this animal.'
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load(Number(props.id))
})

watch(
  () => props.id,
  (next) => {
    void load(Number(next))
  }
)
</script>

<template>
  <div>
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="min-h-11 rounded-lg px-2 py-2 text-slate-500 hover:text-slate-700"
        @click="router.push({ name: 'animals' })"
      >
        ← Flock
      </button>
      <h1 class="text-2xl font-semibold text-slate-900">Animal #{{ props.id }}</h1>
    </div>

    <p v-if="loading" class="mt-6 text-center text-slate-500">Loading…</p>
    <p v-else-if="error" class="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

    <div v-else-if="detail" class="mt-4 space-y-5">
      <section class="card">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl font-semibold text-slate-900">#{{ detail.animal.id }}</span>
            <span :class="['rounded-full px-2 py-0.5 text-xs font-medium', statusBadgeClass(detail.animal.status)]">
              {{ STATUS_LABELS[detail.animal.status] }}
            </span>
          </div>
          <RouterLink
            :to="{ name: 'animal-edit', params: { id: detail.animal.id } }"
            class="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit
          </RouterLink>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-slate-500">Sex</dt>
            <dd class="font-medium text-slate-900">{{ SEX_LABELS[detail.animal.sex] }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Colour</dt>
            <dd class="font-medium text-slate-900">{{ detail.animal.colour }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Breed</dt>
            <dd class="font-medium text-slate-900">{{ detail.animal.breed || '—' }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Date of birth</dt>
            <dd class="font-medium text-slate-900">{{ detail.animal.dob || '—' }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Mother</dt>
            <dd class="font-medium text-slate-900">
              <RouterLink
                v-if="detail.animal.motherId"
                :to="{ name: 'animal-detail', params: { id: detail.animal.motherId } }"
                class="app-link underline"
              >
                #{{ detail.animal.motherId }}
              </RouterLink>
              <span v-else>—</span>
            </dd>
          </div>
          <div>
            <dt class="text-slate-500">Father</dt>
            <dd class="font-medium text-slate-900">{{ detail.animal.fatherId ? `#${detail.animal.fatherId}` : '—' }}</dd>
          </div>
        </dl>

        <div v-if="detail.animal.notes" class="mt-4">
          <p class="text-slate-500 text-sm">Notes</p>
          <p class="mt-1 whitespace-pre-line text-slate-800">{{ detail.animal.notes }}</p>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900">Lineage</h2>
        <ol v-if="detail.lineage.length > 0" class="mt-2 space-y-1">
          <li
            v-for="(ancestor, index) in detail.lineage"
            :key="ancestor.id"
            class="flex items-center gap-2 text-sm text-slate-700"
          >
            <span class="text-slate-400">{{ index === 0 ? 'Mother' : index === 1 ? 'Grandmother' : `Gen +${index + 1}` }}</span>
            <RouterLink
              :to="{ name: 'animal-detail', params: { id: ancestor.id } }"
              class="rounded-lg border border-slate-200 bg-white px-3 py-1 font-medium text-brand-700 hover:bg-slate-50"
            >
              #{{ ancestor.id }} · {{ ancestor.colour }}
            </RouterLink>
          </li>
        </ol>
        <p v-else class="mt-2 text-sm text-slate-500">No recorded mother.</p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900">Lambs ({{ detail.lambs.length }})</h2>
        <ul v-if="detail.lambs.length > 0" class="mt-2 space-y-2">
          <li v-for="lamb in detail.lambs" :key="lamb.id">
            <RouterLink
              :to="{ name: 'animal-detail', params: { id: lamb.id } }"
              class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
            >
              <span class="font-medium text-slate-900">#{{ lamb.id }} · {{ lamb.colour }}</span>
              <span class="text-sm text-slate-500">{{ SEX_LABELS[lamb.sex] }}</span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-slate-500">No lambs recorded.</p>
      </section>
    </div>
  </div>
</template>
