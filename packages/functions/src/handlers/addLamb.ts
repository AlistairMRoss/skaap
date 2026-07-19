import { withAdmin } from '../lib/handler'
import { parseBody, parseIdParam, parseLambCreateInput } from '../lib/parse'
import { created } from '../lib/response'
import { createLamb } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const motherId = parseIdParam(event.pathParameters?.id)
  const input = parseLambCreateInput(parseBody(event.body))
  const lamb = await createLamb(motherId, input)
  return created({ lamb })
})
