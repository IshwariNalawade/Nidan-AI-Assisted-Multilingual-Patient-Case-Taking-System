import type { LanguageCode, SymptomKey } from './types'
export type StepKey = 'welcome' | 'language' | 'patient' | 'register' | 'consent' | 'consultation' | 'ayushSys' | 'concern' | 'body' | 'ayHist' | 'questions' | 'reports' | 'safety' | 'summary' | 'review' | 'done'
export const STEPS: StepKey[] = ['welcome', 'language', 'patient', 'register', 'consent', 'consultation', 'ayushSys', 'concern', 'body', 'ayHist', 'questions', 'reports', 'safety', 'summary', 'review', 'done']

export interface ReportDoc {
  id: string; name: string; source: 'file' | 'scanner' | 'typed'
  status: 'processing' | 'ready' | 'failed'
  text: string; error?: string; method?: 'pdf-text' | 'ocr' | 'ai4bharat-ocr' | 'typed'; confidence?: number; thumb?: string; image?: string; originalImage?: string; langs?: string; ocrFallback?: boolean; verified?: boolean; patientConfirmed?: boolean
}
export interface ConsentLog { at: string; version: string; lang: string; by: 'self' | 'guardian'; textHash: string; voice: 'yes' | 'no' | ''; research: boolean; aiProcessing: boolean }
export interface Session {
  id: string; startedAt: string; lang: LanguageCode; step: StepKey
  profile: { name: string; age: string; ageUnit: 'years' | 'months'; sex: '' | 'male' | 'female' | 'pns'; phone: string; abha: string; type: '' | 'new' | 'returning'; forWho: 'self' | 'child' | 'other'; relation: string; pregnant: '' | 'yes' | 'no' | 'unsure' }
  pid: string; research: boolean; aiProcessing: boolean
  consent: boolean; guardian: boolean; consentLog: ConsentLog | null; voiceOptIn: '' | 'yes' | 'no'; assisted: boolean; express: boolean; demo: boolean; token: string
  consultation: '' | 'general' | 'ayush'; ayushSystem: string
  concern: string; symptom: SymptomKey | ''; body: string[]; ayHist: Record<string, string>
  answers: Record<string, string>; qi: number
  docs: ReportDoc[]; notes: string; reviewedAt: string
  settings: { autoSpeak: boolean; muted: boolean }
}
export const newSession = (): Session => ({
  id: `nidan-${Date.now()}`, startedAt: new Date().toISOString(), lang: 'mr-IN', step: 'welcome',
  profile: { name: '', age: '', ageUnit: 'years', sex: '', phone: '', abha: '', type: '', forWho: 'self', relation: '', pregnant: '' }, pid: '', research: false, aiProcessing: false, consent: false, guardian: false, consentLog: null, voiceOptIn: '', assisted: false, express: false, demo: false, token: '', consultation: '', ayushSystem: '',
  concern: '', symptom: '', body: [], ayHist: {}, answers: {}, qi: 0, docs: [], notes: '', reviewedAt: '',
  settings: { autoSpeak: true, muted: false },
})
