import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Resource } from 'sst'
import type { Animal } from '@sheep/core'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
})

function padId(id: number): string {
  return id.toString().padStart(10, '0')
}

function toItem(animal: Animal): Record<string, unknown> {
  const pk = `ANIMAL#${animal.id}`
  const item: Record<string, unknown> = {
    pk,
    sk: pk,
    gsi1pk: 'ALL#ANIMAL',
    gsi1sk: padId(animal.id),
    ...animal
  }
  if (animal.motherId !== undefined) {
    item.gsi2pk = `MOTHER#${animal.motherId}`
    item.gsi2sk = `ANIMAL#${animal.id}`
  }
  return item
}

const now = new Date().toISOString()

const animals: Animal[] = [
  { id: 100, colour: 'yellow', sex: 'ewe', breed: 'Merino', dob: '2019-03-10', status: 'alive', notes: 'Matriarch', createdAt: now, updatedAt: now },
  { id: 101, colour: 'blue', sex: 'ewe', breed: 'Merino', dob: '2021-04-02', motherId: 100, status: 'alive', createdAt: now, updatedAt: now },
  { id: 102, colour: 'green', sex: 'ram', breed: 'Merino', dob: '2023-03-28', motherId: 101, status: 'alive', createdAt: now, updatedAt: now },
  { id: 103, colour: 'red', sex: 'ewe', breed: 'Merino', dob: '2023-03-28', motherId: 101, status: 'alive', createdAt: now, updatedAt: now },
  { id: 104, colour: 'white', sex: 'wether', dob: '2024-04-15', motherId: 101, status: 'sold', createdAt: now, updatedAt: now }
]

async function main(): Promise<void> {
  const tableName = Resource.SheepTracker.name
  for (const animal of animals) {
    await ddb.send(new PutCommand({ TableName: tableName, Item: toItem(animal) }))
    console.log(`Seeded animal #${animal.id}`)
  }
  console.log(`Done. Seeded ${animals.length} animals into ${tableName}.`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
