import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { AnimalListItem } from '@sheep/core'
import { animalsToRows, buildWorkbook, exportFilename } from './export'

const animals: AnimalListItem[] = [
  {
    id: 12,
    colour: 'blue',
    sex: 'ewe',
    breed: 'Merino',
    dob: '2025-03-01',
    motherId: 3,
    fatherId: 4,
    status: 'alive',
    notes: 'friendly',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lambCount: 2
  },
  {
    id: 13,
    colour: 'red',
    sex: 'ram',
    status: 'sold',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lambCount: 0
  }
]

describe('animalsToRows', () => {
  it('maps every column in order', () => {
    expect(animalsToRows(animals)[0]).toEqual([12, 'blue', 'ewe', 'Merino', '2025-03-01', 3, 4, 'alive', 2, 'friendly'])
  })

  it('renders optional fields as empty strings', () => {
    expect(animalsToRows(animals)[1]).toEqual([13, 'red', 'ram', '', '', '', '', 'sold', 0, ''])
  })
})

describe('buildWorkbook', () => {
  it('honours exactly the passed-in filtered set', async () => {
    const workbook = await buildWorkbook([animals[0]!])
    const sheet = workbook.Sheets['Animals']!
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
    expect(rows[0]).toEqual([
      'ID',
      'Colour',
      'Sex',
      'Breed',
      'DOB',
      'Mother tag',
      'Father tag',
      'Status',
      'Lamb count',
      'Notes'
    ])
    expect(rows).toHaveLength(2)
    expect(rows[1]?.[0]).toBe(12)
  })
})

describe('exportFilename', () => {
  it('includes the date only when no filter is active', () => {
    expect(exportFilename({}, '2026-07-16')).toBe('skaap-2026-07-16.xlsx')
  })

  it('includes a status hint', () => {
    expect(exportFilename({ status: 'alive' }, '2026-07-16')).toBe('skaap-alive-2026-07-16.xlsx')
  })

  it('includes a search hint when a query is set', () => {
    expect(exportFilename({ q: 'merino' }, '2026-07-16')).toBe('skaap-search-2026-07-16.xlsx')
  })
})
