import { withAdmin } from '../lib/handler'
import { parseBody, parseIdParam, parseLambIdParam, parseLambPromoteInput } from '../lib/parse'
import { created } from '../lib/response'
import { promoteLamb } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const motherId = parseIdParam(event.pathParameters?.id)
  const lambId = parseLambIdParam(event.pathParameters?.lambId)
  const input = parseLambPromoteInput(parseBody(event.body))
  const animal = await promoteLamb(motherId, lambId, input)
  return created({ animal })
})
