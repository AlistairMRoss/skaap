import type {
  Animal,
  AnimalCreateInput,
  AnimalDetail,
  AnimalListItem,
  AnimalsListQuery,
  AnimalUpdateInput
} from '@sheep/core'
import { request } from './api'

function toQuery(query: AnimalsListQuery): string {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.q && query.q.length > 0) params.set('q', query.q)
  const qs = params.toString()
  return qs.length > 0 ? `?${qs}` : ''
}

export const animalsApi = {
  list(query: AnimalsListQuery = {}): Promise<{ animals: AnimalListItem[] }> {
    return request('GET', `/animals${toQuery(query)}`)
  },
  get(id: number): Promise<AnimalDetail> {
    return request('GET', `/animals/${id}`)
  },
  create(input: AnimalCreateInput): Promise<{ animal: Animal }> {
    return request('POST', '/animals', input)
  },
  update(id: number, input: AnimalUpdateInput): Promise<{ animal: Animal }> {
    return request('PUT', `/animals/${id}`, input)
  },
  remove(id: number): Promise<{ id: number; deleted: boolean }> {
    return request('DELETE', `/animals/${id}`)
  },
  lambs(id: number): Promise<{ lambs: Animal[] }> {
    return request('GET', `/animals/${id}/lambs`)
  },
  lineage(id: number): Promise<{ lineage: Animal[] }> {
    return request('GET', `/animals/${id}/lineage`)
  }
}
