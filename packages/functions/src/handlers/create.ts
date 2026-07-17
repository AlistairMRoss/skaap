import { withAdmin } from '../lib/handler'
import { parseBody, parseCreateInput } from '../lib/parse'
import { created } from '../lib/response'
import { createAnimal } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const input = parseCreateInput(parseBody(event.body))
  const animal = await createAnimal(input)
  return created({ animal })
})
