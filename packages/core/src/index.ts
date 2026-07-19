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
  status?: Status
  notes?: string
}

export type AnimalUpdateInput = Omit<AnimalCreateInput, 'id'>

export interface Lamb {
  lambId: string
  motherId: number
  sex: Sex
  dob: string
  promoted: boolean
  promotedToId?: number
  createdAt: string
  updatedAt: string
}

export interface LambCreateInput {
  sex: Sex
  dob: string
}

export type LambUpdateInput = LambCreateInput

export interface LambPromoteInput {
  id: number
  colour: string
  breed?: string
  notes?: string
}

export interface AnimalListItem extends Animal {
  lambCount: number
}

export interface AnimalDetail {
  animal: Animal
  lambs: Lamb[]
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
