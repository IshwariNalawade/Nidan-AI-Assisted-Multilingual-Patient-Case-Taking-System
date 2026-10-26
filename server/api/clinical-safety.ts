import { findSymptom } from '../../src/data/clinical.js'
import { assess, type Finding } from '../../src/lib/safety.js'
import type { AssessmentAnswer, PatientProfile, QuestionContext, SymptomKey } from '../../src/types.js'

export interface SafetyInput {
  concern: string
  answers: Record<string, unknown>
  symptomKey?: string | null
  ageYears: number | null
  sex?: string | null
}

const YES = new Set(['yes', 'y', 'true', 'हो', 'होय', 'हाँ', 'हां', 'ಹೌದು', 'അതെ', 'ஆம்', 'అవును', 'હા'])
const NO = new Set(['no', 'n', 'false', 'नाही', 'नहीं', 'नही', 'ಇಲ್ಲ', 'ഇല്ല', 'இல்லை', 'లేదు', 'ના'])
const answerText = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''
const isYes = (value: unknown): boolean => value === true || YES.has(answerText(value).trim().toLocaleLowerCase())
const isNo = (value: unknown): boolean => value === false || NO.has(answerText(value).trim().toLocaleLowerCase())

const DIRECT_URGENT: Record<string, string> = {
  sugar_wellbeing: 'Patient reports unusual drowsiness/confusion, repeated vomiting, or difficult breathing with a blood sugar concern',
  pressure_urgent: 'Patient reports current chest pain, severe breathing difficulty, fainting, or sudden weakness/speech difficulty',
  eye_vision: 'Patient reports a sudden change or loss of vision',
  ent_swallow: 'Patient reports current difficulty swallowing fluids or breathing comfortably',
  dental_urgent: 'Patient reports face/neck swelling or difficulty swallowing/breathing with a dental concern',
  allergy_urgent: 'Patient reports lip, tongue, or throat swelling or breathing difficulty with a possible allergy reaction',
  menstrual_urgent: 'Patient reports faintness, severe/rapidly worsening pain, or heavy bleeding',
  injury_warning: 'Patient reports heavy bleeding, numbness, head impact, loss of consciousness, or rapidly worsening swelling',
}

/** Recomputes red flags on the API from saved patient answers; client-provided flags are never used. */
export function deriveSafetyFindings(input: SafetyInput): Array<Pick<Finding, 'id' | 'tier' | 'label' | 'evidence' | 'note'>> {
  const age = input.ageYears
  const profile: PatientProfile = { name: '', age: age === null ? '' : String(age), sex: input.sex ?? '', preferredContact: '', demo: false }
  const answers: Record<string, AssessmentAnswer> = Object.fromEntries(
    Object.entries(input.answers).map(([questionId, value]) => {
      const text = answerText(value)
      return [questionId, { questionId, prompt: '', value: text, originalValue: text, answeredAt: '' }]
    }),
  )
  const context: QuestionContext = { answers, profile, concern: input.concern }
  const module = findSymptom((input.symptomKey ?? '') as SymptomKey | '')
  const questions = (module?.questions ?? []).filter((question) => !question.shouldAsk || question.shouldAsk(context))
  const yesPhrases = questions.filter((question) => question.answerType === 'yesno' && isYes(input.answers[question.id])).map((question) => question.label)
  const scaleValues = questions.filter((question) => question.answerType === 'scale').map((question) => Number(answerText(input.answers[question.id])) || 0)
  const explicitPregnancy = answerText(input.answers.profile_pregnancy).trim().toLocaleLowerCase()
  const pregnancyQuestionAnswers = Object.entries(input.answers).filter(([key]) => /(?:^|_)pregnancy$/i.test(key)).map(([, value]) => value)
  const pregnant: 'yes' | 'no' | 'unsure' | '' =
    YES.has(explicitPregnancy) || pregnancyQuestionAnswers.some(isYes) ? 'yes' :
      ['unsure', 'not sure', 'maybe', 'अनिश्चित', 'निश्चित नाही'].includes(explicitPregnancy) ? 'unsure' :
        (explicitPregnancy && NO.has(explicitPregnancy)) || pregnancyQuestionAnswers.some(isNo) ? 'no' : ''
  const result = assess([input.concern, ...Object.values(input.answers).map(answerText).filter(Boolean)], {
    ageYears: age,
    pregnant,
    severity: Math.max(0, ...scaleValues),
  }, yesPhrases)
  if (input.answers.feeling_now === 'Worse') result.review.push({ id: 'feeling_worse', label: 'Returning patient reports feeling worse', tier: 'review', evidence: 'feeling now: worse' })
  const directUrgent: Finding[] = Object.entries(DIRECT_URGENT).filter(([questionId]) => isYes(input.answers[questionId])).map(([id, label]) => ({ id, tier: 'urgent', label, evidence: `Yes answer: ${id}` }))
  return [...result.urgent, ...directUrgent, ...result.review].map(({ id, tier, label, evidence, note }) => ({ id, tier, label, evidence, ...(note ? { note } : {}) }))
}
