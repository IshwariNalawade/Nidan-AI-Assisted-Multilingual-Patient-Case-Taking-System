import { Buffer } from 'node:buffer'

function credentials() {
  const baseUrl = process.env.MANUS_API_URL
  const apiKey = process.env.MANUS_API_KEY
  if (!baseUrl || !apiKey) throw new Error('Project object storage is not configured.')
  return { baseUrl, apiKey }
}

async function presignedUrl(action: 'put' | 'get', key: string) {
  if (!/^[\x21-\x7e]{1,512}$/.test(key)) throw new Error('Invalid project object key.')
  const { baseUrl, apiKey } = credentials()
  const endpoint = new URL(`/v1/storage/presign/${action}`, baseUrl)
  endpoint.searchParams.set('path', key)
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  const body = await response.json().catch(() => null) as { url?: unknown; error?: unknown } | null
  if (!response.ok || typeof body?.url !== 'string') throw new Error(`Project storage could not issue a ${action} URL (${response.status}).`)
  let signed: URL
  try { signed = new URL(body.url) } catch { throw new Error('Project storage returned an invalid transfer URL.') }
  if (signed.protocol !== 'https:') throw new Error('Project storage returned an insecure transfer URL.')
  return signed.toString()
}

export async function putProjectObject(key: string, contentType: string, bytes: Buffer) {
  const signedUrl = await presignedUrl('put', key)
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes,
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`Project object upload failed (${response.status}).`)
}

export async function getProjectObject(key: string): Promise<Buffer | null> {
  const signedUrl = await presignedUrl('get', key)
  const response = await fetch(signedUrl, { signal: AbortSignal.timeout(60_000) })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Project object download failed (${response.status}).`)
  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('Project object exceeds the download safety limit.')
  return Buffer.from(bytes)
}
