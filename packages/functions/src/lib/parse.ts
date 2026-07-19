import {
  isSex,
  isStatus,
  type AnimalCreateInput,
  type AnimalUpdateInput,
  type LambCreateInput,
  type LambPromoteInput,
  type LambUpdateInput,
  type Sex,
  type Status
} from '@sheep/core'
import { badRequest } from './errors'

export function parseBody(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined || raw.length === 0) {
    throw badRequest('Request body is required')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw badRequest('Request body must be valid JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw badRequest('Request body must be a JSON object')
  }
  return parsed as Record<string, unknown>
}

export function parseIdParam(value: string | undefined): number {
  if (value === undefined || value.length === 0) {
    throw badRequest('id path parameter is required')
  }
  if (!/^\d+$/.test(value)) {
    throw badRequest('id must be a positive integer')
  }
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw badRequest('id must be a positive integer')
  }
  return id
}

export function parseLambIdParam(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw badRequest('lambId path parameter is required')
  }
  return value
}

function requireId(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw badRequest(`${field} must be a positive integer`)
  }
  return value
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${field} is required`)
  }
  return value.trim()
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw badRequest(`${field} must be a string`)
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function optionalDate(value: unknown, field: string): string | undefined {
  const str = optionalString(value, field)
  if (str === undefined) return undefined
  if (!/^\d{4}-\d{2}-\d{2}/.test(str) || Number.isNaN(Date.parse(str))) {
    throw badRequest(`${field} must be an ISO date (YYYY-MM-DD)`)
  }
  return str
}

function requireDate(value: unknown, field: string): string {
  const str = requireString(value, field)
  if (!/^\d{4}-\d{2}-\d{2}/.test(str) || Number.isNaN(Date.parse(str))) {
    throw badRequest(`${field} must be an ISO date (YYYY-MM-DD)`)
  }
  return str
}

function parseSex(value: unknown): Sex {
  if (!isSex(value)) {
    throw badRequest('sex must be one of: ewe, ram, wether')
  }
  return value
}

function parseStatus(value: unknown): Status | undefined {
  if (value === undefined || value === null) return undefined
  if (!isStatus(value)) {
    throw badRequest('status must be one of: alive, sold, deceased')
  }
  return value
}

export function parseCreateInput(body: Record<string, unknown>): AnimalCreateInput {
  return {
    id: requireId(body.id, 'id'),
    colour: requireString(body.colour, 'colour'),
    sex: parseSex(body.sex),
    breed: optionalString(body.breed, 'breed'),
    dob: optionalDate(body.dob, 'dob'),
    status: parseStatus(body.status),
    notes: optionalString(body.notes, 'notes')
  }
}

export function parseUpdateInput(body: Record<string, unknown>): AnimalUpdateInput {
  return {
    colour: requireString(body.colour, 'colour'),
    sex: parseSex(body.sex),
    breed: optionalString(body.breed, 'breed'),
    dob: optionalDate(body.dob, 'dob'),
    status: parseStatus(body.status),
    notes: optionalString(body.notes, 'notes')
  }
}

export function parseLambCreateInput(body: Record<string, unknown>): LambCreateInput {
  return {
    sex: parseSex(body.sex),
    dob: requireDate(body.dob, 'dob')
  }
}

export function parseLambUpdateInput(body: Record<string, unknown>): LambUpdateInput {
  return parseLambCreateInput(body)
}

export function parseLambPromoteInput(body: Record<string, unknown>): LambPromoteInput {
  return {
    id: requireId(body.id, 'id'),
    colour: requireString(body.colour, 'colour'),
    breed: optionalString(body.breed, 'breed'),
    notes: optionalString(body.notes, 'notes')
  }
}
