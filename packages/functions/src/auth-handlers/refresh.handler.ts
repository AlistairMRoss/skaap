import { main as inner } from '../../../../node_modules/@alistairmross/auth/dist/src/backend/handlers/refresh.handler'
import { hasRefreshCookie, wrapWhen } from './wrap'

export const main = wrapWhen(inner, (event) => hasRefreshCookie(event))
