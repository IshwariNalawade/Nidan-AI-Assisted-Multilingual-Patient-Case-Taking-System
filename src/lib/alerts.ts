// Local alerts show draft rule matches. Cross-device webhook/relay notices are generic and unverified; they carry no severity/flags. Verify at the kiosk before clinical action.
import { log } from './audit'
import { open, seal, vaultReady, type Sealed } from './vault'
import type { Finding } from './safety'
type Env = { VITE_ALERT_WEBHOOK?: string; VITE_API_BASE?: string; VITE_KIOSK_KEY?: string }
const env = (): Env => import.meta.env as unknown as Env
export interface Flag { id: string; label: string; tier: 'urgent' | 'review'; evidence: string }
export interface Alert { id: string; sessionId: string; token: string; at: string; flags: Flag[]; ageBand: string; status: 'new' | 'ack' | 'left'; ackAt?: string; delivery: 'local' | 'sent' | 'queued'; sealed?: Sealed; unverified?: boolean }
export interface Who { name: string; age: string }
const KEY = 'nidan-alerts-v2', CH = 'nidan-alerts'
const who = new Map<string, Who>()                       // in-memory identity (also covers “vault not set up yet”)
const bus = new EventTarget()
export const loadAlerts = (): Alert[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Alert[] } catch { return mem } }
let mem: Alert[] = []
function save(l: Alert[]) { mem = l.slice(0, 100); try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* in-memory only */ } try { new BroadcastChannel(CH).postMessage('c') } catch { /* none */ } bus.dispatchEvent(new Event('c')) }
export function subscribe(cb: () => void) {
  const f = () => cb(), st = (e: StorageEvent) => { if (e.key === KEY) cb() }
  bus.addEventListener('c', f); window.addEventListener('storage', st)
  let ch: BroadcastChannel | null = null; try { ch = new BroadcastChannel(CH); ch.onmessage = f } catch { /* none */ }
  return () => { bus.removeEventListener('c', f); window.removeEventListener('storage', st); ch?.close() }
}
export async function identity(a: Alert): Promise<Who | null> { if (who.has(a.id)) return who.get(a.id)!; if (a.sealed) { try { return await open<Who>(a.sealed) } catch { return null } } return null }
const band = (age: string, unit: string) => { const n = Number(age); if (!age || !Number.isFinite(n)) return '?'; if (unit === 'months' || n < 1) return 'infant'; return n < 12 ? 'child' : n < 18 ? 'teen' : n >= 65 ? 'older adult' : 'adult' }

async function deliver(a: Alert): Promise<Alert['delivery']> {
  const e = env(), notice = { kind: 'NIDAN_UNVERIFIED_KIOSK_NOTICE', token: a.token, at: a.at, unverified: true, message: 'Unverified kiosk notice; clinical urgency is unknown. Confirm against the live kiosk and patient before clinical action.' }, body = JSON.stringify(notice)
  const jobs: Promise<boolean>[] = []
  if (e.VITE_ALERT_WEBHOOK) jobs.push(fetch(e.VITE_ALERT_WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then((r) => r.ok).catch(() => false))
  if (e.VITE_API_BASE) jobs.push(fetch(`${e.VITE_API_BASE}/api/alerts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-kiosk-key': e.VITE_KIOSK_KEY ?? '' }, body: JSON.stringify({ sessionId: a.sessionId, token: a.token, eventId: a.id }) }).then((r) => r.ok).catch(() => false))
  if (!jobs.length) return 'local'
  return (await Promise.all(jobs)).some(Boolean) ? 'sent' : 'queued'
}
export async function raiseAlert(p: { sessionId: string; token: string; name: string; age: string; ageUnit: string; findings: Finding[] }): Promise<Alert | null> {
  const urgent = p.findings.filter((f) => f.tier === 'urgent'); if (!urgent.length) return null
  const flags: Flag[] = p.findings.map(({ id, label, tier, evidence }) => ({ id, label, tier, evidence })), list = loadAlerts(), key = (fs: Flag[]) => fs.filter((f) => f.tier === 'urgent').map((f) => f.id).sort().join(',')
  const old = list.find((x) => x.sessionId === p.sessionId); if (old && key(old.flags) === key(flags)) return old
  const a: Alert = { id: old?.id ?? `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sessionId: p.sessionId, token: p.token, at: new Date().toISOString(), flags, ageBand: band(p.age, p.ageUnit), status: 'new', delivery: 'local' }
  who.set(a.id, { name: p.name || '(not entered yet)', age: p.age })
  if (vaultReady()) a.sealed = await seal(who.get(a.id))
  save([a, ...loadAlerts().filter((x) => x.sessionId !== p.sessionId)])          // saved BEFORE any network call: a failure never loses the alert
  void log('kiosk', 'alert_raised', a.token)
  a.delivery = await deliver(a); save([a, ...loadAlerts().filter((x) => x.id !== a.id)]); return a
}
export async function flushQueued() { for (const a of loadAlerts().filter((x) => x.delivery === 'queued')) { const d = await deliver(a); if (d !== 'queued') save(loadAlerts().map((x) => (x.id === a.id ? { ...x, delivery: d } : x))) } }
export function acknowledge(id: string) { save(loadAlerts().map((a) => (a.id === id ? { ...a, status: 'ack', ackAt: new Date().toISOString() } : a))); void log('staff', 'alert_ack', id) }
/** Kiosk reset/idle while an alert is unacknowledged = the patient may have left. Keep it and escalate. */
export function markLeft(sessionId: string) { const l = loadAlerts(); if (l.some((a) => a.sessionId === sessionId && a.status === 'new')) { save(l.map((a) => (a.sessionId === sessionId && a.status === 'new' ? { ...a, status: 'left' } : a))); void log('system', 'alert_patient_left', sessionId) } }
export function purgeAcknowledged(maxAgeH = 24) { const cut = Date.now() - maxAgeH * 36e5; save(loadAlerts().filter((a) => a.status === 'new' || +new Date(a.at) > cut)) }
export function dropPatientData(sessionId: string) { // patient deletion: identity goes, but an unacknowledged urgent alert stays (token + flags only) so the emergency is not lost
  save(loadAlerts().map((a) => { if (a.sessionId !== sessionId) return a; who.delete(a.id); return { ...a, sealed: undefined } })); void log('kiosk', 'alert_identity_deleted', sessionId) }
if (typeof window !== 'undefined') window.addEventListener('online', () => { void flushQueued() })

/** Staff side, cross-device: pull alerts raised on other kiosks from the relay server (needs the staff token). */
export async function pullRemote(base: string, token: string): Promise<Alert[]> {
  try { const r = await fetch(`${base}/api/alerts`, { headers: { authorization: `Bearer ${token}` } }); return r.ok ? ((await r.json()) as Alert[]).map((a) => ({ ...a, flags: [], ageBand: 'unknown', unverified: true, delivery: 'sent' as const })) : [] } catch { return [] }
}
export async function ackRemote(base: string, token: string, id: string) { try { await fetch(`${base}/api/alerts/${id}/ack`, { method: 'POST', headers: { authorization: `Bearer ${token}` } }) } catch { /* retried by next poll */ } }
