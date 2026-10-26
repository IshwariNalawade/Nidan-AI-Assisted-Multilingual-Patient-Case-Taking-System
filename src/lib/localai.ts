// Hospital-local AI helpers. Nothing here talks to a cloud: requests go to the hospital hub (VITE_API_BASE), which refuses non-local model hosts.
import type { Session } from '../model'
import { questionQueue, assessSession } from './report'
import { makeUi } from '../i18n'
import { log } from './audit'

/** Scrub identifiers from free text. Names must be passed in (patient name parts); regexes cover phone/ID/e-mail/long numbers. NOT perfect: free text can always hide an identifier. */
export function scrubText(text: string, names: string[] = []): string {
  let t = String(text).replace(/(?:(?<!\w)\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, '[PHONE]').replace(/\b\d{2}-?\d{4}-?\d{4}-?\d{4}\b/g, '[ID]').replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID]').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]').replace(/\bABHA[-\w]*/gi, '[ID]').replace(/\b\d{9,}\b/g, '[NUMBER]')
  for (const n of names.flatMap((x) => x.split(/\s+/)).filter((x) => x.length >= 3)) t = t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[NAME]')
  return t
}
const nameParts = (s: Session) => [s.profile.name, s.profile.relation]
export const ageBand = (s: Session) => { const n = Number(s.profile.age); if (!s.profile.age || !Number.isFinite(n)) return 'unknown'; if (s.profile.ageUnit === 'months') return 'infant'; return n < 1 ? 'infant' : n < 12 ? 'child' : n < 18 ? 'teen' : n < 40 ? 'adult 18-39' : n < 65 ? 'adult 40-64' : 'older adult 65+' }
/** The patient's own words only — no name, phone, ABHA id, token or doctor notes. */
export function deidentified(s: Session): string {
  const en = makeUi('en-IN'), q = questionQueue(s, en), names = nameParts(s)
  const lines = [`Age group: ${ageBand(s)}`, `Sex: ${s.profile.sex || 'not stated'}`, `Patient language: ${s.lang}`, `Complaint (patient's words): ${s.concern || 'not stated'}`]
  if (s.answers.feeling_now) lines.push(`Returning patient, feeling now: ${s.answers.feeling_now}`)
  for (const x of q) if (s.answers[x.id]) lines.push(`${x.en} → ${s.answers[x.id]}`)
  for (const d of s.docs) if (d.text) lines.push(`Document text (unverified OCR): ${d.text.slice(0, 800)}`)
  return scrubText(lines.join('\n'), names)
}
export async function askLocalAI(s: Session, task: 'summarize' | 'translate', staffToken: string): Promise<{ text: string; model: string }> {
  if (s.consent !== true || s.aiProcessing !== true || s.consentLog?.aiProcessing !== true) throw new Error('This visit has no recorded patient opt-in for AI processing. No information was sent.')
  const base = (import.meta.env as unknown as Record<string, string>).VITE_API_BASE; if (!base) throw new Error('No hospital hub configured (VITE_API_BASE)')
  const text = task === 'translate' ? scrubText([s.concern, ...Object.values(s.answers)].filter(Boolean).join('\n'), nameParts(s)) : deidentified(s)
  void log('staff', `ai_${task}_requested`, s.id)
  const r = await fetch(`${base}/api/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', authorization: `Bearer ${staffToken}` }, body: JSON.stringify({ task, text, lang: s.lang, aiConsent: { enabled: true, version: s.consentLog.version, at: s.consentLog.at, textHash: s.consentLog.textHash } }) })
  const j = (await r.json()) as { text?: string; model?: string; error?: string }; if (!r.ok) throw new Error(j.error ?? `hub error ${r.status}`)
  return { text: j.text ?? '', model: j.model ?? '' }
}

/** De-identified dataset for improving the hospital's OWN model — only visits whose patient ticked the separate research consent. */
export function researchSet(sessions: Session[]) {
  return sessions.filter((s) => s.consentLog?.research === true).map((s) => ({
    ref: Math.random().toString(36).slice(2, 10), month: s.startedAt.slice(0, 7), ageGroup: ageBand(s), sex: s.profile.sex, lang: s.lang, concern: scrubText(s.concern, nameParts(s)),
    answers: Object.fromEntries(Object.entries(s.answers).map(([k, v]) => [k, scrubText(v, nameParts(s))])), flags: assessSession(s).urgent.map((f) => f.id), selfReportedPregnancy: s.profile.pregnant || undefined,
  }))
}
