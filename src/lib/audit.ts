// Tamper-EVIDENT audit trail (hash-chained). Entries hold ids and actions only — never patient content.
import { sha256 } from './vault'
export interface Entry { n: number; t: string; actor: 'kiosk' | 'staff' | 'system'; action: string; ref: string; prev: string; hash: string }
const KEY = 'nidan-audit-v1'
export const readAudit = (): Entry[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Entry[] } catch { return [] } }
let chain: Promise<unknown> = Promise.resolve()
export function log(actor: Entry['actor'], action: string, ref = '') {
  chain = chain.then(async () => {
    const list = readAudit(), prev = list.length ? list[list.length - 1].hash : 'GENESIS'
    const e = { n: list.length + 1, t: new Date().toISOString(), actor, action, ref, prev }
    const hash = await sha256(prev + JSON.stringify(e))
    try { localStorage.setItem(KEY, JSON.stringify([...list, { ...e, hash }].slice(-2000))) } catch { /* storage unavailable */ }
  }).catch(() => undefined)
  return chain
}
export const auditIdle = () => chain
export async function verifyAudit(): Promise<{ ok: boolean; badAt?: number }> {
  const list = readAudit(); let prev = list.length ? list[0].prev : 'GENESIS'
  for (const e of list) { const { hash, ...rest } = e; if (rest.prev !== prev || (await sha256(prev + JSON.stringify(rest))) !== hash) return { ok: false, badAt: e.n }; prev = hash }
  return { ok: true }
}
