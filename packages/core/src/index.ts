export const SEXES = ['ewe', 'ram', 'wether'] as const
export type Sex = (typeof SEXES)[number]

export const STATUSES = ['alive', 'sold', 'deceased'] as const
export type Status = (typeof STATUSES)[number]

export interface Animal {
  id: number
  colour: string
  sex: Sex
  breed?: string
  dob?: string
  motherId?: number
  fatherId?: number
  status: Status
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface AnimalCreateInput {
  id: number
  colour: string
  sex: Sex
  breed?: string
  dob?: string
  motherId?: number
  fatherId?: number
  status?: Status
  notes?: string
}

export type AnimalUpdateInput = Omit<AnimalCreateInput, 'id'>

export interface AnimalListItem extends Animal {
  lambCount: number
}

export interface AnimalDetail {
  animal: Animal
  lambs: Animal[]
  lineage: Animal[]
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
  }
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export interface AnimalsListQuery {
  status?: Status
  q?: string
}

export function isSex(value: unknown): value is Sex {
  return typeof value === 'string' && (SEXES as readonly string[]).includes(value)
}

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
}
