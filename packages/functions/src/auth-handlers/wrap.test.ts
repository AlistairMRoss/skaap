import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context } from 'aws-lambda'
import { hasRefreshCookie, wrap, wrapWhen } from './wrap'

type Inner = Parameters<typeof wrap>[0]
type AuthEvent = Parameters<Inner>[0]

const CONTEXT = { awsRequestId: 'req-1' } as Context

function refreshEvent(overrides: Partial<AuthEvent> = {}): AuthEvent {
  return {
    version: '2.0',
    routeKey: 'POST /auth/refresh',
    rawPath: '/auth/refresh',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lastUser: { userId: 'u_8821', email: 'jo@acme.io' } }),
    isBase64Encoded: false,
    requestContext: {
      accountId: '1',
      apiId: 'api',
      domainName: 'auth.example.com',
      domainPrefix: 'auth',
      http: {
        method: 'POST',
        path: '/auth/refresh',
        protocol: 'HTTP/1.1',
        sourceIp: '41.13.8.22',
        userAgent: 'Mozilla/5.0'
      },
      requestId: 'req-1',
      routeKey: 'POST /auth/refresh',
      stage: '$default',
      time: '28/Sep/2026:12:00:00 +0000',
      timeEpoch: 0
    },
    ...overrides
  }
}

const rejected: Inner = async () => ({ statusCode: 401, body: '{"success":false}' })

function captureLines(): string[] {
  const lines: string[] = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  })
  return lines
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('hasRefreshCookie', () => {
  it('finds the cookie in the v2 cookies array', () => {
    expect(hasRefreshCookie(refreshEvent({ cookies: ['theme=dark', 'refreshToken=abc'] }), 'refreshToken')).toBe(true)
  })

  it('finds the cookie in a Cookie header', () => {
    const event = refreshEvent({ headers: { cookie: 'theme=dark; refreshToken=abc' } })
    expect(hasRefreshCookie(event, 'refreshToken')).toBe(true)
  })

  it('ignores missing, empty and differently named cookies', () => {
    expect(hasRefreshCookie(refreshEvent(), 'refreshToken')).toBe(false)
    expect(hasRefreshCookie(refreshEvent({ cookies: ['refreshToken='] }), 'refreshToken')).toBe(false)
    expect(hasRefreshCookie(refreshEvent({ cookies: ['otherToken=abc'] }), 'refreshToken')).toBe(false)
  })
})

describe('wrapWhen on the refresh route', () => {
  const main = wrapWhen(rejected, (event) => hasRefreshCookie(event, 'refreshToken'))

  it('captures a rejected refresh that carried a session cookie, including the last-user hint', async () => {
    const lines = captureLines()
    const res = await main(refreshEvent({ cookies: ['refreshToken=abc'] }), CONTEXT)
    expect(res.statusCode).toBe(401)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('whatwentwrong:request-context')
    expect(lines[0]).toContain('u_8821')
    expect(lines[0]).toContain('jo@acme.io')
    expect(lines[0]).not.toContain('refreshToken=abc')
  })

  it('stays silent for an anonymous page load with no cookie', async () => {
    const lines = captureLines()
    const res = await main(refreshEvent(), CONTEXT)
    expect(res.statusCode).toBe(401)
    expect(lines).toHaveLength(0)
  })
})

describe('wrap', () => {
  it('passes the lambda context through to the inner handler', async () => {
    const inner = vi.fn<Inner>(async () => ({ statusCode: 200, body: '' }))
    await wrap(inner)(refreshEvent(), CONTEXT)
    expect(inner).toHaveBeenCalledWith(expect.anything(), CONTEXT)
  })
})
