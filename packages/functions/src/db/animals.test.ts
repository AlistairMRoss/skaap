import { beforeEach, describe, expect, it } from 'vitest'
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { ddb } from './client'
import {
  createAnimal,
  createLamb,
  deleteAnimal,
  deleteLamb,
  getLineage,
  listAnimals,
  listLambsByMother,
  promoteLamb,
  updateAnimal
} from './animals'
import { animalItem, conditionalFailure, lambItem } from '../test-support'
import { animalKey, lambKey } from '../lib/keys'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

function onSheepQuery(): ReturnType<typeof ddbMock.on> {
  return ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':pk': 'ALL#ANIMAL' } })
}

function onLambQuery(): ReturnType<typeof ddbMock.on> {
  return ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':pk': 'ALL#LAMB' } })
}

describe('listAnimals', () => {
  const flock = [
    animalItem({ id: 1, colour: 'white', status: 'alive' }),
    animalItem({ id: 2, colour: 'black', status: 'sold' }),
    animalItem({ id: 3, colour: 'brown', status: 'alive', notes: 'friendly' })
  ]
  const lambs = [
    lambItem({ lambId: 'a', motherId: 1 }),
    lambItem({ lambId: 'b', motherId: 1 }),
    lambItem({ lambId: 'c', motherId: 1, promoted: true, promotedToId: 9 })
  ]

  beforeEach(() => {
    onSheepQuery().resolves({ Items: flock })
    onLambQuery().resolves({ Items: lambs })
  })

  it('counts only current (un-promoted) lambs per mother', async () => {
    const result = await listAnimals()
    expect(result.map((a) => a.id)).toEqual([1, 2, 3])
    expect(result.find((a) => a.id === 1)?.lambCount).toBe(2)
    expect(result.find((a) => a.id === 2)?.lambCount).toBe(0)
  })

  it('filters by status while keeping lamb counts', async () => {
    const result = await listAnimals({ status: 'alive' })
    expect(result.map((a) => a.id)).toEqual([1, 3])
    expect(result.find((a) => a.id === 1)?.lambCount).toBe(2)
  })

  it('filters by free-text query across fields', async () => {
    const byNotes = await listAnimals({ q: 'friendly' })
    expect(byNotes.map((a) => a.id)).toEqual([3])
    const byColour = await listAnimals({ q: 'BLACK' })
    expect(byColour.map((a) => a.id)).toEqual([2])
  })
})

describe('listLambsByMother', () => {
  it('queries the mother item collection and sorts by dob', async () => {
    ddbMock
      .on(QueryCommand, { ExpressionAttributeValues: { ':pk': 'ANIMAL#1', ':prefix': 'LAMB#' } })
      .resolves({
        Items: [
          lambItem({ lambId: 'b', motherId: 1, dob: '2026-05-01' }),
          lambItem({ lambId: 'a', motherId: 1, dob: '2026-03-01' })
        ]
      })
    const lambs = await listLambsByMother(1)
    expect(lambs.map((l) => l.lambId)).toEqual(['a', 'b'])
  })
})

describe('getLineage', () => {
  it('walks the mother line upward', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(3) }).resolves({ Item: animalItem({ id: 3, motherId: 2 }) })
    ddbMock.on(GetCommand, { Key: animalKey(2) }).resolves({ Item: animalItem({ id: 2, motherId: 1 }) })
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    const lineage = await getLineage(3)
    expect(lineage.map((a) => a.id)).toEqual([2, 1])
  })

  it('throws 404 when the animal is missing', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(9) }).resolves({})
    await expect(getLineage(9)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('createAnimal', () => {
  it('creates a valid sheep with no mother', async () => {
    ddbMock.on(PutCommand).resolves({})
    const animal = await createAnimal({ id: 10, colour: 'grey', sex: 'ram' })
    expect(animal.id).toBe(10)
    expect(animal.status).toBe('alive')
    expect(animal.motherId).toBeUndefined()
    const call = ddbMock.commandCalls(PutCommand)[0]
    expect(call?.args[0].input.ConditionExpression).toBe('attribute_not_exists(pk)')
  })

  it('rejects a duplicate id with 409', async () => {
    ddbMock.on(PutCommand).rejects(conditionalFailure())
    await expect(createAnimal({ id: 10, colour: 'grey', sex: 'ram' })).rejects.toMatchObject({
      statusCode: 409
    })
  })
})

describe('updateAnimal', () => {
  it('throws 404 when the animal does not exist', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({})
    await expect(updateAnimal(1, { colour: 'x', sex: 'ewe' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('preserves createdAt and motherId, refreshes updatedAt', async () => {
    ddbMock
      .on(GetCommand, { Key: animalKey(1) })
      .resolves({ Item: animalItem({ id: 1, motherId: 5, createdAt: '2020-01-01T00:00:00.000Z' }) })
    ddbMock.on(PutCommand).resolves({})
    const updated = await updateAnimal(1, { colour: 'red', sex: 'ewe' })
    expect(updated.createdAt).toBe('2020-01-01T00:00:00.000Z')
    expect(updated.motherId).toBe(5)
    expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  })
})

describe('createLamb', () => {
  it('creates a lamb under an existing ewe', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1, sex: 'ewe' }) })
    ddbMock.on(PutCommand).resolves({})
    const lamb = await createLamb(1, { sex: 'ram', dob: '2026-03-01' })
    expect(lamb.motherId).toBe(1)
    expect(lamb.promoted).toBe(false)
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item
    expect(item?.gsi1pk).toBe('ALL#LAMB')
    expect(String(item?.sk).startsWith('LAMB#')).toBe(true)
  })

  it('rejects a non-ewe mother with 400', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(2) }).resolves({ Item: animalItem({ id: 2, sex: 'ram' }) })
    await expect(createLamb(2, { sex: 'ewe', dob: '2026-03-01' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects a missing mother with 404', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(9) }).resolves({})
    await expect(createLamb(9, { sex: 'ewe', dob: '2026-03-01' })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('promoteLamb', () => {
  it('creates a sheep and marks the lamb promoted', async () => {
    ddbMock
      .on(GetCommand, { Key: lambKey(1, 'x') })
      .resolves({ Item: lambItem({ lambId: 'x', motherId: 1, sex: 'ewe', dob: '2026-03-01' }) })
    ddbMock.on(PutCommand).resolves({})
    const animal = await promoteLamb(1, 'x', { id: 50, colour: 'red' })
    expect(animal.id).toBe(50)
    expect(animal.sex).toBe('ewe')
    expect(animal.motherId).toBe(1)
    const puts = ddbMock.commandCalls(PutCommand)
    expect(puts).toHaveLength(2)
    expect(puts[1]?.args[0].input.Item?.promoted).toBe(true)
    expect(puts[1]?.args[0].input.Item?.promotedToId).toBe(50)
  })

  it('rejects an already-promoted lamb with 409', async () => {
    ddbMock
      .on(GetCommand, { Key: lambKey(1, 'x') })
      .resolves({ Item: lambItem({ lambId: 'x', motherId: 1, promoted: true, promotedToId: 7 }) })
    await expect(promoteLamb(1, 'x', { id: 50, colour: 'red' })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects a duplicate tag on promotion with 409', async () => {
    ddbMock.on(GetCommand, { Key: lambKey(1, 'x') }).resolves({ Item: lambItem({ lambId: 'x', motherId: 1 }) })
    ddbMock.on(PutCommand).rejects(conditionalFailure())
    await expect(promoteLamb(1, 'x', { id: 50, colour: 'red' })).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('deleteLamb', () => {
  it('deletes an existing lamb', async () => {
    ddbMock.on(GetCommand, { Key: lambKey(1, 'x') }).resolves({ Item: lambItem({ lambId: 'x', motherId: 1 }) })
    ddbMock.on(DeleteCommand).resolves({})
    await deleteLamb(1, 'x')
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1)
  })

  it('throws 404 for a missing lamb', async () => {
    ddbMock.on(GetCommand, { Key: lambKey(1, 'x') }).resolves({})
    await expect(deleteLamb(1, 'x')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('deleteAnimal', () => {
  function onMotherLambs(items: Record<string, unknown>[]): void {
    ddbMock
      .on(QueryCommand, { ExpressionAttributeValues: { ':pk': 'ANIMAL#1', ':prefix': 'LAMB#' } })
      .resolves({ Items: items })
  }

  it('rejects deletion when the ewe has current lambs (409)', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    onMotherLambs([lambItem({ lambId: 'a', motherId: 1 })])
    await expect(deleteAnimal(1)).rejects.toMatchObject({ statusCode: 409 })
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(0)
  })

  it('deletes a sheep and cascades its promoted-history lambs', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    onMotherLambs([lambItem({ lambId: 'a', motherId: 1, promoted: true, promotedToId: 2 })])
    ddbMock.on(DeleteCommand).resolves({})
    await deleteAnimal(1)
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(2)
  })

  it('deletes a childless sheep', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    onMotherLambs([])
    ddbMock.on(DeleteCommand).resolves({})
    await deleteAnimal(1)
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1)
  })

  it('throws 404 for a missing animal', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({})
    await expect(deleteAnimal(1)).rejects.toMatchObject({ statusCode: 404 })
  })
})
