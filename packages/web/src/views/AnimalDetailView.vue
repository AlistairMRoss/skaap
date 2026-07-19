<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { AnimalDetail, Lamb, Sex } from '@sheep/core'
import { SEXES } from '@sheep/core'
import { animalsApi } from '../lib/animalsApi'
import { ApiError } from '../lib/api'
import { SEX_LABELS, STATUS_LABELS, statusBadgeClass } from '../lib/display'

const props = defineProps<{ id: string }>()
const router = useRouter()

const detail = ref<AnimalDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const motherId = computed(() => Number(props.id))
const isEwe = computed(() => detail.value?.animal.sex === 'ewe')
const activeLambs = computed<Lamb[]>(() => detail.value?.lambs.filter((lamb) => !lamb.promoted) ?? [])
const promotedLambs = computed<Lamb[]>(() => detail.value?.lambs.filter((lamb) => lamb.promoted) ?? [])

const addOpen = ref(false)
const addForm = reactive({ sex: 'ewe' as Sex, dob: '' })
const addBusy = ref(false)
const addError = ref<string | null>(null)

const promoteTarget = ref<Lamb | null>(null)
const promoteForm = reactive({ id: null as number | null, colour: '', breed: '', notes: '' })
const promoteBusy = ref(false)
const promoteError = ref<string | null>(null)

const pendingDeleteLamb = ref<Lamb | null>(null)
const deleteBusy = ref(false)
const deleteError = ref<string | null>(null)

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
  void load(motherId.value)
})

watch(
  () => props.id,
  (next) => {
    void load(Number(next))
  }
)

function openAdd(): void {
  addForm.sex = 'ewe'
  addForm.dob = ''
  addError.value = null
  addOpen.value = true
}

async function submitAdd(): Promise<void> {
  addError.value = null
  addBusy.value = true
  try {
    await animalsApi.addLamb(motherId.value, { sex: addForm.sex, dob: addForm.dob })
    addOpen.value = false
    await load(motherId.value)
  } catch (err) {
    addError.value = err instanceof ApiError ? err.message : 'Could not add this lamb.'
  } finally {
    addBusy.value = false
  }
}

function openPromote(lamb: Lamb): void {
  promoteTarget.value = lamb
  promoteForm.id = null
  promoteForm.colour = ''
  promoteForm.breed = ''
  promoteForm.notes = ''
  promoteError.value = null
}

async function submitPromote(): Promise<void> {
  if (!promoteTarget.value || promoteForm.id === null) return
  promoteError.value = null
  promoteBusy.value = true
  try {
    await animalsApi.promoteLamb(motherId.value, promoteTarget.value.lambId, {
      id: promoteForm.id,
      colour: promoteForm.colour.trim(),
      breed: promoteForm.breed.trim() || undefined,
      notes: promoteForm.notes.trim() || undefined
    })
    promoteTarget.value = null
    await load(motherId.value)
  } catch (err) {
    promoteError.value = err instanceof ApiError ? err.message : 'Could not promote this lamb.'
  } finally {
    promoteBusy.value = false
  }
}

async function confirmDeleteLamb(): Promise<void> {
  if (!pendingDeleteLamb.value) return
  deleteError.value = null
  deleteBusy.value = true
  try {
    await animalsApi.deleteLamb(motherId.value, pendingDeleteLamb.value.lambId)
    pendingDeleteLamb.value = null
    await load(motherId.value)
  } catch (err) {
    deleteError.value = err instanceof ApiError ? err.message : 'Could not remove this lamb.'
  } finally {
    deleteBusy.value = false
  }
}

function lambLabel(lamb: Lamb): string {
  return `${SEX_LABELS[lamb.sex]} lamb · born ${lamb.dob}`
}
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
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900">Lambs ({{ activeLambs.length }})</h2>
          <button v-if="isEwe" type="button" class="btn-primary min-h-11 px-3 py-2 text-sm" @click="openAdd">
            + Add lamb
          </button>
        </div>

        <p v-if="!isEwe" class="mt-2 text-sm text-slate-500">Only ewes can have lambs.</p>
        <p v-else-if="detail.lambs.length === 0" class="mt-2 text-sm text-slate-500">No lambs recorded yet.</p>

        <ul v-else class="mt-3 space-y-2">
          <li
            v-for="lamb in activeLambs"
            :key="lamb.lambId"
            class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <span class="font-medium text-slate-900">{{ lambLabel(lamb) }}</span>
            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                class="min-h-11 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                @click="openPromote(lamb)"
              >
                Promote
              </button>
              <button
                type="button"
                class="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                @click="pendingDeleteLamb = lamb"
              >
                Remove
              </button>
            </div>
          </li>

          <li
            v-for="lamb in promotedLambs"
            :key="lamb.lambId"
            class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-400"
          >
            <span>{{ lambLabel(lamb) }}</span>
            <RouterLink
              v-if="lamb.promotedToId"
              :to="{ name: 'animal-detail', params: { id: lamb.promotedToId } }"
              class="shrink-0 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Promoted → #{{ lamb.promotedToId }}
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>

    <div
      v-if="addOpen"
      class="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      @click.self="addOpen = false"
    >
      <form class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" @submit.prevent="submitAdd">
        <h2 class="text-lg font-semibold text-slate-900">Add a lamb</h2>
        <div class="mt-4 space-y-4">
          <div>
            <label for="lamb-sex" class="field-label">Sex</label>
            <select id="lamb-sex" v-model="addForm.sex" class="mt-1 select-field">
              <option v-for="option in SEXES" :key="option" :value="option">{{ SEX_LABELS[option] }}</option>
            </select>
          </div>
          <div>
            <label for="lamb-dob" class="field-label">Date of birth</label>
            <input id="lamb-dob" v-model="addForm.dob" type="date" required class="mt-1 input-field" />
          </div>
        </div>
        <p v-if="addError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ addError }}</p>
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn-secondary flex-1" @click="addOpen = false">Cancel</button>
          <button type="submit" :disabled="addBusy || addForm.dob.length === 0" class="btn-primary flex-1">
            {{ addBusy ? 'Adding…' : 'Add lamb' }}
          </button>
        </div>
      </form>
    </div>

    <div
      v-if="promoteTarget"
      class="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      @click.self="promoteTarget = null"
    >
      <form class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" @submit.prevent="submitPromote">
        <h2 class="text-lg font-semibold text-slate-900">Promote to sheep</h2>
        <p class="mt-1 text-sm text-slate-500">{{ lambLabel(promoteTarget) }}</p>
        <div class="mt-4 space-y-4">
          <div>
            <label for="promote-tag" class="field-label">Tag number</label>
            <input
              id="promote-tag"
              v-model.number="promoteForm.id"
              type="number"
              min="1"
              step="1"
              required
              class="mt-1 input-field"
            />
          </div>
          <div>
            <label for="promote-colour" class="field-label">Colour / marking</label>
            <input id="promote-colour" v-model="promoteForm.colour" type="text" required class="mt-1 input-field" />
          </div>
          <div>
            <label for="promote-breed" class="field-label">Breed</label>
            <input id="promote-breed" v-model="promoteForm.breed" type="text" class="mt-1 input-field" />
          </div>
          <div>
            <label for="promote-notes" class="field-label">Notes</label>
            <textarea id="promote-notes" v-model="promoteForm.notes" rows="2" class="mt-1 textarea-field"></textarea>
          </div>
        </div>
        <p v-if="promoteError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ promoteError }}</p>
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn-secondary flex-1" @click="promoteTarget = null">Cancel</button>
          <button
            type="submit"
            :disabled="promoteBusy || promoteForm.id === null || promoteForm.colour.trim().length === 0"
            class="btn-primary flex-1"
          >
            {{ promoteBusy ? 'Promoting…' : 'Promote' }}
          </button>
        </div>
      </form>
    </div>

    <div
      v-if="pendingDeleteLamb"
      class="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      @click.self="pendingDeleteLamb = null"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 class="text-lg font-semibold text-slate-900">Remove this lamb?</h2>
        <p class="mt-2 text-sm text-slate-600">{{ lambLabel(pendingDeleteLamb) }}. This cannot be undone.</p>
        <p v-if="deleteError" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ deleteError }}</p>
        <div class="mt-5 flex gap-3">
          <button type="button" class="btn-secondary flex-1" @click="pendingDeleteLamb = null">Cancel</button>
          <button type="button" :disabled="deleteBusy" class="btn-danger flex-1" @click="confirmDeleteLamb">
            {{ deleteBusy ? 'Removing…' : 'Remove' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
