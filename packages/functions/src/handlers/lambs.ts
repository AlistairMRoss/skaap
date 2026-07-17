import { withAdmin } from '../lib/handler'
import { parseIdParam } from '../lib/parse'
import { ok } from '../lib/response'
import { getAnimal, listLambs } from '../db/animals'
import { notFound } from '../lib/errors'

export const handler = withAdmin(async (event) => {
  const id = parseIdParam(event.pathParameters?.id)
  const animal = await getAnimal(id)
  if (!animal) throw notFound(`Animal ${id} not found`)
  const lambs = await listLambs(id)
  return ok({ lambs })
})
