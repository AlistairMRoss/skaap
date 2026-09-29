import { main as inner } from '../../../../node_modules/@alistairmross/auth/dist/src/backend/handlers/otp-verify.handler'
import { wrap } from './wrap'

export const main = wrap(inner)
