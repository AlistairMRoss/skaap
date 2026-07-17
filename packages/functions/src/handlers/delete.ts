import { withAdmin } from '../lib/handler'
import { parseIdParam } from '../lib/parse'
import { ok } from '../lib/response'
import { deleteAnimal } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const id = parseIdParam(event.pathParameters?.id)
  await deleteAnimal(id)
  return ok({ id, deleted: true })
})
