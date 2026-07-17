export const GSI1_PK = 'ALL#ANIMAL'

const ID_WIDTH = 10

export function padId(id: number): string {
  return id.toString().padStart(ID_WIDTH, '0')
}

export function animalPk(id: number): string {
  return `ANIMAL#${id}`
}

export interface AnimalKey {
  pk: string
  sk: string
}

export function animalKey(id: number): AnimalKey {
  const pk = animalPk(id)
  return { pk, sk: pk }
}

export function motherGsiPk(motherId: number): string {
  return `MOTHER#${motherId}`
}

export function animalGsi2Sk(id: number): string {
  return `ANIMAL#${id}`
}
