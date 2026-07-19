import type { Animal, Lamb } from '@sheep/core'
import type { AuthedEvent } from './lib/auth'
import { ALL_LAMB_GSI1_PK, GSI1_PK, animalKey, lambKey, padId } from './lib/keys'

interface EventOptions {
  roles?: string[]
  userId?: string | null
  body?: unknown
  pathParameters?: Record<string, string>
  queryStringParameters?: Record<string, string>
}

export function makeEvent(options: EventOptions = {}): AuthedEvent {
  const { roles = ['admin'], userId = 'user-1', body, pathParameters, queryStringParameters } = options
  const lambda: Record<string, string> = { roles: JSON.stringify(roles) }
  if (userId !== null) lambda.userId = userId
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: {},
    requestContext: {
      authorizer: { lambda }
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    pathParameters,
    queryStringParameters,
    isBase64Encoded: false
  } as unknown as AuthedEvent
}

export function animalItem(partial: Partial<Animal> & { id: number }): Record<string, unknown> {
  const item: Record<string, unknown> = {
    ...animalKey(partial.id),
    gsi1pk: GSI1_PK,
    gsi1sk: padId(partial.id),
    id: partial.id,
    colour: partial.colour ?? 'white',
    sex: partial.sex ?? 'ewe',
    status: partial.status ?? 'alive',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-01T00:00:00.000Z'
  }
  if (partial.breed !== undefined) item.breed = partial.breed
  if (partial.dob !== undefined) item.dob = partial.dob
  if (partial.notes !== undefined) item.notes = partial.notes
  if (partial.motherId !== undefined) item.motherId = partial.motherId
  return item
}

export function lambItem(partial: Partial<Lamb> & { lambId: string; motherId: number }): Record<string, unknown> {
  const item: Record<string, unknown> = {
    ...lambKey(partial.motherId, partial.lambId),
    gsi1pk: ALL_LAMB_GSI1_PK,
    gsi1sk: partial.lambId,
    lambId: partial.lambId,
    motherId: partial.motherId,
    sex: partial.sex ?? 'ewe',
    dob: partial.dob ?? '2026-03-01',
    promoted: partial.promoted ?? false,
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-01T00:00:00.000Z'
  }
  if (partial.promotedToId !== undefined) item.promotedToId = partial.promotedToId
  return item
}

export function conditionalFailure(): Error {
  return Object.assign(new Error('The conditional request failed'), {
    name: 'ConditionalCheckFailedException'
  })
}

export function bodyOf(result: { body?: string }): Record<string, unknown> {
  return JSON.parse(result.body ?? '{}') as Record<string, unknown>
}
