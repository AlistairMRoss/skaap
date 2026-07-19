import { beforeEach, describe, expect, it } from 'vitest'
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { ddb } from '../db/client'
import { handler as listHandler } from './list'
import { handler as getHandler } from './get'
import { handler as createHandler } from './create'
import { handler as deleteHandler } from './delete'
import { handler as addLambHandler } from './addLamb'
import { handler as promoteLambHandler } from './promoteLamb'
import { animalItem, bodyOf, lambItem, makeEvent } from '../test-support'
import { animalKey, lambKey } from '../lib/keys'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

function onMotherLambs(motherId: number, items: Record<string, unknown>[]): void {
  ddbMock
    .on(QueryCommand, { ExpressionAttributeValues: { ':pk': `ANIMAL#${motherId}`, ':prefix': 'LAMB#' } })
    .resolves({ Items: items })
}

describe('authorization gate', () => {
  it('returns 403 for a non-admin user', async () => {
    const res = await listHandler(makeEvent({ roles: ['user'] }))
    expect(res.statusCode).toBe(403)
    expect(bodyOf(res)).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('returns 401 when no user context is present', async () => {
    const res = await listHandler(makeEvent({ userId: null }))
    expect(res.statusCode).toBe(401)
  })
})

describe('GET /animals', () => {
  it('lists animals for an admin', async () => {
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':pk': 'ALL#ANIMAL' } }).resolves({ Items: [animalItem({ id: 1 })] })
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':pk': 'ALL#LAMB' } }).resolves({ Items: [] })
    const res = await listHandler(makeEvent({ queryStringParameters: {} }))
    expect(res.statusCode).toBe(200)
    expect(bodyOf(res)).toMatchObject({ animals: [{ id: 1, lambCount: 0 }] })
  })

  it('rejects an invalid status filter with 400', async () => {
    const res = await listHandler(makeEvent({ queryStringParameters: { status: 'bogus' } }))
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /animals', () => {
  it('creates an animal and returns 201', async () => {
    ddbMock.on(PutCommand).resolves({})
    const res = await createHandler(makeEvent({ body: { id: 7, colour: 'white', sex: 'ewe' } }))
    expect(res.statusCode).toBe(201)
    expect(bodyOf(res)).toMatchObject({ animal: { id: 7, status: 'alive' } })
  })

  it('returns 400 for an invalid payload', async () => {
    const res = await createHandler(makeEvent({ body: { colour: 'white', sex: 'ewe' } }))
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for a missing body', async () => {
    const res = await createHandler(makeEvent({}))
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /animals/{id}', () => {
  it('returns 404 for a missing animal', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(99) }).resolves({})
    const res = await getHandler(makeEvent({ pathParameters: { id: '99' } }))
    expect(res.statusCode).toBe(404)
  })

  it('returns detail with lambs and lineage', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    onMotherLambs(1, [lambItem({ lambId: 'a', motherId: 1 })])
    const res = await getHandler(makeEvent({ pathParameters: { id: '1' } }))
    expect(res.statusCode).toBe(200)
    expect(bodyOf(res)).toMatchObject({ animal: { id: 1 }, lambs: [{ lambId: 'a' }], lineage: [] })
  })

  it('returns 400 for a non-numeric id', async () => {
    const res = await getHandler(makeEvent({ pathParameters: { id: 'abc' } }))
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /animals/{id}', () => {
  it('returns 409 when the ewe has current lambs', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    onMotherLambs(1, [lambItem({ lambId: 'a', motherId: 1 })])
    const res = await deleteHandler(makeEvent({ pathParameters: { id: '1' } }))
    expect(res.statusCode).toBe(409)
    expect(bodyOf(res)).toMatchObject({ error: { code: 'CONFLICT' } })
  })
})

describe('POST /animals/{id}/lambs', () => {
  it('adds a lamb to a ewe and returns 201', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1, sex: 'ewe' }) })
    ddbMock.on(PutCommand).resolves({})
    const res = await addLambHandler(
      makeEvent({ pathParameters: { id: '1' }, body: { sex: 'ram', dob: '2026-03-01' } })
    )
    expect(res.statusCode).toBe(201)
    expect(bodyOf(res)).toMatchObject({ lamb: { motherId: 1, promoted: false } })
  })

  it('returns 400 when adding a lamb to a non-ewe', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(2) }).resolves({ Item: animalItem({ id: 2, sex: 'ram' }) })
    const res = await addLambHandler(
      makeEvent({ pathParameters: { id: '2' }, body: { sex: 'ram', dob: '2026-03-01' } })
    )
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /animals/{id}/lambs/{lambId}/promote', () => {
  it('promotes a lamb and returns 201', async () => {
    ddbMock
      .on(GetCommand, { Key: lambKey(1, 'x') })
      .resolves({ Item: lambItem({ lambId: 'x', motherId: 1, sex: 'ewe', dob: '2026-03-01' }) })
    ddbMock.on(PutCommand).resolves({})
    const res = await promoteLambHandler(
      makeEvent({ pathParameters: { id: '1', lambId: 'x' }, body: { id: 50, colour: 'red' } })
    )
    expect(res.statusCode).toBe(201)
    expect(bodyOf(res)).toMatchObject({ animal: { id: 50, motherId: 1 } })
  })
})
