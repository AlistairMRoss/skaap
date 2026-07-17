import { isStatus } from '@sheep/core'
import { withAdmin } from '../lib/handler'
import { badRequest } from '../lib/errors'
import { ok } from '../lib/response'
import { listAnimals } from '../db/animals'

export const handler = withAdmin(async (event) => {
  const qs = event.queryStringParameters ?? {}
  const statusRaw = qs.status
  if (statusRaw !== undefined && statusRaw.length > 0 && !isStatus(statusRaw)) {
    throw badRequest('status must be one of: alive, sold, deceased')
  }
  const status = statusRaw !== undefined && isStatus(statusRaw) ? statusRaw : undefined
  const q = qs.q?.trim()
  const animals = await listAnimals({ status, q: q && q.length > 0 ? q : undefined })
  return ok({ animals })
})
