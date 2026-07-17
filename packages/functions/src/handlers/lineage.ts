import { withAdmin } from '../lib/handler'
import { parseIdParam } from '../lib/parse'
import { ok } from '../lib/response'
import { getLineage } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const id = parseIdParam(event.pathParameters?.id)
  const lineage = await getLineage(id)
  return ok({ lineage })
})
