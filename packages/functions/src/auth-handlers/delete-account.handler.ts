import { main as inner } from '../../../../node_modules/@alistairmross/auth/dist/src/backend/handlers/delete-account.handler'
import { wrap } from './wrap'

export const main = wrap(inner)
