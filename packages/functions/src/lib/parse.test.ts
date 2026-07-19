import { describe, expect, it } from 'vitest'
import { AppError } from './errors'
import {
  parseBody,
  parseCreateInput,
  parseIdParam,
  parseLambCreateInput,
  parseLambIdParam,
  parseLambPromoteInput,
  parseUpdateInput
} from './parse'

describe('parseIdParam', () => {
  it('parses a positive integer', () => {
    expect(parseIdParam('42')).toBe(42)
  })

  it.each(['', undefined, 'abc', '-1', '1.5', '0'])('rejects %s', (value) => {
    expect(() => parseIdParam(value)).toThrow(AppError)
  })
})

describe('parseBody', () => {
  it('parses a JSON object', () => {
    expect(parseBody('{"a":1}')).toEqual({ a: 1 })
  })

  it('rejects missing body', () => {
    expect(() => parseBody(undefined)).toThrow(AppError)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseBody('{bad')).toThrow(AppError)
  })

  it('rejects non-object JSON', () => {
    expect(() => parseBody('[1,2]')).toThrow(AppError)
  })
})

describe('parseCreateInput', () => {
  it('accepts a full valid payload', () => {
    const input = parseCreateInput({
      id: 1,
      colour: ' blue ',
      sex: 'ewe',
      breed: 'Merino',
      dob: '2025-04-01',
      status: 'alive',
      notes: 'healthy'
    })
    expect(input).toEqual({
      id: 1,
      colour: 'blue',
      sex: 'ewe',
      breed: 'Merino',
      dob: '2025-04-01',
      status: 'alive',
      notes: 'healthy'
    })
  })

  it('defaults optional fields to undefined', () => {
    const input = parseCreateInput({ id: 5, colour: 'black', sex: 'ram' })
    expect(input.status).toBeUndefined()
    expect(input.breed).toBeUndefined()
    expect(input.dob).toBeUndefined()
  })

  it('rejects a missing id', () => {
    expect(() => parseCreateInput({ colour: 'x', sex: 'ewe' })).toThrow(AppError)
  })

  it('rejects an invalid sex', () => {
    expect(() => parseCreateInput({ id: 1, colour: 'x', sex: 'goat' })).toThrow(AppError)
  })

  it('rejects an invalid status', () => {
    expect(() => parseCreateInput({ id: 1, colour: 'x', sex: 'ewe', status: 'napping' })).toThrow(AppError)
  })

  it('rejects a malformed dob', () => {
    expect(() => parseCreateInput({ id: 1, colour: 'x', sex: 'ewe', dob: 'last spring' })).toThrow(AppError)
  })
})

describe('parseUpdateInput', () => {
  it('does not accept an id field', () => {
    const input = parseUpdateInput({ id: 99, colour: 'x', sex: 'ewe' })
    expect('id' in input).toBe(false)
  })
})

describe('parseLambIdParam', () => {
  it('accepts a non-empty id', () => {
    expect(parseLambIdParam('abc-123')).toBe('abc-123')
  })

  it.each(['', '   ', undefined])('rejects %s', (value) => {
    expect(() => parseLambIdParam(value)).toThrow(AppError)
  })
})

describe('parseLambCreateInput', () => {
  it('requires sex and dob', () => {
    expect(parseLambCreateInput({ sex: 'ewe', dob: '2026-03-01' })).toEqual({ sex: 'ewe', dob: '2026-03-01' })
  })

  it('rejects a missing dob', () => {
    expect(() => parseLambCreateInput({ sex: 'ewe' })).toThrow(AppError)
  })

  it('rejects an invalid sex', () => {
    expect(() => parseLambCreateInput({ sex: 'goat', dob: '2026-03-01' })).toThrow(AppError)
  })
})

describe('parseLambPromoteInput', () => {
  it('requires a tag id and colour', () => {
    const input = parseLambPromoteInput({ id: 42, colour: ' red ', notes: 'strong' })
    expect(input).toEqual({ id: 42, colour: 'red', breed: undefined, notes: 'strong' })
  })

  it('rejects a missing colour', () => {
    expect(() => parseLambPromoteInput({ id: 42 })).toThrow(AppError)
  })

  it('rejects a non-integer id', () => {
    expect(() => parseLambPromoteInput({ id: 1.5, colour: 'red' })).toThrow(AppError)
  })
})
