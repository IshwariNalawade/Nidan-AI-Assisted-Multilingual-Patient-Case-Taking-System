// Saved sessions are sealed for staff (see vault.ts). The in-progress session is held in memory only — a reload wipes it (data minimisation).
import { open, seal, vaultReady, type Sealed } from './vault'
import { log } from './audit'
import { dropBlob, pullBlobs, pushBlob } from './sync'
import type { Session } from '../model'
interface Rec { id: string; at: string; blob: Sealed }
const KEY = 'nidan-saved-v3'
const read = (): Rec[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Rec[] } catch { return [] } }
const write = (l: Rec[]) => { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 200))) } catch { /* full */ } }
export async function saveSession(s: Session): Promise<boolean> {
  if (!vaultReady()) return false
  const blob = await seal(s), at = new Date().toISOString(); write([{ id: s.id, at, blob }, ...read().filter((r) => r.id !== s.id)]); void log('kiosk', 'session_saved', s.id); void pushBlob('sessions', { id: s.id, at, pid: s.pid, blob }); return true
}
export const savedCount = () => read().length
export async function listSaved(): Promise<Session[]> { const out: Session[] = []; for (const r of read()) { try { out.push(await open<Session>(r.blob)) } catch { /* locked or corrupt */ } } return out }
export function removeSaved(id: string, actor: 'kiosk' | 'staff') { write(read().filter((r) => r.id !== id)); void dropBlob('sessions', id); void log(actor, actor === 'kiosk' ? 'session_deleted_by_patient' : 'record_deleted', id) }
export function purgeOlderThan(days: number) { const cut = Date.now() - days * 864e5, keep = read().filter((r) => +new Date(r.at) >= cut), n = read().length - keep.length; if (n) { write(keep); void log('system', 'retention_purge', String(n)) } return n }
/** Staff: refresh this browser from the hospital hub (ciphertext only), then list. */
export async function listSavedSynced(staffToken: string): Promise<Session[]> {
  for (const r of await pullBlobs('sessions', staffToken)) { const mine = read().find((x) => x.id === r.id); if (!mine || r.at > mine.at) write([{ id: r.id, at: r.at, blob: r.blob }, ...read().filter((x) => x.id !== r.id)]) }
  return listSaved()
}
