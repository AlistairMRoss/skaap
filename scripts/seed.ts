import { randomUUID } from 'crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Resource } from 'sst'
import type { Animal, Lamb } from '@sheep/core'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
})

function padId(id: number): string {
  return id.toString().padStart(10, '0')
}

function toAnimalItem(animal: Animal): Record<string, unknown> {
  const pk = `ANIMAL#${animal.id}`
  return {
    pk,
    sk: pk,
    gsi1pk: 'ALL#ANIMAL',
    gsi1sk: padId(animal.id),
    ...animal
  }
}

function toLambItem(lamb: Lamb): Record<string, unknown> {
  return {
    pk: `ANIMAL#${lamb.motherId}`,
    sk: `LAMB#${lamb.lambId}`,
    gsi1pk: 'ALL#LAMB',
    gsi1sk: lamb.lambId,
    ...lamb
  }
}

const now = new Date().toISOString()

const animals: Animal[] = [
  { id: 100, colour: 'yellow', sex: 'ewe', breed: 'Merino', dob: '2019-03-10', status: 'alive', notes: 'Matriarch', createdAt: now, updatedAt: now },
  { id: 101, colour: 'blue', sex: 'ewe', breed: 'Merino', dob: '2021-04-02', motherId: 100, status: 'alive', createdAt: now, updatedAt: now },
  { id: 102, colour: 'green', sex: 'ram', breed: 'Merino', dob: '2023-03-28', motherId: 101, status: 'alive', createdAt: now, updatedAt: now }
]

const lambs: Lamb[] = [
  { lambId: randomUUID(), motherId: 100, sex: 'ewe', dob: '2021-04-02', promoted: true, promotedToId: 101, createdAt: now, updatedAt: now },
  { lambId: randomUUID(), motherId: 100, sex: 'ewe', dob: '2026-03-01', promoted: false, createdAt: now, updatedAt: now },
  { lambId: randomUUID(), motherId: 100, sex: 'ram', dob: '2026-03-02', promoted: false, createdAt: now, updatedAt: now },
  { lambId: randomUUID(), motherId: 101, sex: 'ram', dob: '2023-03-28', promoted: true, promotedToId: 102, createdAt: now, updatedAt: now },
  { lambId: randomUUID(), motherId: 101, sex: 'ewe', dob: '2026-04-10', promoted: false, createdAt: now, updatedAt: now }
]

async function main(): Promise<void> {
  const tableName = Resource.SheepTracker.name
  for (const animal of animals) {
    await ddb.send(new PutCommand({ TableName: tableName, Item: toAnimalItem(animal) }))
    console.log(`Seeded sheep #${animal.id}`)
  }
  for (const lamb of lambs) {
    await ddb.send(new PutCommand({ TableName: tableName, Item: toLambItem(lamb) }))
    console.log(`Seeded lamb of #${lamb.motherId} (${lamb.promoted ? 'promoted' : 'current'})`)
  }
  console.log(`Done. Seeded ${animals.length} sheep and ${lambs.length} lambs into ${tableName}.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
