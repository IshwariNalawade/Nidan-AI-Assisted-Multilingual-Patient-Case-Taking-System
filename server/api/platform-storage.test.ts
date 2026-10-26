import { afterEach, describe, expect, it, vi } from 'vitest'
import { getProjectObject, putProjectObject } from './platform-storage.js'

const apiBase = 'https://manus-api.test'
const apiKey = 'test-runtime-key-not-a-real-credential'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('project object storage API', () => {
  it('authenticates the presign call and uploads bytes only to the signed transfer URL', async () => {
    vi.stubEnv('MANUS_API_URL', apiBase)
    vi.stubEnv('MANUS_API_KEY', apiKey)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://storage.test/upload?signature=fake' }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const bytes = Buffer.from('%PDF-1.4\nsynthetic fixture\n%%EOF')

    await putProjectObject('nidan-demo/abc123.pdf', 'application/pdf', bytes)

    expect(String(fetchMock.mock.calls[0][0])).toBe(`${apiBase}/v1/storage/presign/put?path=nidan-demo%2Fabc123.pdf`)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } })
    expect(fetchMock.mock.calls[1][0]).toBe('https://storage.test/upload?signature=fake')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: bytes })
    expect(JSON.stringify(fetchMock.mock.calls[1][1])).not.toContain(apiKey)
  })

  it('downloads bytes through a signed server-side URL and reports a missing object as null', async () => {
    vi.stubEnv('MANUS_API_URL', apiBase)
    vi.stubEnv('MANUS_API_KEY', apiKey)
    const bytes = Buffer.from('synthetic report bytes')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://storage.test/download?signature=fake' }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(bytes, { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://storage.test/missing?signature=fake' }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getProjectObject('nidan-demo/abc123.pdf')).toEqual(bytes)
    expect(await getProjectObject('nidan-demo/gone.pdf')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[1][1]?.headers).toBeUndefined()
    expect(fetchMock.mock.calls[3][1]?.headers).toBeUndefined()
  })

  it('rejects non-ASCII keys and insecure signed transfer URLs', async () => {
    vi.stubEnv('MANUS_API_URL', apiBase)
    vi.stubEnv('MANUS_API_KEY', apiKey)
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ url: 'http://storage.test/upload' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(putProjectObject('nidan-demo/रिपोर्ट.pdf', 'application/pdf', Buffer.from('x'))).rejects.toThrow('Invalid project object key')
    await expect(getProjectObject('nidan-demo/report.pdf')).rejects.toThrow('insecure transfer URL')
  })
})
