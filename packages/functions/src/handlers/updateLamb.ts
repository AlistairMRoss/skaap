import { withAdmin } from '../lib/handler'
import { parseBody, parseIdParam, parseLambIdParam, parseLambUpdateInput } from '../lib/parse'
import { ok } from '../lib/response'
import { updateLamb } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const motherId = parseIdParam(event.pathParameters?.id)
  const lambId = parseLambIdParam(event.pathParameters?.lambId)
  const input = parseLambUpdateInput(parseBody(event.body))
  const lamb = await updateLamb(motherId, lambId, input)
  return ok({ lamb })
})
