import { describe, expect, it } from 'vitest'
import { AppError } from './errors'
import { getRoles, requireAdmin } from './auth'
import { makeEvent } from '../test-support'

describe('getRoles', () => {
  it('parses the JSON roles array', () => {
    expect(getRoles(makeEvent({ roles: ['user', 'admin'] }))).toEqual(['user', 'admin'])
  })

  it('returns empty array for malformed roles', () => {
    const event = makeEvent()
    ;(event.requestContext.authorizer.lambda as { roles: string }).roles = 'not-json'
    expect(getRoles(event)).toEqual([])
  })
})

describe('requireAdmin', () => {
  it('returns userId for an admin', () => {
    expect(requireAdmin(makeEvent({ roles: ['admin'], userId: 'u9' }))).toEqual({ userId: 'u9' })
  })

  it('throws 403 for a non-admin', () => {
    try {
      requireAdmin(makeEvent({ roles: ['user'] }))
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).statusCode).toBe(403)
    }
  })

  it('throws 401 when no userId is present', () => {
    try {
      requireAdmin(makeEvent({ userId: null, roles: ['admin'] }))
      expect.unreachable()
    } catch (err) {
      expect((err as AppError).statusCode).toBe(401)
    }
  })
})
