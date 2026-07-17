import type { Sex, Status } from '@sheep/core'

export const SEX_LABELS: Record<Sex, string> = {
  ewe: 'Ewe',
  ram: 'Ram',
  wether: 'Wether'
}

export const STATUS_LABELS: Record<Status, string> = {
  alive: 'Alive',
  sold: 'Sold',
  deceased: 'Deceased'
}

export function statusBadgeClass(status: Status): string {
  switch (status) {
    case 'alive':
      return 'bg-green-100 text-green-800'
    case 'sold':
      return 'bg-amber-100 text-amber-800'
    case 'deceased':
      return 'bg-slate-200 text-slate-700'
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
