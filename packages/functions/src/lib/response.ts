import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import type { ApiErrorCode } from '@sheep/core'

const JSON_HEADERS: Record<string, string> = { 'content-type': 'application/json' }

export function json(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) }
}

export function ok(body: unknown): APIGatewayProxyStructuredResultV2 {
  return json(200, body)
}

export function created(body: unknown): APIGatewayProxyStructuredResultV2 {
  return json(201, body)
}

export function fail(statusCode: number, code: ApiErrorCode, message: string): APIGatewayProxyStructuredResultV2 {
  return json(statusCode, { error: { code, message } })
}
