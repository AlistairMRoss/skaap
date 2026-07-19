import type {
  Animal,
  AnimalCreateInput,
  AnimalDetail,
  AnimalListItem,
  AnimalsListQuery,
  AnimalUpdateInput,
  Lamb,
  LambCreateInput,
  LambPromoteInput,
  LambUpdateInput
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
  lambs(id: number): Promise<{ lambs: Lamb[] }> {
    return request('GET', `/animals/${id}/lambs`)
  },
  lineage(id: number): Promise<{ lineage: Animal[] }> {
    return request('GET', `/animals/${id}/lineage`)
  },
  addLamb(motherId: number, input: LambCreateInput): Promise<{ lamb: Lamb }> {
    return request('POST', `/animals/${motherId}/lambs`, input)
  },
  updateLamb(motherId: number, lambId: string, input: LambUpdateInput): Promise<{ lamb: Lamb }> {
    return request('PUT', `/animals/${motherId}/lambs/${lambId}`, input)
  },
  deleteLamb(motherId: number, lambId: string): Promise<{ lambId: string; deleted: boolean }> {
    return request('DELETE', `/animals/${motherId}/lambs/${lambId}`)
  },
  promoteLamb(motherId: number, lambId: string, input: LambPromoteInput): Promise<{ animal: Animal }> {
    return request('POST', `/animals/${motherId}/lambs/${lambId}/promote`, input)
  }
}
