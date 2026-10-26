// NIDAN's optional hospital-local alert/FHIR relay. Protect with HTTPS, a private network, and unique secrets.
// Required: NIDAN_KIOSK_KEY, NIDAN_STAFF_TOKEN. Optional: NIDAN_ORIGIN, NIDAN_DATA,
// NIDAN_NOTIFY_URL, NIDAN_FHIR_ENCRYPTION_KEY, NIDAN_LLM_URL, NIDAN_LLM_MODEL.
import { createServer } from 'node:http'
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const {
  NIDAN_LLM_URL,
  NIDAN_LLM_MODEL = 'llama3.1',
  NIDAN_LLM_ALLOW_REMOTE,
  NIDAN_KIOSK_KEY,
  NIDAN_STAFF_TOKEN,
  NIDAN_NOTIFY_URL,
  NIDAN_FHIR_ENCRYPTION_KEY = '',
  PORT = 8787,
  NIDAN_ORIGIN = 'http://localhost:3000',
  NIDAN_DATA = './data',
} = process.env

if (!NIDAN_KIOSK_KEY || !NIDAN_STAFF_TOKEN) {
  console.error('Set NIDAN_KIOSK_KEY and NIDAN_STAFF_TOKEN in a private environment.')
  process.exit(1)
}

for (const dir of [NIDAN_DATA, `${NIDAN_DATA}/fhir`, `${NIDAN_DATA}/blobs`]) {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  chmodSync(dir, 0o700)
}
const ALERT_FILE = `${NIDAN_DATA}/alerts.json`
const validSessionId = (value) => typeof value === 'string' && /^[\w-]{8,80}$/.test(value)
const validAlertToken = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(value)
const validAlertEventId = (value) => typeof value === 'string' && /^[\w-]{8,80}$/.test(value)
const validAlertId = (value) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const validTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const normalizeStoredAlert = (row) => {
  const item = row && typeof row === 'object' && !Array.isArray(row) ? row : {}
  const current = item.relayVersion === 2 && item.unverified === true && validAlertId(item.id) && validSessionId(item.sessionId) && validAlertToken(item.token)
  const status = current && item.status === 'ack' ? 'ack' : 'new'
  return {
    id: current ? item.id : randomUUID(),
    sessionId: validSessionId(item.sessionId) ? item.sessionId : `legacy-${randomUUID()}`,
    token: validAlertToken(item.token) ? item.token : 'CHECK',
    sourceEventId: current && validAlertEventId(item.sourceEventId) ? item.sourceEventId : `legacy-${randomUUID()}`,
    at: current && validTimestamp(item.at) ? item.at : new Date().toISOString(),
    lastSeenAt: current && validTimestamp(item.lastSeenAt) ? item.lastSeenAt : new Date().toISOString(),
    flags: [], ageBand: 'unknown', status,
    ...(status === 'ack' && validTimestamp(item.ackAt) ? { ackAt: item.ackAt } : {}),
    delivery: 'sent', unverified: true, relayVersion: 2,
  }
}
let storedAlerts = []
if (existsSync(ALERT_FILE)) {
  try { storedAlerts = JSON.parse(readFileSync(ALERT_FILE, 'utf8')) } catch { storedAlerts = [] }
  chmodSync(ALERT_FILE, 0o600)
}
const alerts = (Array.isArray(storedAlerts) ? storedAlerts : []).map(normalizeStoredAlert).slice(0, 500)
const serializeAlert = ({ relayVersion: _relayVersion, sourceEventId: _sourceEventId, ...alert }) => alert
const persistAlerts = () => writeFileSync(ALERT_FILE, JSON.stringify(alerts.slice(0, 500)), { mode: 0o600 })
if (existsSync(ALERT_FILE)) persistAlerts() // migrate older client-authored flags/status to unverified notices

const send = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': NIDAN_ORIGIN,
    'Access-Control-Allow-Headers': 'content-type,x-kiosk-key,authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Cache-Control': 'no-store',
  })
  res.end(code === 204 ? undefined : JSON.stringify(body))
}
const read = (req) => new Promise((resolve) => {
  let data = '', tooLarge = false
  req.on('data', (chunk) => {
    data += chunk
    if (data.length > 5e6) { tooLarge = true; req.resume() }
  })
  req.on('end', () => {
    if (tooLarge) return resolve(null)
    try { resolve(JSON.parse(data || '{}')) } catch { resolve(null) }
  })
})
const staff = (req) => req.headers.authorization === `Bearer ${NIDAN_STAFF_TOKEN}`
const kiosk = (req) => req.headers['x-kiosk-key'] === NIDAN_KIOSK_KEY
const alertWindows = new Map()
const staffWindows = new Map()
function allowKioskAlert(req) {
  const now = Date.now(), address = req.socket?.remoteAddress ?? 'unknown'
  let window = alertWindows.get(address)
  if (!window || now - window.start >= 60_000) { window = { start: now, count: 0 }; alertWindows.set(address, window) }
  if (window.count >= 120) return false
  window.count++
  if (alertWindows.size > 1024) for (const [key, value] of alertWindows) if (now - value.start >= 60_000) alertWindows.delete(key)
  return true
}

function allowStaffRequest(req) {
  const now = Date.now(), address = req.socket?.remoteAddress ?? 'unknown'
  let window = staffWindows.get(address)
  if (!window || now - window.start >= 60_000) { window = { start: now, count: 0 }; staffWindows.set(address, window) }
  if (window.count >= 60) return false
  window.count++
  if (staffWindows.size > 1024) for (const [key, value] of staffWindows) if (now - value.start >= 60_000) staffWindows.delete(key)
  return true
}

// The hub stores the encrypted payload from the client; metadata remains visible to the hub operator.
const KINDS = new Set(['sessions', 'patients'])
const blobFile = (kind) => `${NIDAN_DATA}/blobs/${kind}.json`
const readBlobs = (kind) => existsSync(blobFile(kind)) ? JSON.parse(readFileSync(blobFile(kind), 'utf8')) : []
const writeBlobs = (kind, rows) => writeFileSync(blobFile(kind), JSON.stringify(rows), { mode: 0o600 })

// De-identify again before the optional local Ollama-compatible model request.
export const scrub = (text) => String(text)
  .replace(/(?:(?<!\w)\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, '[PHONE]')
  .replace(/\b\d{2}-?\d{4}-?\d{4}-?\d{4}\b/g, '[ID]')
  .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID]')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]')
  .replace(/\bABHA[-\w]*/gi, '[ID]')
  .replace(/\b\d{9,}\b/g, '[NUMBER]')

export const isLocalHost = (input) => {
  try {
    const host = new URL(input).hostname.toLowerCase()
    return host === 'localhost' || host === '::1' || host.endsWith('.local') || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  } catch { return false }
}

const encryptFhir = (bundle) => {
  const key = Buffer.from(NIDAN_FHIR_ENCRYPTION_KEY, 'base64')
  if (key.length !== 32 || key.toString('base64') !== NIDAN_FHIR_ENCRYPTION_KEY) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(bundle), 'utf8'), cipher.final()])
  return JSON.stringify({ version: 1, algorithm: 'AES-256-GCM', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') })
}

const SYSTEM = 'You help a clinician prepare for a consultation. Restate ONLY what the patient said, in clear English, as short sections: Complaint, Duration/Severity, Associated symptoms, Medicines, Allergies. Do NOT diagnose, do NOT suggest tests or treatment, do NOT guess missing facts: write "not stated". If wording is unclear, say so. Keep it under 150 words.'
async function llm(task, text, lang) {
  if (!NIDAN_LLM_URL) return { code: 503, body: { error: 'Local AI is not configured (set NIDAN_LLM_URL to an approved model server on this network, e.g. Ollama).' } }
  if (!isLocalHost(NIDAN_LLM_URL) && NIDAN_LLM_ALLOW_REMOTE !== '1') return { code: 403, body: { error: 'Refusing: the model host is not local. Remote AI is disabled to protect patient privacy.' } }
  const instruction = task === 'translate' ? `Translate the patient's words (${lang || 'their language'}) into plain English. Translate only; add nothing.` : SYSTEM
  try {
    const response = await fetch(`${NIDAN_LLM_URL.replace(/\/$/, '')}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: NIDAN_LLM_MODEL, system: instruction, prompt: scrub(text), stream: false, options: { temperature: 0.1 } }),
      signal: AbortSignal.timeout(90000),
    })
    if (!response.ok) return { code: 502, body: { error: `model server returned ${response.status}` } }
    const result = await response.json()
    return { code: 200, body: { text: String(result.response ?? '').trim(), model: NIDAN_LLM_MODEL, scrubbed: true, local: true, notice: 'AI draft — unverified. Not a diagnosis.' } }
  } catch { return { code: 502, body: { error: 'model server unreachable' } }
  }
}

export const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  const url = new URL(req.url, 'http://nidan.local')

  if (req.method === 'POST' && url.pathname === '/api/alerts') {
    if (!kiosk(req)) return send(res, 401, { error: 'kiosk key required' })
    if (!allowKioskAlert(req)) return send(res, 429, { error: 'alert rate limit reached; contact staff directly' })
    const body = await read(req)
    if (!validSessionId(body?.sessionId) || !validAlertToken(body?.token)) return send(res, 400, { error: 'sessionId and token are required in the alert body' })
    const now = new Date().toISOString()
    const sourceEventId = validAlertEventId(body.eventId) ? body.eventId : 'legacy-current'
    let alert = alerts.find((item) => item.sessionId === body.sessionId && item.sourceEventId === sourceEventId)
    const created = !alert
    if (alert) alert.lastSeenAt = now // never merge client-supplied status, flags, labels, age, ids or identity
    else {
      alert = { id: randomUUID(), sessionId: body.sessionId, sourceEventId, token: body.token, at: now, lastSeenAt: now, flags: [], ageBand: 'unknown', status: 'new', delivery: 'sent', unverified: true, relayVersion: 2 }
      alerts.unshift(alert)
    }
    persistAlerts()
    if (created && NIDAN_NOTIFY_URL) {
      const notice = { kind: 'NIDAN_UNVERIFIED_KIOSK_NOTICE', unverified: true, token: alert.token, at: alert.at, message: 'Unverified kiosk notice; clinical urgency is unknown. Confirm against the live kiosk and patient before clinical action.' }
      fetch(NIDAN_NOTIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notice) }).catch(() => {})
    }
    return send(res, 200, { ok: true, alert: serializeAlert(alert) })
  }

  if (req.method === 'GET' && url.pathname === '/api/alerts') return staff(req) ? send(res, 200, alerts.map(serializeAlert)) : send(res, 401, { error: 'staff token required' })
  const ackMatch = url.pathname.match(/^\/api\/alerts\/([0-9a-f-]{36})\/ack$/i)
  if (req.method === 'POST' && ackMatch) {
    if (!staff(req)) return send(res, 401, { error: 'staff token required' })
    const alert = alerts.find((item) => item.id === ackMatch[1])
    if (!alert) return send(res, 404, {})
    alert.status = 'ack'; alert.ackAt = new Date().toISOString(); persistAlerts()
    return send(res, 200, serializeAlert(alert))
  }

  if (req.method === 'POST' && url.pathname === '/api/fhir') {
    // FHIR writes contain structured health data and must never be authorized by
    // the browser-exposed kiosk key. Only the separately protected staff token
    // may submit them.
    if (!staff(req)) return send(res, 401, { error: 'staff token required' })
    if (!allowStaffRequest(req)) return send(res, 429, { error: 'staff request rate limit reached' })
    const body = await read(req)
    if (body?.resourceType !== 'Bundle') return send(res, 400, { error: 'not a FHIR Bundle' })
    const encrypted = encryptFhir(body)
    if (!encrypted) return send(res, 503, { error: 'FHIR storage is disabled: configure a valid 32-byte base64 NIDAN_FHIR_ENCRYPTION_KEY.' })
    const file = `${NIDAN_DATA}/fhir/${Date.now()}-${randomUUID()}.json.enc`
    writeFileSync(file, encrypted, { mode: 0o600, flag: 'wx' })
    return send(res, 201, { ok: true, encrypted: true })
  }

  const blobMatch = url.pathname.match(/^\/api\/blobs\/(sessions|patients)(?:\/([\w-]+))?$/)
  if (blobMatch && KINDS.has(blobMatch[1])) {
    const kind = blobMatch[1], id = blobMatch[2]
    if (req.method === 'GET' && !id) return staff(req) ? send(res, 200, readBlobs(kind)) : send(res, 401, { error: 'staff token required' })
    if (req.method === 'PUT' && id) {
      if (!kiosk(req) && !staff(req)) return send(res, 401, { error: 'relay key required' })
      const body = await read(req)
      if (!body?.blob) return send(res, 400, { error: 'body must be {blob, at, pid?}' })
      const rows = readBlobs(kind).filter((row) => row.id !== id)
      rows.unshift({ id, at: body.at, pid: body.pid, blob: body.blob })
      writeBlobs(kind, rows)
      return send(res, 200, { ok: true })
    }
    if (req.method === 'DELETE' && id) {
      if (!staff(req)) return send(res, 401, { error: 'staff token required to delete relay blobs' })
      if (!allowStaffRequest(req)) return send(res, 429, { error: 'staff request rate limit reached' })
      writeBlobs(kind, readBlobs(kind).filter((row) => row.id !== id))
      return send(res, 200, { ok: true })
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/ai') {
    if (!staff(req)) return send(res, 401, { error: 'staff token required' })
    if (!allowStaffRequest(req)) return send(res, 429, { error: 'staff request rate limit reached' })
    const body = await read(req), consent = body?.aiConsent
    const validConsent = consent?.enabled === true && consent.version === 'consent-2026-10-v1' && typeof consent.at === 'string' && Number.isFinite(Date.parse(consent.at)) && typeof consent.textHash === 'string' && /^[a-f0-9]{64}$/i.test(consent.textHash)
    if (!validConsent) return send(res, 403, { error: 'This visit has no valid recorded separate patient AI-processing opt-in. No AI request was made.' })
    if (typeof body?.text !== 'string' || !body.text.trim()) return send(res, 400, { error: 'text required' })
    if (!['summarize', 'translate'].includes(body.task)) return send(res, 400, { error: 'unsupported task' })
    const result = await llm(body.task, body.text, body.lang)
    return send(res, result.code, result.body)
  }

  return send(res, 404, { error: 'not found' })
})

const listenPort = Number.isInteger(Number(PORT)) && Number(PORT) > 0 && Number(PORT) <= 65535 ? Number(PORT) : 8787
if (process.argv[1]?.endsWith('server.mjs')) server.listen(listenPort, () => console.log(`NIDAN relay on :${listenPort}`))
