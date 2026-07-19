import { withAdmin } from '../lib/handler'
import { parseIdParam, parseLambIdParam } from '../lib/parse'
import { ok } from '../lib/response'
import { deleteLamb } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const motherId = parseIdParam(event.pathParameters?.id)
  const lambId = parseLambIdParam(event.pathParameters?.lambId)
  await deleteLamb(motherId, lambId)
  return ok({ lambId, deleted: true })
})
