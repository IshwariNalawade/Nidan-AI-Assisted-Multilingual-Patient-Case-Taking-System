// Anonymous pilot metrics (no names, no answers). Used to measure intake time and voice reliability honestly.
export interface Metric { id: string; at: string; lang: string; seconds: number; completed: boolean; urgent: boolean; assisted: boolean; express: boolean; voiceTries: number; voiceOk: number; corrections: number; steps: Record<string, number> }
const KEY = 'nidan-metrics-v1'
export const readMetrics = (): Metric[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Metric[] } catch { return [] } }
let cur: { id: string; t0: number; stepAt: number; step: string; steps: Record<string, number>; tries: number; ok: number; corr: number } | null = null
export const mBegin = (id: string, step: string) => { cur = { id, t0: Date.now(), stepAt: Date.now(), step, steps: {}, tries: 0, ok: 0, corr: 0 } }
export function mStep(step: string) { if (!cur || cur.step === step) return; cur.steps[cur.step] = (cur.steps[cur.step] ?? 0) + Math.round((Date.now() - cur.stepAt) / 1000); cur.step = step; cur.stepAt = Date.now() }
export const mVoice = (ok: boolean) => { if (!cur) return; cur.tries++; if (ok) cur.ok++ }
export const mCorrection = () => { if (cur) cur.corr++ }
export function mEnd(p: { lang: string; completed: boolean; urgent: boolean; assisted: boolean; express: boolean }) {
  if (!cur) return; mStep('__end')
  const m: Metric = { id: cur.id, at: new Date().toISOString(), lang: p.lang, seconds: Math.round((Date.now() - cur.t0) / 1000), completed: p.completed, urgent: p.urgent, assisted: p.assisted, express: p.express, voiceTries: cur.tries, voiceOk: cur.ok, corrections: cur.corr, steps: cur.steps }
  cur = null
  try { localStorage.setItem(KEY, JSON.stringify([...readMetrics().filter((x) => x.id !== m.id), m].slice(-500))) } catch { /* unavailable */ }
}
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0 }
export function summarise(ms: Metric[]) {
  const done = ms.filter((m) => m.completed), tries = ms.reduce((a, m) => a + m.voiceTries, 0), ok = ms.reduce((a, m) => a + m.voiceOk, 0)
  return { sessions: ms.length, completed: done.length, completionRate: ms.length ? done.length / ms.length : 0, medianSec: med(done.map((m) => m.seconds)), meanSec: done.length ? done.reduce((a, m) => a + m.seconds, 0) / done.length : 0,
    voiceSuccess: tries ? ok / tries : null, voiceTries: tries, urgent: ms.filter((m) => m.urgent).length, assisted: ms.filter((m) => m.assisted).length, express: ms.filter((m) => m.express).length }
}
