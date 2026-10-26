import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDirs = []
const children = []
const host = '127.0.0.1'
const staffToken = 'synthetic-relay-test-staff-token'
const kioskKey = 'synthetic-relay-test-kiosk-key'

async function freePort() {
  const probe = createServer()
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, host, resolve) })
  const port = probe.address().port
  await new Promise((resolve) => probe.close(resolve))
  return port
}

async function getStatus(base) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(`${base}/`, { method: 'GET' }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    })
    req.on('error', reject)
    req.end()
  })
}

async function startRelay({ key = '', name, initialAlerts } = {}) {
  const data = await mkdtemp(path.join(tmpdir(), 'nidan-relay-test-'))
  dataDirs.push(data)
  if (initialAlerts) await writeFile(path.join(data, 'alerts.json'), JSON.stringify(initialAlerts), { mode: 0o600 })
  const port = await freePort()
  const child = spawn(process.execPath, [path.join(project, 'server/server.mjs')], {
    cwd: project,
    env: { PATH: process.env.PATH ?? process.env.Path ?? '', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}), PORT: String(port), NIDAN_DATA: data, NIDAN_KIOSK_KEY: kioskKey, NIDAN_STAFF_TOKEN: staffToken, NIDAN_LLM_URL: '', NIDAN_ORIGIN: 'http://localhost:3000', NIDAN_FHIR_ENCRYPTION_KEY: key },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  children.push(child)
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  const base = `http://${host}:${port}`
  const until = Date.now() + 5000
  while (Date.now() < until) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Relay ${name} exited during startup: ${stderr}`)
    try { if (await getStatus(base) === 404) return { base, data } } catch { /* wait for listener */ }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  child.kill('SIGTERM')
  throw new Error(`Relay ${name} did not start: ${stderr}`)
}

async function requestJson(base, route, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const req = httpRequest(`${base}${route}`, { method, headers: { ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}), ...headers } }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => resolve({ status: res.statusCode, json: () => JSON.parse(text || '{}') }))
    })
    req.on('error', reject)
    req.end(payload)
  })
}

const post = (base, route, options = {}) => requestJson(base, route, { ...options, method: 'POST' })
const kioskHeaders = { 'x-kiosk-key': kioskKey }
const staffHeaders = { authorization: `Bearer ${staffToken}` }

describe('legacy relay privacy and alert-integrity guardrails', () => {
  afterAll(async () => {
    await Promise.all(children.map((child) => new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve()
      const forceTimer = setTimeout(() => child.kill('SIGKILL'), 1000)
      child.once('exit', () => { clearTimeout(forceTimer); resolve() })
      child.kill('SIGTERM')
    })))
    for (const dir of dataDirs) await rm(dir, { recursive: true, force: true })
  })

  it('requires an explicit recorded visit-level patient opt-in before local AI processing', async () => {
    const { base } = await startRelay({ name: 'without AI consent' })
    const noConsent = await post(base, '/api/ai', { headers: staffHeaders, body: { task: 'summarize', text: 'synthetic text' } })
    expect(noConsent.status).toBe(403)
    expect(noConsent.json().error).toMatch(/no valid recorded separate patient AI-processing opt-in/i)

    const consentedButUnconfigured = await post(base, '/api/ai', { headers: staffHeaders, body: { task: 'summarize', text: 'synthetic text', aiConsent: { enabled: true, version: 'consent-2026-10-v1', at: new Date().toISOString(), textHash: 'a'.repeat(64) } } })
    expect(consentedButUnconfigured.status).toBe(503)
    expect(consentedButUnconfigured.json().error).toMatch(/not configured/i)
    expect((await post(base, '/api/ai', { body: { task: 'summarize', text: 'synthetic text' } })).status).toBe(401)
  })

  it('never trusts kiosk flags/status/IDs; only staff can acknowledge and legacy records reopen as unverified notices', async () => {
    const { base, data } = await startRelay({ name: 'alert integrity' })
    const posted = await post(base, '/api/alerts', { headers: kioskHeaders, body: {
      id: 'forged-client-id', sessionId: 'session_0123456789', token: 'U-009', eventId: 'event_00000001', status: 'ack', ackAt: new Date().toISOString(), ageBand: 'adult',
      flags: [{ id: 'fake', tier: 'urgent', label: 'FORGED EMERGENCY' }], sealed: { name: 'SYNTHETIC PATIENT SECRET' },
    } })
    expect(posted.status).toBe(200)
    const first = posted.json().alert
    expect(first).toMatchObject({ token: 'U-009', status: 'new', ageBand: 'unknown', flags: [], unverified: true })
    expect(first.id).not.toBe('forged-client-id')
    expect((await post(base, `/api/alerts/${first.id}/ack`, { headers: kioskHeaders })).status).toBe(401)

    const ack = await post(base, `/api/alerts/${first.id}/ack`, { headers: staffHeaders })
    expect(ack.status).toBe(200)
    expect(ack.json()).toMatchObject({ status: 'ack', unverified: true })
    const forgedReplay = await post(base, '/api/alerts', { headers: kioskHeaders, body: { sessionId: first.sessionId, token: first.token, eventId: 'event_00000001', status: 'new', flags: [{ tier: 'urgent', label: 'FORGED AGAIN' }] } })
    expect(forgedReplay.json().alert.status).toBe('ack')
    const rows = await requestJson(base, '/api/alerts', { headers: staffHeaders })
    expect(rows.json()).toHaveLength(1)
    expect(rows.json()[0].flags).toEqual([])
    expect(rows.json()[0].unverified).toBe(true)
    const nextEvent = await post(base, '/api/alerts', { headers: kioskHeaders, body: { sessionId: first.sessionId, token: first.token, eventId: 'event_00000002', status: 'ack', flags: [{ tier: 'urgent', label: 'FORGED LATER EVENT' }] } })
    expect(nextEvent.json().alert).toMatchObject({ status: 'new', flags: [], unverified: true })
    const afterNextEvent = await requestJson(base, '/api/alerts', { headers: staffHeaders })
    expect(afterNextEvent.json()).toHaveLength(2)
    expect(afterNextEvent.json().every((alert) => alert.unverified && alert.flags.length === 0)).toBe(true)
    const stored = await readFile(path.join(data, 'alerts.json'), 'utf8')
    expect(stored).not.toContain('FORGED EMERGENCY')
    expect(stored).not.toContain('FORGED LATER EVENT')
    expect(stored).not.toContain('SYNTHETIC PATIENT SECRET')

    const legacy = await startRelay({ name: 'legacy alerts', initialAlerts: [{ id: 'legacy-client-id', sessionId: 'legacy_session_123', token: 'U-010', at: new Date().toISOString(), status: 'ack', ageBand: 'adult', flags: [{ id: 'old', tier: 'urgent', label: 'OLD FORGED FLAG' }] }] })
    const migrated = await requestJson(legacy.base, '/api/alerts', { headers: staffHeaders })
    expect(migrated.json()).toHaveLength(1)
    expect(migrated.json()[0]).toMatchObject({ token: 'U-010', status: 'new', flags: [], ageBand: 'unknown', unverified: true })
    expect(migrated.json()[0].id).not.toBe('legacy-client-id')
    expect(await readFile(path.join(legacy.data, 'alerts.json'), 'utf8')).not.toContain('OLD FORGED FLAG')
  })

  it('refuses plaintext FHIR storage and saves only restrictive-permission AES-GCM ciphertext when a key is configured', async () => {
    const bundle = { resourceType: 'Bundle', type: 'transaction', syntheticPatientName: 'NIDAN FHIR TEST SECRET' }
    const missingKey = await startRelay({ name: 'FHIR without encryption key' })
    const refused = await post(missingKey.base, '/api/fhir', { headers: staffHeaders, body: bundle })
    expect(refused.status).toBe(503)
    expect(await readdir(path.join(missingKey.data, 'fhir'))).toHaveLength(0)

    const key = Buffer.alloc(32, 17).toString('base64')
    const protectedRelay = await startRelay({ key, name: 'encrypted FHIR' })
    const response = await post(protectedRelay.base, '/api/fhir', { headers: staffHeaders, body: bundle })
    expect(response.status).toBe(201)
    expect(response.json().encrypted).toBe(true)
    const [filename] = await readdir(path.join(protectedRelay.data, 'fhir'))
    expect(filename).toMatch(/\.json\.enc$/)
    const filePath = path.join(protectedRelay.data, 'fhir', filename)
    const file = await readFile(filePath, 'utf8')
    expect(file).not.toContain('NIDAN FHIR TEST SECRET')
    const envelope = JSON.parse(file)
    expect(envelope.algorithm).toBe('AES-256-GCM')
    expect(Buffer.from(envelope.ciphertext, 'base64').length).toBeGreaterThan(0)
    if (process.platform !== 'win32') expect((await stat(filePath)).mode & 0o077).toBe(0)
  })
})
