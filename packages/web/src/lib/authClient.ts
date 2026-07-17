import { AUTH_API_URL } from './config'

export interface AuthUser {
  userId: string
  email?: string
  username?: string
  mobile?: string
  roles: string[]
  status: string
}

export interface LoginResult {
  user: AuthUser
  accessToken: string
  expiresIn: number
}

export interface RefreshResult {
  accessToken: string
  expiresIn: number
}

export interface AuthClient {
  login(email: string, password: string): Promise<LoginResult>
  sendCode(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<LoginResult>
  setPassword(accessToken: string, newPassword: string): Promise<void>
  me(accessToken: string): Promise<AuthUser>
  refresh(): Promise<RefreshResult>
  logout(accessToken: string): Promise<void>
}

interface Envelope<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
  })
  const text = await res.text()
  const json = (text.length > 0 ? JSON.parse(text) : {}) as Envelope<T>
  if (!res.ok || json.success !== true) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`)
  }
  return json.data as T
}

export const emailPasswordAuthClient: AuthClient = {
  async login(email, password) {
    return call<LoginResult>('/auth/password/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
  },
  async sendCode(email) {
    await call('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, channel: 'email' })
    })
  },
  async verifyCode(email, code) {
    return call<LoginResult>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, code })
    })
  },
  async setPassword(accessToken, newPassword) {
    await call('/auth/password', {
      method: 'PUT',
      headers: { authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ newPassword })
    })
  },
  async me(accessToken) {
    const data = await call<{ user: AuthUser }>('/auth/me', {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}` }
    })
    return data.user
  },
  async refresh() {
    return call<RefreshResult>('/auth/refresh', { method: 'POST' })
  },
  async logout(accessToken) {
    await call('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({})
    })
  }
}

export const authClient: AuthClient = emailPasswordAuthClient
