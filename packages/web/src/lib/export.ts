import type { WorkBook } from 'xlsx'
import type { AnimalListItem, Status } from '@sheep/core'

export interface ExportFilter {
  status?: Status
  q?: string
}

export const EXPORT_HEADERS = [
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
] as const

export type ExportCell = string | number

export function animalsToRows(animals: AnimalListItem[]): ExportCell[][] {
  return animals.map((animal) => [
    animal.id,
    animal.colour,
    animal.sex,
    animal.breed ?? '',
    animal.dob ?? '',
    animal.motherId ?? '',
    animal.fatherId ?? '',
    animal.status,
    animal.lambCount,
    animal.notes ?? ''
  ])
}

export async function buildWorkbook(animals: AnimalListItem[]): Promise<WorkBook> {
  const XLSX = await import('xlsx')
  const aoa: ExportCell[][] = [[...EXPORT_HEADERS], ...animalsToRows(animals)]
  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Animals')
  return workbook
}

export function exportFilename(filter: ExportFilter, date: string): string {
  const parts = ['skaap']
  if (filter.status) parts.push(filter.status)
  if (filter.q && filter.q.trim().length > 0) parts.push('search')
  parts.push(date)
  return `${parts.join('-')}.xlsx`
}

export async function downloadAnimalsXlsx(
  animals: AnimalListItem[],
  filter: ExportFilter,
  date: string
): Promise<void> {
  const XLSX = await import('xlsx')
  const workbook = await buildWorkbook(animals)
  XLSX.writeFile(workbook, exportFilename(filter, date))
}
