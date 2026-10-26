export type LanguageCode = string
export type SymptomKey = 'headache' | 'fever' | 'cough' | 'stomach' | 'chest' | 'vomiting' | 'rash' | 'dizziness' | 'joint' | 'urinary' | 'fatigue' | 'bloodSugar' | 'bloodPressure' | 'eye' | 'earNoseThroat' | 'dental' | 'allergy' | 'menstrual' | 'injury'
export type StepId = 'welcome' | 'profile' | 'consent' | 'consultation' | 'concern' | 'assessment' | 'history' | 'review' | 'complete'
export type AnswerType = 'text' | 'yesno' | 'scale' | 'choice'

export interface LanguageCapability {
  code: LanguageCode
  name: string
  nativeName: string
  script: string
  text: 'full' | 'supported'
  translation: 'reviewed' | 'partial' | 'needs-review'
  recognition: 'browser-dependent' | 'limited' | 'fallback'
  synthesis: 'browser-dependent' | 'system-dependent' | 'fallback'
  voiceTag: string
  note: string
}

export interface QuestionDefinition {
  id: string
  label: string
  helper?: string
  answerType: AnswerType
  options?: string[]
  placeholder?: string
  shouldAsk?: (context: QuestionContext) => boolean
}

export interface QuestionContext {
  answers: Record<string, AssessmentAnswer>
  profile: PatientProfile
  concern: string
}

export interface AssessmentAnswer {
  questionId: string
  prompt: string
  value: string
  originalValue: string
  answeredAt: string
}

export interface PatientProfile {
  name: string
  age: string
  sex: string
  preferredContact: string
  demo: boolean
}

export interface SessionSettings {
  fontScale: number
  highContrast: boolean
  reducedMotion: boolean
  autoSpeak: boolean
  muted: boolean
}

export interface SafetyAlert {
  title: string
  message: string
  triggers: string[]
  createdAt: string
}

export interface PatientSession {
  id: string
  startedAt: string
  updatedAt: string
  language: LanguageCode
  step: StepId
  profile: PatientProfile
  consent: boolean
  consultationType: string
  ayushSystem: string
  concern: string
  symptomKey: SymptomKey | ''
  assessmentAnswers: Record<string, AssessmentAnswer>
  assessmentCursor: number
  history: {
    previousIllnesses: string
    medicines: string
    allergies: string
    familyHistory: string
    lifestyle: string
    previousCare: string
    additionalConcern: string
  }
  safetyAlert: SafetyAlert | null
  settings: SessionSettings
  reportSaved: boolean
}

export interface SavedReport {
  id: string
  savedAt: string
  patient: PatientSession
  fictional: boolean
}

export interface VoiceState {
  supported: boolean
  listening: boolean
  processing: boolean
  transcript: string
  error: string
  hasVoice: boolean
}
