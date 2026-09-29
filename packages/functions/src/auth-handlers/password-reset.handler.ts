import { main as inner } from '../../../../node_modules/@alistairmross/auth/dist/src/backend/handlers/password-reset.handler'
import { wrap } from './wrap'

export const main = wrap(inner)
