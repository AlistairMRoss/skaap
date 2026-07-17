import { beforeEach, describe, expect, it } from 'vitest'
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { ddb } from './client'
import {
  createAnimal,
  deleteAnimal,
  getLineage,
  listAnimals,
  listLambs,
  updateAnimal
} from './animals'
import { AppError } from '../lib/errors'
import { animalItem, conditionalFailure } from '../test-support'
import { animalKey } from '../lib/keys'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

describe('listAnimals', () => {
  const flock = [
    animalItem({ id: 1, colour: 'white', status: 'alive' }),
    animalItem({ id: 2, colour: 'black', status: 'sold', motherId: 1 }),
    animalItem({ id: 3, colour: 'brown', status: 'alive', motherId: 1, notes: 'friendly' })
  ]

  it('returns all animals with computed lamb counts', async () => {
    ddbMock.on(QueryCommand, { IndexName: 'gsi1' }).resolves({ Items: flock })
    const result = await listAnimals()
    expect(result.map((a) => a.id)).toEqual([1, 2, 3])
    expect(result.find((a) => a.id === 1)?.lambCount).toBe(2)
    expect(result.find((a) => a.id === 2)?.lambCount).toBe(0)
  })

  it('filters by status while keeping lamb counts from the full flock', async () => {
    ddbMock.on(QueryCommand, { IndexName: 'gsi1' }).resolves({ Items: flock })
    const result = await listAnimals({ status: 'alive' })
    expect(result.map((a) => a.id)).toEqual([1, 3])
    expect(result.find((a) => a.id === 1)?.lambCount).toBe(2)
  })

  it('filters by free-text query across fields', async () => {
    ddbMock.on(QueryCommand, { IndexName: 'gsi1' }).resolves({ Items: flock })
    const byNotes = await listAnimals({ q: 'friendly' })
    expect(byNotes.map((a) => a.id)).toEqual([3])
    const byColour = await listAnimals({ q: 'BLACK' })
    expect(byColour.map((a) => a.id)).toEqual([2])
  })
})

describe('listLambs', () => {
  it('queries GSI2 by mother', async () => {
    ddbMock
      .on(QueryCommand, { IndexName: 'gsi2' })
      .resolves({ Items: [animalItem({ id: 2, motherId: 1 }), animalItem({ id: 4, motherId: 1 })] })
    const lambs = await listLambs(1)
    expect(lambs.map((l) => l.id)).toEqual([2, 4])
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
  it('creates a valid animal', async () => {
    ddbMock.on(PutCommand).resolves({})
    const animal = await createAnimal({ id: 10, colour: 'grey', sex: 'ram' })
    expect(animal.id).toBe(10)
    expect(animal.status).toBe('alive')
    const call = ddbMock.commandCalls(PutCommand)[0]
    expect(call?.args[0].input.ConditionExpression).toBe('attribute_not_exists(pk)')
  })

  it('rejects a duplicate id with 409', async () => {
    ddbMock.on(PutCommand).rejects(conditionalFailure())
    await expect(createAnimal({ id: 10, colour: 'grey', sex: 'ram' })).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('rejects self as mother with 400', async () => {
    await expect(createAnimal({ id: 5, colour: 'x', sex: 'ewe', motherId: 5 })).rejects.toBeInstanceOf(AppError)
  })

  it('rejects a non-existent motherId with 400', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(99) }).resolves({})
    await expect(
      createAnimal({ id: 5, colour: 'x', sex: 'ewe', motherId: 99 })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('writes GSI2 keys when motherId is present', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    ddbMock.on(PutCommand).resolves({})
    await createAnimal({ id: 6, colour: 'x', sex: 'ewe', motherId: 1 })
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item
    expect(item?.gsi2pk).toBe('MOTHER#1')
    expect(item?.gsi2sk).toBe('ANIMAL#6')
  })
})

describe('updateAnimal', () => {
  it('throws 404 when the animal does not exist', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({})
    await expect(updateAnimal(1, { colour: 'x', sex: 'ewe' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('preserves createdAt and refreshes updatedAt', async () => {
    ddbMock
      .on(GetCommand, { Key: animalKey(1) })
      .resolves({ Item: animalItem({ id: 1, createdAt: '2020-01-01T00:00:00.000Z' }) })
    ddbMock.on(PutCommand).resolves({})
    const updated = await updateAnimal(1, { colour: 'red', sex: 'ewe' })
    expect(updated.createdAt).toBe('2020-01-01T00:00:00.000Z')
    expect(updated.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  })

  it('rejects a mother-line cycle with 400', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1, motherId: undefined }) })
    ddbMock.on(GetCommand, { Key: animalKey(3) }).resolves({ Item: animalItem({ id: 3, motherId: 2 }) })
    ddbMock.on(GetCommand, { Key: animalKey(2) }).resolves({ Item: animalItem({ id: 2, motherId: 1 }) })
    await expect(updateAnimal(1, { colour: 'x', sex: 'ewe', motherId: 3 })).rejects.toMatchObject({
      statusCode: 400
    })
  })
})

describe('deleteAnimal', () => {
  it('rejects deletion when the animal has lambs (409)', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    ddbMock.on(QueryCommand, { IndexName: 'gsi2' }).resolves({ Items: [animalItem({ id: 2, motherId: 1 })] })
    await expect(deleteAnimal(1)).rejects.toMatchObject({ statusCode: 409 })
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(0)
  })

  it('deletes a childless animal', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    ddbMock.on(QueryCommand, { IndexName: 'gsi2' }).resolves({ Items: [] })
    ddbMock.on(DeleteCommand).resolves({})
    await deleteAnimal(1)
    expect(ddbMock.commandCalls(DeleteCommand)).toHaveLength(1)
  })

  it('throws 404 for a missing animal', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({})
    await expect(deleteAnimal(1)).rejects.toMatchObject({ statusCode: 404 })
  })
})
