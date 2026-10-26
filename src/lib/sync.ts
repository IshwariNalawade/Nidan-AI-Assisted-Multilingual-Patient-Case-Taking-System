// Optional hospital hub (server/server.mjs on the hospital network). The hub stores CIPHERTEXT only (sealed to the staff key).
import type { Sealed } from './vault'
type Kind = 'sessions' | 'patients'
export interface Blob { id: string; at: string; pid?: string; blob: Sealed }
const env = () => import.meta.env as unknown as Record<string, string>
const OUT = 'nidan-outbox-v1'
export const hubOn = () => !!env().VITE_API_BASE
const hdr = (staffToken?: string): Record<string, string> => ({ 'Content-Type': 'application/json', ...(staffToken ? { authorization: `Bearer ${staffToken}` } : { 'x-kiosk-key': env().VITE_KIOSK_KEY ?? '' }) })
const readOut = (): (Blob & { kind: Kind })[] => { try { return JSON.parse(localStorage.getItem(OUT) ?? '[]') } catch { return [] } }
const writeOut = (l: unknown[]) => { try { localStorage.setItem(OUT, JSON.stringify(l)) } catch { /* full */ } }
async function put(kind: Kind, b: Blob, staffToken?: string) { const r = await fetch(`${env().VITE_API_BASE}/api/blobs/${kind}/${b.id}`, { method: 'PUT', headers: hdr(staffToken), body: JSON.stringify({ at: b.at, pid: b.pid, blob: b.blob }) }); return r.ok }
/** Never loses data: a failed push is queued and retried when the network returns. */
export async function pushBlob(kind: Kind, b: Blob, staffToken?: string): Promise<boolean> {
  if (!hubOn()) return false
  try { if (await put(kind, b, staffToken)) return true } catch { /* offline */ }
  writeOut([...readOut().filter((x) => !(x.kind === kind && x.id === b.id)), { kind, ...b }]); return false
}
export async function flushOutbox(staffToken?: string) { for (const o of readOut()) { try { if (await put(o.kind, o, staffToken)) writeOut(readOut().filter((x) => !(x.kind === o.kind && x.id === o.id))) } catch { /* still offline */ } } }
export async function dropBlob(kind: Kind, id: string, staffToken?: string) { if (!hubOn()) return; writeOut(readOut().filter((x) => !(x.kind === kind && x.id === id))); try { await fetch(`${env().VITE_API_BASE}/api/blobs/${kind}/${id}`, { method: 'DELETE', headers: hdr(staffToken) }) } catch { /* retried manually */ } }
export async function pullBlobs(kind: Kind, staffToken: string): Promise<Blob[]> { if (!hubOn()) return []; try { const r = await fetch(`${env().VITE_API_BASE}/api/blobs/${kind}`, { headers: hdr(staffToken) }); return r.ok ? ((await r.json()) as Blob[]) : [] } catch { return [] } }
export const pendingOutbox = () => readOut().length
if (typeof window !== 'undefined') window.addEventListener('online', () => { void flushOutbox() })
