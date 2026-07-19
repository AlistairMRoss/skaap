import { randomUUID } from 'crypto'
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
  Lamb,
  LambCreateInput,
  LambPromoteInput,
  LambUpdateInput,
  Sex,
  Status
} from '@sheep/core'
import { ddb } from './client'
import { GSI1_NAME, tableName } from './table'
import {
  ALL_LAMB_GSI1_PK,
  GSI1_PK,
  LAMB_SK_PREFIX,
  animalKey,
  animalPk,
  lambKey,
  padId
} from '../lib/keys'
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
  if (animal.notes !== undefined) item.notes = animal.notes
  if (animal.motherId !== undefined) item.motherId = animal.motherId
  return item
}

function toLamb(item: Record<string, unknown>): Lamb {
  return {
    lambId: item.lambId as string,
    motherId: item.motherId as number,
    sex: item.sex as Sex,
    dob: item.dob as string,
    promoted: (item.promoted as boolean | undefined) ?? false,
    promotedToId: item.promotedToId as number | undefined,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string
  }
}

function buildLambItem(lamb: Lamb): Record<string, unknown> {
  const item: Record<string, unknown> = {
    ...lambKey(lamb.motherId, lamb.lambId),
    gsi1pk: ALL_LAMB_GSI1_PK,
    gsi1sk: lamb.lambId,
    lambId: lamb.lambId,
    motherId: lamb.motherId,
    sex: lamb.sex,
    dob: lamb.dob,
    promoted: lamb.promoted,
    createdAt: lamb.createdAt,
    updatedAt: lamb.updatedAt
  }
  if (lamb.promotedToId !== undefined) item.promotedToId = lamb.promotedToId
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

async function queryGsi1(partition: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = []
  let start: Record<string, unknown> | undefined
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: GSI1_NAME,
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: { ':pk': partition },
        ExclusiveStartKey: start
      })
    )
    for (const item of res.Items ?? []) items.push(item)
    start = res.LastEvaluatedKey
  } while (start !== undefined)
  return items
}

async function queryAllAnimals(): Promise<Animal[]> {
  const items = (await queryGsi1(GSI1_PK)).map(toAnimal)
  items.sort((a, b) => a.id - b.id)
  return items
}

async function listAllLambs(): Promise<Lamb[]> {
  return (await queryGsi1(ALL_LAMB_GSI1_PK)).map(toLamb)
}

function matchesTerm(animal: Animal, term: string): boolean {
  const haystacks = [String(animal.id), animal.colour, animal.breed ?? '', animal.notes ?? '']
  return haystacks.some((value) => value.toLowerCase().includes(term))
}

export async function listAnimals(query: AnimalsListQuery = {}): Promise<AnimalListItem[]> {
  const [all, lambs] = await Promise.all([queryAllAnimals(), listAllLambs()])
  const counts = new Map<number, number>()
  for (const lamb of lambs) {
    if (!lamb.promoted) counts.set(lamb.motherId, (counts.get(lamb.motherId) ?? 0) + 1)
  }
  const term = query.q?.trim().toLowerCase()
  return all
    .filter((animal) => (query.status ? animal.status === query.status : true))
    .filter((animal) => (term && term.length > 0 ? matchesTerm(animal, term) : true))
    .map((animal) => ({ ...animal, lambCount: counts.get(animal.id) ?? 0 }))
}

function sortLambs(lambs: Lamb[]): Lamb[] {
  return lambs.sort((a, b) => {
    if (a.dob !== b.dob) return a.dob.localeCompare(b.dob)
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export async function listLambsByMother(motherId: number): Promise<Lamb[]> {
  const items: Lamb[] = []
  let start: Record<string, unknown> | undefined
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':pk': animalPk(motherId), ':prefix': LAMB_SK_PREFIX },
        ExclusiveStartKey: start
      })
    )
    for (const item of res.Items ?? []) items.push(toLamb(item))
    start = res.LastEvaluatedKey
  } while (start !== undefined)
  return sortLambs(items)
}

export async function getLamb(motherId: number, lambId: string): Promise<Lamb | null> {
  const res = await ddb.send(new GetCommand({ TableName: tableName(), Key: lambKey(motherId, lambId) }))
  return res.Item ? toLamb(res.Item) : null
}

export async function createLamb(motherId: number, input: LambCreateInput): Promise<Lamb> {
  const mother = await getAnimal(motherId)
  if (!mother) throw notFound(`Animal ${motherId} not found`)
  if (mother.sex !== 'ewe') throw badRequest('Only ewes can have lambs')

  const now = new Date().toISOString()
  const lamb: Lamb = {
    lambId: randomUUID(),
    motherId,
    sex: input.sex,
    dob: input.dob,
    promoted: false,
    createdAt: now,
    updatedAt: now
  }
  await ddb.send(new PutCommand({ TableName: tableName(), Item: buildLambItem(lamb) }))
  return lamb
}

export async function updateLamb(
  motherId: number,
  lambId: string,
  input: LambUpdateInput
): Promise<Lamb> {
  const existing = await getLamb(motherId, lambId)
  if (!existing) throw notFound(`Lamb ${lambId} not found`)
  if (existing.promoted) throw conflict('This lamb has been promoted and can no longer be edited')

  const lamb: Lamb = {
    ...existing,
    sex: input.sex,
    dob: input.dob,
    updatedAt: new Date().toISOString()
  }
  await ddb.send(new PutCommand({ TableName: tableName(), Item: buildLambItem(lamb) }))
  return lamb
}

export async function deleteLamb(motherId: number, lambId: string): Promise<void> {
  const existing = await getLamb(motherId, lambId)
  if (!existing) throw notFound(`Lamb ${lambId} not found`)
  await ddb.send(new DeleteCommand({ TableName: tableName(), Key: lambKey(motherId, lambId) }))
}

export async function promoteLamb(
  motherId: number,
  lambId: string,
  input: LambPromoteInput
): Promise<Animal> {
  const lamb = await getLamb(motherId, lambId)
  if (!lamb) throw notFound(`Lamb ${lambId} not found`)
  if (lamb.promoted) throw conflict('This lamb has already been promoted')

  const now = new Date().toISOString()
  const animal: Animal = {
    id: input.id,
    colour: input.colour,
    sex: lamb.sex,
    breed: input.breed,
    dob: lamb.dob,
    motherId,
    status: 'alive',
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

  const promotedLamb: Lamb = { ...lamb, promoted: true, promotedToId: input.id, updatedAt: now }
  await ddb.send(new PutCommand({ TableName: tableName(), Item: buildLambItem(promotedLamb) }))
  return animal
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
  const [lambs, lineage] = await Promise.all([listLambsByMother(id), walkMotherLine(animal)])
  return { animal, lambs, lineage }
}

export async function createAnimal(input: AnimalCreateInput): Promise<Animal> {
  const now = new Date().toISOString()
  const animal: Animal = {
    id: input.id,
    colour: input.colour,
    sex: input.sex,
    breed: input.breed,
    dob: input.dob,
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

  const animal: Animal = {
    id,
    colour: input.colour,
    sex: input.sex,
    breed: input.breed,
    dob: input.dob,
    motherId: existing.motherId,
    status: input.status ?? existing.status,
    notes: input.notes,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
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
  const lambs = await listLambsByMother(id)
  const active = lambs.filter((lamb) => !lamb.promoted)
  if (active.length > 0) {
    throw conflict(`Animal ${id} has ${active.length} lamb(s); promote or remove them before deleting`)
  }
  for (const lamb of lambs) {
    await ddb.send(new DeleteCommand({ TableName: tableName(), Key: lambKey(id, lamb.lambId) }))
  }
  await ddb.send(new DeleteCommand({ TableName: tableName(), Key: animalKey(id) }))
}
