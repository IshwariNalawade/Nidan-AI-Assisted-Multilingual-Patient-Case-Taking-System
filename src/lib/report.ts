import { findSymptom } from '../data/clinical'
import { assess, type Ctx, type Result } from './safety'
import { optTr, qTr } from '../data/qtr'
import qloc from '../data/qlocales.json'
import { AY_FIELDS, REGIONS } from '../data/ui-data'
import { clinicalText, makeUi, translateUiText, uiLangOf, type Ui } from '../i18n'
import { findFields } from './ocr'
import type { Session } from '../model'
import type { AssessmentAnswer, PatientProfile } from '../types'

export interface Q { id: string; label: string; en: string; type: 'text' | 'yesno' | 'scale' | 'choice'; options?: string[]; optionLabels?: string[]; helper?: string; placeholder?: string }
const idxOf = (lang: string): number => (uiLangOf(lang) === 'mr' ? 0 : uiLangOf(lang) === 'hi' ? 1 : -1)
export const optionLabel = (opt: string, lang: string): string => { const i = idxOf(lang); return i >= 0 && optTr[opt] ? optTr[opt][i] : opt }

export function questionQueue(s: Session, ui: Ui): Q[] {
  const en = makeUi('en-IN'), i = idxOf(s.lang)
  const ctx = {
    answers: Object.fromEntries(Object.entries(s.answers).map(([k, v]) => [k, { questionId: k, prompt: '', value: v, originalValue: v, answeredAt: '' } as AssessmentAnswer])),
    profile: { name: s.profile.name, age: s.profile.age, sex: s.profile.sex === 'pns' ? '' : s.profile.sex, preferredContact: '', demo: true } as PatientProfile,
    concern: s.concern,
  }
  const mod = findSymptom(s.symptom)
  const base: Q[] = (mod?.questions ?? []).filter((q) => !q.shouldAsk || q.shouldAsk(ctx)).map((q) => {
    const fallbackLabel = i >= 0 && qTr[q.id] ? qTr[q.id][i] : (qloc as Record<string, Record<string, string>>)[s.lang.split('-')[0]]?.[q.id] ?? q.label
    return {
      id: q.id,
      en: q.label,
      label: clinicalText(s.lang, `question:${q.id}:label`, fallbackLabel),
      type: q.answerType,
      options: q.options,
      optionLabels: q.options?.map((option, index) => clinicalText(s.lang, `question:${q.id}:option:${index}`, i >= 0 && optTr[option] ? optTr[option][i] : option)),
      helper: q.helper ? clinicalText(s.lang, `question:${q.id}:helper`, q.helper) : undefined,
      placeholder: q.placeholder ? clinicalText(s.lang, `question:${q.id}:placeholder`, q.placeholder) : undefined,
    }
  })
  const extra: Q[] = []
  if (s.body.includes('lowerBack')) extra.push({ id: 'back_radiation', en: en('backQ'), label: ui('backQ'), type: 'text', helper: ui('backH') })
  const meds: Q = { id: 'hist_meds', en: en('hMeds'), label: ui('hMeds'), type: 'text' }, allergy: Q = { id: 'hist_allergy', en: en('hAllergy'), label: ui('hAllergy'), type: 'text' }
  if (s.profile.type === 'returning')   // returning patients: only what changed (the full history stays with staff)
    return [{ id: 'changed', en: en('qChanged'), label: ui('qChanged'), type: 'text' }, ...base.slice(0, 3), ...extra, meds, allergy]
  return [...base, ...extra, { id: 'hist_prev', en: en('hPrev'), label: ui('hPrev'), type: 'text' }, meds, allergy]
}

export const ctxOf = (s: Session, severity = 0): Ctx => {
  const n = Number(s.profile.age), has = s.profile.age.trim() !== '' && Number.isFinite(n), months = s.profile.ageUnit === 'months'
  const woman = s.profile.sex === 'female' && !(has && !months && (n < 12 || n > 55))
  return { ageYears: has ? (months ? Math.floor(n / 12) : n) : null, ageMonths: has && months ? n : null, pregnant: woman ? s.profile.pregnant : '', severity }
}
const DIRECT_URGENT_ANSWERS: Record<string, string> = {
  sugar_wellbeing: 'Patient reports unusual drowsiness/confusion, repeated vomiting, or difficult breathing with a blood sugar concern',
  pressure_urgent: 'Patient reports current chest pain, severe breathing difficulty, fainting, or sudden weakness/speech difficulty',
  eye_vision: 'Patient reports a sudden change or loss of vision',
  ent_swallow: 'Patient reports current difficulty swallowing fluids or breathing comfortably',
  dental_urgent: 'Patient reports face/neck swelling or difficulty swallowing/breathing with a dental concern',
  allergy_urgent: 'Patient reports lip, tongue, or throat swelling or breathing difficulty with a possible allergy reaction',
  menstrual_urgent: 'Patient reports faintness, severe/rapidly worsening pain, or heavy bleeding',
  injury_warning: 'Patient reports heavy bleeding, numbness, head impact, loss of consciousness, or rapidly worsening swelling',
}
/** Assess ONLY what the patient said/typed/uploaded (never the question wording). */
export function assessSession(s: Session): Result {
  const en = makeUi('en-IN'), q = questionQueue(s, en)
  const texts = [s.concern, ...q.filter((x) => x.type === 'text' || x.type === 'choice').map((x) => s.answers[x.id] ?? ''), ...s.docs.map((d) => d.text)].filter((t) => t && t.trim())
  const yes = q.filter((x) => x.type === 'yesno' && s.answers[x.id] === 'Yes').map((x) => x.en)
  const sev = Math.max(0, ...q.filter((x) => x.type === 'scale').map((x) => Number(s.answers[x.id]) || 0))
  const r = assess(texts, ctxOf(s, sev), yes)
  for (const [id, label] of Object.entries(DIRECT_URGENT_ANSWERS)) {
    if (s.answers[id] === 'Yes' && !r.urgent.some((finding) => finding.id === id)) r.urgent.push({ id, label, tier: 'urgent', evidence: `Yes answer: ${id}` })
  }
  if (s.answers.feeling_now === 'Worse') r.review.push({ id: 'feeling_worse', label: 'Returning patient reports feeling worse', tier: 'review', evidence: 'feeling now: worse' })
  return r
}
export const safetyTriggers = (s: Session): string[] => assessSession(s).urgent.map((f) => f.label)

export interface Section { title: string; lines: string[] }
export function summarySections(s: Session, ui: Ui): Section[] {
  const np = ui('notProvided'), v = (x?: string) => (x && x.trim() ? x.trim() : np)
  const text = (source: string) => translateUiText(s.lang, source)
  const q = questionQueue(s, ui), mod = findSymptom(s.symptom), li = idxOf(s.lang)
  const who = s.profile.forWho === 'self' ? '' : ` (${text(s.profile.forWho === 'child' ? 'child' : 'family member')} — ${text('answered by')} ${s.profile.relation || text('guardian')})`
  const preg = s.profile.pregnant ? `${text('Pregnancy')}: ${s.profile.pregnant}` : ''
  const sex = s.profile.sex === 'male' ? ui('male') : s.profile.sex === 'female' ? ui('female') : s.profile.sex === 'pns' ? ui('pns') : np
  const sections: Section[] = [
    { title: ui('h_patient') + who, lines: [`${ui('fullName')}: ${v(s.profile.name)}`, `${ui('age')}: ${v(s.profile.age)}${s.profile.age && s.profile.ageUnit === 'months' ? ` ${text('months')}` : ''}`, ...(preg ? [preg] : []), ...(s.token ? [`${text('Queue token')}: ${s.token}`] : []), `${ui('sex')}: ${sex}`, `${ui('phone')}: ${v(s.profile.phone)}`, `${text('ABHA (demo)')}: ${v(s.profile.abha)}`] },
    { title: ui('h_cons'), lines: [s.consultation === 'ayush' ? `${ui('ayushC')}${s.ayushSystem ? ' — ' + clinicalText(s.lang, `ayush:${s.ayushSystem}`, s.ayushSystem) : ''}` : ui('general')] },
    ...(s.answers.feeling_now ? [{ title: text('Feeling now (returning patient)'), lines: [s.answers.feeling_now] }] : []),
    { title: ui('h_concern'), lines: [v(s.concern), ...(mod ? [`→ ${clinicalText(s.lang, `symptom:${mod.key}:label`, li >= 0 ? (({ headache: 'डोकेदुखी' } as Record<string, string>)[mod.key] ?? mod.label) : mod.label)}`] : [])] },
    { title: ui('h_body'), lines: [s.body.length ? s.body.map((id) => { const r = REGIONS.find((x) => x.id === id); return r ? clinicalText(s.lang, `region:${r.id}`, li >= 0 ? r.tr[li] : r.en) : id }).join(', ') : np] },
    { title: ui('h_ans'), lines: q.map((x) => { const answer = s.answers[x.id]; const index = x.options?.indexOf(answer) ?? -1; const label = x.type === 'choice' && index >= 0 ? x.optionLabels?.[index] ?? optionLabel(answer, s.lang) : answer; return `${x.label}\n   → ${answer ? label : np}` }) },
  ]
  if (s.consultation === 'ayush') sections.push({ title: ui('h_ay'), lines: AY_FIELDS.map((f) => `${ui(f.label)}: ${s.ayHist[f.k] ? ui('o_' + s.ayHist[f.k]) : np}`) })
  sections.push({
    title: ui('h_reports'),
    lines: s.docs.length ? s.docs.map((d) => {
      const f = findFields(d.text), j = (a: string[]) => (a.length ? a.join(' | ') : ui('notFound'))
      return `${d.name} [${d.source}${d.method ? ', ' + d.method : ''}]\n   ${ui('f_med')}: ${j(f.medicines)}\n   ${ui('f_tests')}: ${j(f.tests)}\n   ${ui('f_allergy')}: ${j(f.allergies)}\n   ${ui('f_obs')}: ${j(f.observations)}\n   TEXT: ${d.text.replace(/\s+/g, ' ').slice(0, 600)}`
    }) : [np],
  })
  const r = assessSession(s), all = [...r.urgent, ...r.review]
  sections.push({ title: ui('h_safety'), lines: all.length ? all.map((f) => `${f.tier === 'urgent' ? '🚨 URGENT' : '⚠ REVIEW'}: ${f.label} — matched “${f.evidence}”${f.note ? ' (' + f.note + ')' : ''}`) : [ui('none')] })
  return sections
}
export function summaryText(s: Session, ui: Ui): string {
  return [`NIDAN — ${ui('sumTitle')} (${new Date(s.startedAt).toLocaleString()})`, '', ...summarySections(s, ui).flatMap((x) => [`## ${x.title}`, ...x.lines, '']), ui('disclaimer')].join('\n')
}
export function download(name: string, mime: string, content: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
