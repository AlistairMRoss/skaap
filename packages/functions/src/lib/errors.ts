import type { ApiErrorCode } from '@sheep/core'

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ApiErrorCode

  constructor(statusCode: number, code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function badRequest(message: string): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message)
}

export function unauthorized(message: string): AppError {
  return new AppError(401, 'UNAUTHORIZED', message)
}

export function forbidden(message: string): AppError {
  return new AppError(403, 'FORBIDDEN', message)
}

export function notFound(message: string): AppError {
  return new AppError(404, 'NOT_FOUND', message)
}

export function conflict(message: string): AppError {
  return new AppError(409, 'CONFLICT', message)
}
