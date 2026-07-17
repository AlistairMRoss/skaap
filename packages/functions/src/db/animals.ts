import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb'
import type {
  Animal,
  AnimalCreateInput,
  AnimalDetail,
  AnimalListItem,
  AnimalsListQuery,
  AnimalUpdateInput,
  Sex,
  Status
} from '@sheep/core'
import { ddb } from './client'
import { GSI1_NAME, GSI2_NAME, tableName } from './table'
import { GSI1_PK, animalGsi2Sk, animalKey, motherGsiPk, padId } from '../lib/keys'
import { badRequest, conflict, notFound } from '../lib/errors'

const LINEAGE_MAX_DEPTH = 20

function toAnimal(item: Record<string, unknown>): Animal {
  return {
    id: item.id as number,
    colour: item.colour as string,
    sex: item.sex as Sex,
    breed: item.breed as string | undefined,
    dob: item.dob as string | undefined,
    motherId: item.motherId as number | undefined,
    fatherId: item.fatherId as number | undefined,
    status: item.status as Status,
    notes: item.notes as string | undefined,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string
  }
}

function buildItem(animal: Animal): Record<string, unknown> {
  const item: Record<string, unknown> = {
    ...animalKey(animal.id),
    gsi1pk: GSI1_PK,
    gsi1sk: padId(animal.id),
    id: animal.id,
    colour: animal.colour,
    sex: animal.sex,
    status: animal.status,
    createdAt: animal.createdAt,
    updatedAt: animal.updatedAt
  }
  if (animal.breed !== undefined) item.breed = animal.breed
  if (animal.dob !== undefined) item.dob = animal.dob
  if (animal.fatherId !== undefined) item.fatherId = animal.fatherId
  if (animal.notes !== undefined) item.notes = animal.notes
  if (animal.motherId !== undefined) {
    item.motherId = animal.motherId
    item.gsi2pk = motherGsiPk(animal.motherId)
    item.gsi2sk = animalGsi2Sk(animal.id)
  }
  return item
}

function isConditionalFailure(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'ConditionalCheckFailedException'
  )
}

export async function getAnimal(id: number): Promise<Animal | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: animalKey(id) }))
  return res.Item ? toAnimal(res.Item) : null
}

async function queryAllAnimals(): Promise<Animal[]> {
  const items: Animal[] = []
  let start: Record<string, unknown> | undefined
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: GSI1_NAME,
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': GSI1_PK },
        ExclusiveStartKey: start
      })
    )
    for (const item of res.Items ?? []) items.push(toAnimal(item))
    start = res.LastEvaluatedKey
  } while (start !== undefined)
  items.sort((a, b) => a.id - b.id)
  return items
}

function matchesTerm(animal: Animal, term: string): boolean {
  const haystacks = [String(animal.id), animal.colour, animal.breed ?? '', animal.notes ?? '']
  return haystacks.some((value) => value.toLowerCase().includes(term))
}

export async function listAnimals(query: AnimalsListQuery = {}): Promise<AnimalListItem[]> {
  const all = await queryAllAnimals()
  const counts = new Map<number, number>()
  for (const animal of all) {
    if (animal.motherId !== undefined) {
      counts.set(animal.motherId, (counts.get(animal.motherId) ?? 0) + 1)
    }
  }
  const term = query.q?.trim().toLowerCase()
  return all
    .filter((animal) => (query.status ? animal.status === query.status : true))
    .filter((animal) => (term && term.length > 0 ? matchesTerm(animal, term) : true))
    .map((animal) => ({ ...animal, lambCount: counts.get(animal.id) ?? 0 }))
}

export async function listLambs(motherId: number): Promise<Animal[]> {
  const items: Animal[] = []
  let start: Record<string, unknown> | undefined
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: GSI2_NAME,
        KeyConditionExpression: 'gsi2pk = :pk',
        ExpressionAttributeValues: { ':pk': motherGsiPk(motherId) },
        ExclusiveStartKey: start
      })
    )
    for (const item of res.Items ?? []) items.push(toAnimal(item))
    start = res.LastEvaluatedKey
  } while (start !== undefined)
  items.sort((a, b) => a.id - b.id)
  return items
}

async function walkMotherLine(start: Animal): Promise<Animal[]> {
  const chain: Animal[] = []
  const visited = new Set<number>([start.id])
  let current = start.motherId
  while (current !== undefined && chain.length < LINEAGE_MAX_DEPTH) {
    if (visited.has(current)) break
    visited.add(current)
    const mother = await getAnimal(current)
    if (!mother) break
    chain.push(mother)
    current = mother.motherId
  }
  return chain
}

export async function getLineage(id: number): Promise<Animal[]> {
  const start = await getAnimal(id)
  if (!start) throw notFound(`Animal ${id} not found`)
  return walkMotherLine(start)
}

export async function getAnimalDetail(id: number): Promise<AnimalDetail> {
  const animal = await getAnimal(id)
  if (!animal) throw notFound(`Animal ${id} not found`)
  const [lambs, lineage] = await Promise.all([listLambs(id), walkMotherLine(animal)])
  return { animal, lambs, lineage }
}

async function assertReferenceExists(id: number, field: string): Promise<void> {
  const found = await getAnimal(id)
  if (!found) throw badRequest(`${field} ${id} does not reference an existing animal`)
}

async function assertNoMotherCycle(id: number, motherId: number): Promise<void> {
  let current: number | undefined = motherId
  const visited = new Set<number>()
  let depth = 0
  while (current !== undefined && depth < LINEAGE_MAX_DEPTH) {
    if (current === id) {
      throw badRequest('Setting this mother would create a cycle in the lineage')
    }
    if (visited.has(current)) break
    visited.add(current)
    const parent = await getAnimal(current)
    current = parent?.motherId
    depth += 1
  }
}

export async function createAnimal(input: AnimalCreateInput): Promise<Animal> {
  if (input.motherId !== undefined && input.motherId === input.id) {
    throw badRequest('An animal cannot be its own mother')
  }
  if (input.fatherId !== undefined && input.fatherId === input.id) {
    throw badRequest('An animal cannot be its own father')
  }
  if (input.motherId !== undefined) await assertReferenceExists(input.motherId, 'motherId')
  if (input.fatherId !== undefined) await assertReferenceExists(input.fatherId, 'fatherId')

  const now = new Date().toISOString()
  const animal: Animal = {
    id: input.id,
    colour: input.colour,
    sex: input.sex,
    breed: input.breed,
    dob: input.dob,
    motherId: input.motherId,
    fatherId: input.fatherId,
    status: input.status ?? 'alive',
    notes: input.notes,
    createdAt: now,
    updatedAt: now
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: buildItem(animal),
        ConditionExpression: 'attribute_not_exists(pk)'
      })
    )
  } catch (err) {
    if (isConditionalFailure(err)) throw conflict(`Animal ${input.id} already exists`)
    throw err
  }
  return animal
}

export async function updateAnimal(id: number, input: AnimalUpdateInput): Promise<Animal> {
  const existing = await getAnimal(id)
  if (!existing) throw notFound(`Animal ${id} not found`)

  if (input.motherId !== undefined) {
    if (input.motherId === id) throw badRequest('An animal cannot be its own mother')
    await assertReferenceExists(input.motherId, 'motherId')
    await assertNoMotherCycle(id, input.motherId)
  }
  if (input.fatherId !== undefined) {
    if (input.fatherId === id) throw badRequest('An animal cannot be its own father')
    await assertReferenceExists(input.fatherId, 'fatherId')
  }

  const now = new Date().toISOString()
  const animal: Animal = {
    id,
    colour: input.colour,
    sex: input.sex,
    breed: input.breed,
    dob: input.dob,
    motherId: input.motherId,
    fatherId: input.fatherId,
    status: input.status ?? existing.status,
    notes: input.notes,
    createdAt: existing.createdAt,
    updatedAt: now
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: buildItem(animal),
        ConditionExpression: 'attribute_exists(pk)'
      })
    )
  } catch (err) {
    if (isConditionalFailure(err)) throw notFound(`Animal ${id} not found`)
    throw err
  }
  return animal
}

export async function deleteAnimal(id: number): Promise<void> {
  const existing = await getAnimal(id)
  if (!existing) throw notFound(`Animal ${id} not found`)
  const lambs = await listLambs(id)
  if (lambs.length > 0) {
    throw conflict(`Animal ${id} has ${lambs.length} lamb(s); reassign or remove them before deleting`)
  }
  await ddb.send(new DeleteCommand({ TableName: tableName(), Key: animalKey(id) }))
}
