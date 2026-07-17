import { describe, expect, it } from 'vitest'
import { AppError } from './errors'
import { parseBody, parseCreateInput, parseIdParam, parseUpdateInput } from './parse'

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
      motherId: 2,
      fatherId: 3,
      status: 'alive',
      notes: 'healthy'
    })
    expect(input).toEqual({
      id: 1,
      colour: 'blue',
      sex: 'ewe',
      breed: 'Merino',
      dob: '2025-04-01',
      motherId: 2,
      fatherId: 3,
      status: 'alive',
      notes: 'healthy'
    })
  })

  it('defaults optional fields to undefined', () => {
    const input = parseCreateInput({ id: 5, colour: 'black', sex: 'ram' })
    expect(input.status).toBeUndefined()
    expect(input.motherId).toBeUndefined()
    expect(input.breed).toBeUndefined()
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

  it('rejects a non-integer motherId', () => {
    expect(() => parseCreateInput({ id: 1, colour: 'x', sex: 'ewe', motherId: 1.5 })).toThrow(AppError)
  })
})

describe('parseUpdateInput', () => {
  it('does not accept an id field', () => {
    const input = parseUpdateInput({ id: 99, colour: 'x', sex: 'ewe' })
    expect('id' in input).toBe(false)
  })
})
