export interface User {
  id: string
  email: string
  role: 'PATIENT' | 'DOCTOR' | 'STAFF'
  organizationId?: string | null
  organization?: { id: string; name: string; kind: string } | null
  patientProfile: Profile | null
}

export interface Profile {
  id: string
  fullName: string
  ageYears: number | null
  sex: string | null
  phone: string | null
  preferredLanguage: string
}

export interface Doc {
  id: string
  originalName: string
  mimeType: string
  byteSize: number
  status: string
  ocrText?: string | null
  ocrMethod?: string | null
  ocrConfidence?: number | null
  confirmedAt?: string | null
  createdAt?: string
}

export interface Assessment {
  id: string
  queueToken?: string | null
  assignedDoctorId?: string | null
  status: string
  triageStatus?: string
  triageNotes?: string | null
  triagedAt?: string | null
  language: string
  consultationType: string
  ayushSystem?: string | null
  concern?: string
  symptomKey?: string | null
  bodyRegions?: string[]
  answers?: Record<string, unknown>
  safetyFindings?: Array<{ id: string; tier: string; label: string; evidence: string }>
  submittedAt: string
  createdAt?: string
  updatedAt?: string
  documents?: Doc[]
  patient?: Profile & { medicalHistory?: Record<string, string> | null }
  reviews?: Array<{ id: string; status: string; notes: string; createdAt: string; doctor: { email: string } }>
}

export interface ClinicalReview {
  primarySymptom: string
  duration: string
  severity: number
  translatedSummary: string
  soap: { subjective: string; objective: string; assessment: string; plan: string }
  followUpQuestions: string[]
  missingInformation: string[]
  triage: { level: 'RED' | 'YELLOW' | 'GREEN'; label: string; evidence: string[] }
  sourceLanguage: string
  method: 'gemini' | 'rule-based'
}

export interface IntakeDraft {
  id: string
  symptomKey: string | null
  concern: string
  language: string
  startedAt: string | null
  updatedAt: string
}

export interface TriageCase extends Omit<Assessment, 'patient'> {
  assignedDoctorId?: string | null
  organizationId?: string | null
  patient: Pick<Profile, 'id' | 'fullName' | 'ageYears' | 'sex' | 'preferredLanguage'>
  organization?: { id: string; name: string; kind: string } | null
}

export interface CareOrganization {
  id: string
  name: string
  kind: string
}
