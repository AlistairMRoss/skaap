import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AnimalListItem, Status } from '@sheep/core'
import { animalsApi } from '../lib/animalsApi'
import { ApiError } from '../lib/api'

export const useAnimalsStore = defineStore('animals', () => {
  const all = ref<AnimalListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const search = ref('')
  const status = ref<Status | ''>('')

  const filtered = computed<AnimalListItem[]>(() => {
    const term = search.value.trim().toLowerCase()
    return all.value
      .filter((animal) => (status.value ? animal.status === status.value : true))
      .filter((animal) => {
        if (term.length === 0) return true
        const haystacks = [String(animal.id), animal.colour, animal.sex, animal.breed ?? '', animal.notes ?? '']
        return haystacks.some((value) => value.toLowerCase().includes(term))
      })
  })

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await animalsApi.list()
      all.value = result.animals
    } catch (err) {
      error.value = err instanceof ApiError ? err.message : 'Failed to load animals'
    } finally {
      loading.value = false
    }
  }

  function byId(id: number): AnimalListItem | undefined {
    return all.value.find((animal) => animal.id === id)
  }

  return { all, loading, error, search, status, filtered, load, byId }
})
