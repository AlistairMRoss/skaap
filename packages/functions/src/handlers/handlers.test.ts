import { beforeEach, describe, expect, it } from 'vitest'
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { ddb } from '../db/client'
import { handler as listHandler } from './list'
import { handler as getHandler } from './get'
import { handler as createHandler } from './create'
import { handler as deleteHandler } from './delete'
import { animalItem, bodyOf, makeEvent } from '../test-support'
import { animalKey } from '../lib/keys'

const ddbMock = mockClient(ddb)

beforeEach(() => {
  ddbMock.reset()
})

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
    ddbMock.on(QueryCommand, { IndexName: 'gsi1' }).resolves({ Items: [animalItem({ id: 1 })] })
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
    ddbMock.on(QueryCommand, { IndexName: 'gsi2' }).resolves({ Items: [animalItem({ id: 2, motherId: 1 })] })
    const res = await getHandler(makeEvent({ pathParameters: { id: '1' } }))
    expect(res.statusCode).toBe(200)
    expect(bodyOf(res)).toMatchObject({ animal: { id: 1 }, lambs: [{ id: 2 }], lineage: [] })
  })

  it('returns 400 for a non-numeric id', async () => {
    const res = await getHandler(makeEvent({ pathParameters: { id: 'abc' } }))
    expect(res.statusCode).toBe(400)
  })
})

describe('DELETE /animals/{id}', () => {
  it('returns 409 when the animal has lambs', async () => {
    ddbMock.on(GetCommand, { Key: animalKey(1) }).resolves({ Item: animalItem({ id: 1 }) })
    ddbMock.on(QueryCommand, { IndexName: 'gsi2' }).resolves({ Items: [animalItem({ id: 2, motherId: 1 })] })
    const res = await deleteHandler(makeEvent({ pathParameters: { id: '1' } }))
    expect(res.statusCode).toBe(409)
    expect(bodyOf(res)).toMatchObject({ error: { code: 'CONFLICT' } })
  })
})
