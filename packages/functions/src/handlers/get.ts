import { withAdmin } from '../lib/handler'
import { parseIdParam } from '../lib/parse'
import { ok } from '../lib/response'
import { getAnimalDetail } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const id = parseIdParam(event.pathParameters?.id)
  const detail = await getAnimalDetail(id)
  return ok(detail)
})
