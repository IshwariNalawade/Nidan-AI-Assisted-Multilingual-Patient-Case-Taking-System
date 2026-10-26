import { describe, expect, it } from 'vitest'
import { assess, type Ctx } from '../src/lib/safety'
import { assessSession } from '../src/lib/report'
import { newSession } from '../src/model'
const adult: Ctx = { ageYears: 35, pregnant: 'no' }
const ids = (t: string, c: Ctx = adult, yes: string[] = []) => { const r = assess([t], c, yes); return { u: r.urgent.map((f) => f.id), r: r.review.map((f) => f.id), d: r.denied } }

describe('positives incl. code-mixed / romanised / spelling variants', () => {
  const pos: [string, string][] = [
    ['I have chest pain', 'chest_pain'], ['seene mein dard ho raha hai', 'chest_pain'], ['seene me bahut dard', 'chest_pain'], ['chhati dukhte aahe', 'chest_pain'], ['chhatit dukhtay', 'chest_pain'],
    ['mujhe सीने में दर्द है', 'chest_pain'], ['छातीत दुखतंय', 'chest_pain'], ['chest pressure and tightness', 'chest_pain'], ['chest paain', 'chest_pain'],
    ['saans nahi aa rahi', 'breathing'], ['saans lene mein takleef', 'breathing'], ['dhap lagte', 'breathing'], ['I cant breathe', 'breathing'], ['breathless since morning', 'breathing'], ['सांस लेने में तकलीफ', 'breathing'], ['श्वास घेता येत नाही', 'breathing'],
    ['behosh ho gaya tha aur ab theek', 'unconscious'], ['बेशुद्ध पडले', 'unconscious'], ['dora pad raha hai', 'seizure'], ['झटके येत आहेत', 'seizure'],
    ['khoon ki ulti hui', 'vomit_blood'], ['blood in vomit', 'vomit_blood'], ['bahut khoon beh raha hai', 'bleeding'], ['bleeding not stopping', 'bleeding'],
    ['मला मरावेसे वाटते', 'self_harm'], ['marne ka man karta hai', 'self_harm'], ['I want to die', 'self_harm'], ['chehra tedha ho gaya', 'stroke'], ['slurred speech', 'stroke'],
    ['saap ne kata', 'poison'], ['jahar pi liya', 'poison'], ['face swelling and throat closing', 'anaphylaxis'],
  ]
  for (const [t, id] of pos) it(`flags ${id}: “${t}”`, () => { const r = ids(t); expect([...r.u, ...r.r]).toContain(id) })
})
describe('negation does not raise a false alarm', () => {
  const neg = ['no chest pain', 'I do not have chest pain', 'without chest pain', 'seene mein dard nahi hai', 'chest pain nahi', 'छातीत दुखत नाही', 'सीने में दर्द नहीं', 'no breathlessness, no fits', 'no fever and no vomiting blood', 'denies chest pain']
  for (const t of neg) it(`ignores: “${t}”`, () => { const r = ids(t); expect(r.u).toEqual([]); expect(r.r).toEqual([]) })
  it('records that it was denied', () => expect(ids('no chest pain').d).toContain('chest_pain'))
  it('but still catches the positive clause: “no fever but chest pain”', () => expect(ids('no fever but chest pain').u).toContain('chest_pain'))
  it('and “no cough, severe chest pain”', () => expect(ids('no cough, severe chest pain').u).toContain('chest_pain'))
  it('negating one thing does not hide another: “no chest pain but cannot breathe”', () => expect(ids('no chest pain but cannot breathe').u).toEqual(['breathing']))
  it('answering NO to a yes/no question raises nothing; YES does', () => { expect(assess([], adult, []).urgent).toEqual([]); expect(assess([], adult, ['Are you having chest pain now?']).urgent.map((f) => f.id)).toContain('chest_pain') })
})
describe('uncertain / past wording is downgraded to review, never silently dropped', () => {
  it('“chest pain was there yesterday”', () => { const r = ids('chest pain was there yesterday'); expect(r.u).toEqual([]); expect(r.r).toContain('chest_pain') })
  it('“kabhi kabhi seene mein dard”', () => { const r = ids('kabhi kabhi seene mein dard'); expect(r.r).toContain('chest_pain') })
})
describe('question wording alone never triggers', () => {
  it('answers like “two days, mild” raise nothing', () => { const r = assess(['two days, mild', 'dry cough'], adult); expect(r.urgent).toEqual([]) })
})
describe('risk context', () => {
  it('fever in infant is urgent, in adult is not', () => { expect(ids('fever since 1 day', { ageYears: 0, ageMonths: 4, pregnant: '' }).u).toContain('infant_fever'); expect(ids('fever since 1 day').u).toEqual([]) })
  it('infant not feeding', () => expect(ids('baby is not feeding, very sleepy', { ageYears: 0, ageMonths: 6, pregnant: '' }).u).toContain('infant_feeding'))
  it('bleeding in pregnancy', () => { expect(ids('spotting and pain', { ageYears: 28, pregnant: 'yes' }).u).toContain('preg_bleeding'); expect(ids('spotting', { ageYears: 28, pregnant: 'no' }).u).toEqual([]) })
  it('headache + blurred vision in pregnancy', () => expect(ids('headache and blurred vision', { ageYears: 30, pregnant: 'yes' }).u).toContain('preg_headache_vision'))
  it('reduced baby movement', () => expect(ids('baby not moving since morning', { ageYears: 30, pregnant: 'yes' }).u).toContain('preg_movement'))
  it('older adult: fall -> review, confusion -> urgent; same words in a young adult do not', () => {
    const old: Ctx = { ageYears: 72, pregnant: '' }
    expect(ids('he fell in the bathroom', old).r).toContain('elder_fall'); expect(ids('he is confused today', old).u).toContain('elder_confusion')
    expect(ids('he fell in the bathroom').r).toEqual([])
  })
  it('severity 9-10 is urgent', () => expect(assess(['x'], { ...adult, severity: 9 }).urgent.map((f) => f.id)).toContain('severity'))
})
describe('evidence is kept for staff audit', () => { it('returns the matched words', () => { const f = assess(['seene mein dard'], adult).urgent[0]; expect(f.evidence).toMatch(/dard/) }) })

describe('new selected-condition urgent follow-ups alert immediately', () => {
  const cases = [
    ['bloodSugar', 'sugar_wellbeing'], ['bloodPressure', 'pressure_urgent'], ['eye', 'eye_vision'],
    ['earNoseThroat', 'ent_swallow'], ['dental', 'dental_urgent'], ['allergy', 'allergy_urgent'],
    ['menstrual', 'menstrual_urgent'], ['injury', 'injury_warning'],
  ] as const
  for (const [symptom, questionId] of cases) {
    it(`${symptom}: an affirmative warning answer becomes an urgent flag`, () => {
      const s = { ...newSession(), symptom, answers: { [questionId]: 'Yes' } }
      expect(assessSession(s).urgent.map((finding) => finding.id)).toContain(questionId)
    })
  }
  it('a No answer does not create the condition-specific alert', () => {
    const s = { ...newSession(), symptom: 'eye' as const, answers: { eye_vision: 'No' } }
    expect(assessSession(s).urgent.map((finding) => finding.id)).not.toContain('eye_vision')
  })
})
