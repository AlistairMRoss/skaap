<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AnimalCreateInput, AnimalListItem, AnimalUpdateInput, Sex, Status } from '@sheep/core'
import { SEXES, STATUSES } from '@sheep/core'
import { useAnimalsStore } from '../stores/animals'
import { animalsApi } from '../lib/animalsApi'
import { ApiError } from '../lib/api'
import { SEX_LABELS, STATUS_LABELS } from '../lib/display'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const store = useAnimalsStore()

const isEdit = computed(() => props.id !== undefined)
const editId = computed(() => (props.id !== undefined ? Number(props.id) : null))

const form = reactive({
  id: null as number | null,
  colour: '',
  sex: 'ewe' as Sex,
  breed: '',
  dob: '',
  motherId: '' as number | '',
  fatherId: '' as number | '',
  status: 'alive' as Status,
  notes: ''
})

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

const parentOptions = computed<AnimalListItem[]>(() =>
  store.all.filter((animal) => animal.id !== editId.value)
)

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

onMounted(async () => {
  loading.value = true
  try {
    if (store.all.length === 0) await store.load()
    if (isEdit.value && editId.value !== null) {
      const { animal } = await animalsApi.get(editId.value)
      form.id = animal.id
      form.colour = animal.colour
      form.sex = animal.sex
      form.breed = animal.breed ?? ''
      form.dob = animal.dob ?? ''
      form.motherId = animal.motherId ?? ''
      form.fatherId = animal.fatherId ?? ''
      form.status = animal.status
      form.notes = animal.notes ?? ''
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load this animal.'
  } finally {
    loading.value = false
  }
})

async function onSubmit(): Promise<void> {
  error.value = null
  saving.value = true
  try {
    const shared = {
      colour: form.colour.trim(),
      sex: form.sex,
      breed: emptyToUndefined(form.breed),
      dob: emptyToUndefined(form.dob),
      motherId: form.motherId === '' ? undefined : form.motherId,
      fatherId: form.fatherId === '' ? undefined : form.fatherId,
      status: form.status,
      notes: emptyToUndefined(form.notes)
    }
    if (isEdit.value && editId.value !== null) {
      const input: AnimalUpdateInput = shared
      await animalsApi.update(editId.value, input)
      await store.load()
      await router.push({ name: 'animal-detail', params: { id: editId.value } })
    } else {
      if (form.id === null) {
        error.value = 'A tag number is required.'
        return
      }
      const input: AnimalCreateInput = { id: form.id, ...shared }
      const { animal } = await animalsApi.create(input)
      await store.load()
      await router.push({ name: 'animal-detail', params: { id: animal.id } })
    }
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not save this animal.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="min-h-11 rounded-lg px-2 py-2 text-slate-500 hover:text-slate-700"
        @click="router.back()"
      >
        ← Back
      </button>
      <h1 class="text-2xl font-semibold text-slate-900">{{ isEdit ? 'Edit animal' : 'Add animal' }}</h1>
    </div>

    <p v-if="loading" class="mt-6 text-center text-slate-500">Loading…</p>

    <form v-else class="mt-4 space-y-4" @submit.prevent="onSubmit">
      <div>
        <label for="tag" class="block text-sm font-medium text-slate-700">Tag number</label>
        <input
          id="tag"
          v-model.number="form.id"
          type="number"
          min="1"
          step="1"
          :disabled="isEdit"
          required
          class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none disabled:bg-slate-100"
        />
      </div>

      <div>
        <label for="colour" class="block text-sm font-medium text-slate-700">Colour / marking</label>
        <input
          id="colour"
          v-model="form.colour"
          type="text"
          required
          class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
        />
      </div>

      <div class="flex gap-3">
        <div class="flex-1">
          <label for="sex" class="block text-sm font-medium text-slate-700">Sex</label>
          <select
            id="sex"
            v-model="form.sex"
            class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-green-600 focus:outline-none"
          >
            <option v-for="option in SEXES" :key="option" :value="option">{{ SEX_LABELS[option] }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label for="status" class="block text-sm font-medium text-slate-700">Status</label>
          <select
            id="status"
            v-model="form.status"
            class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-green-600 focus:outline-none"
          >
            <option v-for="option in STATUSES" :key="option" :value="option">{{ STATUS_LABELS[option] }}</option>
          </select>
        </div>
      </div>

      <div class="flex gap-3">
        <div class="flex-1">
          <label for="breed" class="block text-sm font-medium text-slate-700">Breed</label>
          <input
            id="breed"
            v-model="form.breed"
            type="text"
            class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
          />
        </div>
        <div class="flex-1">
          <label for="dob" class="block text-sm font-medium text-slate-700">Date of birth</label>
          <input
            id="dob"
            v-model="form.dob"
            type="date"
            class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
          />
        </div>
      </div>

      <div class="flex gap-3">
        <div class="flex-1">
          <label for="mother" class="block text-sm font-medium text-slate-700">Mother</label>
          <select
            id="mother"
            v-model="form.motherId"
            class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-green-600 focus:outline-none"
          >
            <option value="">None</option>
            <option v-for="option in parentOptions" :key="option.id" :value="option.id">
              #{{ option.id }} · {{ option.colour }}
            </option>
          </select>
        </div>
        <div class="flex-1">
          <label for="father" class="block text-sm font-medium text-slate-700">Father</label>
          <select
            id="father"
            v-model="form.fatherId"
            class="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base focus:border-green-600 focus:outline-none"
          >
            <option value="">None</option>
            <option v-for="option in parentOptions" :key="option.id" :value="option.id">
              #{{ option.id }} · {{ option.colour }}
            </option>
          </select>
        </div>
      </div>

      <div>
        <label for="notes" class="block text-sm font-medium text-slate-700">Notes</label>
        <textarea
          id="notes"
          v-model="form.notes"
          rows="3"
          class="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 text-base focus:border-green-600 focus:outline-none"
        ></textarea>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <button
        type="submit"
        :disabled="saving"
        class="min-h-12 w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
      >
        {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add animal' }}
      </button>
    </form>
  </div>
</template>
