import type { APIGatewayProxyEventV2WithLambdaAuthorizer } from 'aws-lambda'
import { forbidden, unauthorized } from './errors'

export interface AuthContext {
  userId: string
  roles: string
}

export type AuthedEvent = APIGatewayProxyEventV2WithLambdaAuthorizer<AuthContext>

export function getRoles(event: AuthedEvent): string[] {
  const raw = event.requestContext.authorizer?.lambda?.roles
  if (typeof raw !== 'string' || raw.length === 0) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((role): role is string => typeof role === 'string')
  } catch {
    return []
  }
}

export function requireAdmin(event: AuthedEvent): { userId: string } {
  const userId = event.requestContext.authorizer?.lambda?.userId
  if (typeof userId !== 'string' || userId.length === 0) {
    throw unauthorized('Authentication required')
  }
  if (!getRoles(event).includes('admin')) {
    throw forbidden('Admin role required')
  }
  return { userId }
}
