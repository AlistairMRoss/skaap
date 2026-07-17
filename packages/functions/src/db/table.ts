import { Resource } from 'sst'

export function tableName(): string {
  return Resource.SheepTracker.name
}

export const GSI1_NAME = 'gsi1'
export const GSI2_NAME = 'gsi2'
