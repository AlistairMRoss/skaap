import { withAdmin } from '../lib/handler'
import { parseBody, parseIdParam, parseUpdateInput } from '../lib/parse'
import { ok } from '../lib/response'
import { updateAnimal } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const id = parseIdParam(event.pathParameters?.id)
  const input = parseUpdateInput(parseBody(event.body))
  const animal = await updateAnimal(id, input)
  return ok({ animal })
})
