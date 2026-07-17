function normalise(url: string | undefined): string {
  return (url ?? '').replace(/\/+$/, '')
}

export const AUTH_API_URL = normalise(import.meta.env.VITE_AUTH_API_URL)
export const API_URL = normalise(import.meta.env.VITE_API_URL)
