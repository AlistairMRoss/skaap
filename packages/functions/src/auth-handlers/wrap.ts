import type { Context } from 'aws-lambda'
import { captureRequest } from 'whatwentwrong/capture'
import type { Handler } from '../../../../node_modules/@alistairmross/auth/dist/src/backend/middleware/compose'

type AuthEvent = Parameters<Handler>[0]

const DEFAULT_COOKIE_NAME = 'refreshToken'

export function wrap(inner: Handler): Handler {
  return captureRequest(
    (event: AuthEvent, context?: unknown) => inner(event, context as Context),
    {}
  )
}

export function wrapWhen(inner: Handler, shouldCapture: (event: AuthEvent) => boolean): Handler {
  const captured = wrap(inner)
  return (event, context) => (shouldCapture(event) ? captured(event, context) : inner(event, context))
}

export function hasRefreshCookie(event: AuthEvent, cookieName: string = cookieNameFromEnv()): boolean {
  const prefix = `${cookieName}=`
  const fromArray = event.cookies ?? []
  if (fromArray.some((cookie) => cookie.trim().startsWith(prefix) && cookie.trim().length > prefix.length)) {
    return true
  }
  const header = event.headers?.cookie ?? event.headers?.Cookie
  if (!header) return false
  return header
    .split(';')
    .map((part) => part.trim())
    .some((part) => part.startsWith(prefix) && part.length > prefix.length)
}

function cookieNameFromEnv(): string {
  const configured = process.env.COOKIE_NAME
  return configured && configured.length > 0 ? configured : DEFAULT_COOKIE_NAME
}
