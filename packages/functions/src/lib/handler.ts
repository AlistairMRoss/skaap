import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { AppError } from './errors'
import { fail } from './response'
import { requireAdmin, type AuthedEvent } from './auth'

export type AdminHandler = (
  event: AuthedEvent,
  ctx: { userId: string }
) => Promise<APIGatewayProxyStructuredResultV2>

export function withAdmin(fn: AdminHandler): (event: AuthedEvent) => Promise<APIGatewayProxyStructuredResultV2> {
  return async (event: AuthedEvent): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
      const ctx = requireAdmin(event)
      return await fn(event, ctx)
    } catch (err) {
      if (err instanceof AppError) {
        return fail(err.statusCode, err.code, err.message)
      }
      console.error('Unhandled error', err)
      return fail(500, 'INTERNAL_ERROR', 'Internal server error')
    }
  }
}
