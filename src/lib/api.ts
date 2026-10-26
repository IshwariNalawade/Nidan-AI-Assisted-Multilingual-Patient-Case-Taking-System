export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) { super(message); this.name = 'ApiError'; this.status = status; this.details = details }
}
const configuredBase = String((import.meta.env as unknown as Record<string, string | undefined>).VITE_API_BASE ?? '').trim().replace(/\/$/, '')
function endpoint(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (!configuredBase) return normalized.startsWith('/api/') ? normalized : `/api${normalized}`
  if (configuredBase.endsWith('/api')) return `${configuredBase}${normalized.startsWith('/api') ? normalized.slice(4) : normalized}`
  return `${configuredBase}${normalized.startsWith('/api') ? normalized : `/api${normalized}`}`
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json')
  let response: Response
  try {
    response = await fetch(endpoint(path), { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'NIDAN API is unavailable. Check the MySQL database and Express API, then reload this page.')
  }
  const type = response.headers.get('content-type') ?? ''
  const body = type.includes('application/json') ? await response.json().catch(() => ({})) : null
  if (!response.ok) throw new ApiError(response.status, (body as { error?: string } | null)?.error ?? `Request failed (${response.status}).`, (body as { details?: unknown } | null)?.details)
  return body as T
}
export const json = (method: string, value?: unknown): RequestInit => ({ method, ...(value === undefined ? {} : { body: JSON.stringify(value) }) })
