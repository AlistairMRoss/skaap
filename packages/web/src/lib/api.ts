import { API_URL } from './config'

type TokenProvider = () => string | null
type Refresher = () => Promise<boolean>

let getToken: TokenProvider = () => null
let refreshToken: Refresher = async () => false

export function configureApi(hooks: { getToken: TokenProvider; refresh: Refresher }): void {
  getToken = hooks.getToken
  refreshToken = hooks.refresh
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body)
  if (res.status === 401 && (await refreshToken())) {
    res = await send(method, path, body)
  }
  const text = await res.text()
  const json = (text.length > 0 ? JSON.parse(text) : {}) as unknown
  if (!res.ok) {
    const error = (json as { error?: { code?: string; message?: string } }).error
    throw new ApiError(res.status, error?.code ?? 'ERROR', error?.message ?? `Request failed (${res.status})`)
  }
  return json as T
}
