// Staff-maintained master history per patient (conditions, allergies, long-term medicines, notes). Sealed for staff; the kiosk never reads it.
import { open, seal, vaultReady, type Sealed } from './vault'
import { log } from './audit'
import { pushBlob } from './sync'
export interface PatientRecord { pid: string; name: string; phone: string; chronic: string; allergies: string; meds: string; notes: { at: string; by: string; text: string }[]; updatedAt: string }
interface Rec { pid: string; at: string; blob: Sealed }
const KEY = 'nidan-patients-v1'
const read = (): Rec[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Rec[] } catch { return [] } }
const write = (l: Rec[]) => { try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* full */ } }
export const emptyRecord = (pid: string, name = '', phone = ''): PatientRecord => ({ pid, name, phone, chronic: '', allergies: '', meds: '', notes: [], updatedAt: '' })
export async function getRecord(pid: string): Promise<PatientRecord | null> { const r = read().find((x) => x.pid === pid); if (!r) return null; try { return await open<PatientRecord>(r.blob) } catch { return null } }
export async function saveRecord(rec: PatientRecord, actor: 'staff' | 'system' = 'staff') {
  if (!vaultReady() || !rec.pid) throw new Error('Staff vault not set up or patient not identifiable')
  const next = { ...rec, updatedAt: new Date().toISOString() }; const blob = await seal(next); write([{ pid: rec.pid, at: next.updatedAt, blob }, ...read().filter((x) => x.pid !== rec.pid)]); void log(actor, 'history_updated', rec.pid); void pushBlob('patients', { id: rec.pid, at: next.updatedAt, blob }, sessionStorage.getItem('nidan-staff-token') ?? undefined); return next
}
export const removeRecord = (pid: string) => { write(read().filter((x) => x.pid !== pid)); void log('staff', 'history_deleted', pid) }
/** Fold one visit's patient-reported medicines/allergies into the master record. Staff-triggered, never automatic. */
export function mergeVisit(rec: PatientRecord, v: { meds?: string; allergy?: string }): PatientRecord {
  const add = (a: string, b?: string) => (b && b.trim() && !a.toLowerCase().includes(b.trim().toLowerCase()) ? (a ? `${a}; ${b.trim()}` : b.trim()) : a)
  return { ...rec, meds: add(rec.meds, v.meds), allergies: add(rec.allergies, v.allergy) }
}
