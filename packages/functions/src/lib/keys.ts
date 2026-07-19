export const GSI1_PK = 'ALL#ANIMAL'
export const ALL_LAMB_GSI1_PK = 'ALL#LAMB'
export const LAMB_SK_PREFIX = 'LAMB#'

const ID_WIDTH = 10

export function padId(id: number): string {
  return id.toString().padStart(ID_WIDTH, '0')
}

export function animalPk(id: number): string {
  return `ANIMAL#${id}`
}

export interface ItemKey {
  pk: string
  sk: string
}

export function animalKey(id: number): ItemKey {
  const pk = animalPk(id)
  return { pk, sk: pk }
}

export function lambSk(lambId: string): string {
  return `${LAMB_SK_PREFIX}${lambId}`
}

export function lambKey(motherId: number, lambId: string): ItemKey {
  return { pk: animalPk(motherId), sk: lambSk(lambId) }
}
