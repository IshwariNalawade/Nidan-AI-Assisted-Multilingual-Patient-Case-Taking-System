import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { newSession } from '../src/model'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.location.hash = '' })

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
}) as Response

const profile = { id: 'fixture-patient', fullName: 'Fictional Patient', ageYears: 35, sex: null, phone: null, preferredLanguage: 'en-IN' }
const patientUser = { id: 'fixture-patient-user', email: 'patient@example.test', role: 'PATIENT', patientProfile: profile }
const staffUser = { id: 'fixture-staff', email: 'triage@example.test', role: 'STAFF', patientProfile: null }

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

describe('integrated patient resume and staff triage portal UI', () => {
  it('opens a saved patient draft from the incomplete-intakes list and restores its selected-condition question', async () => {
    const draftData = {
      ...newSession(),
      step: 'questions' as const,
      lang: 'en-IN' as const,
      symptom: 'bloodSugar' as const,
      consent: true as const,
      consentLog: { at: new Date().toISOString(), version: 'nidan-care-v1', lang: 'en-IN', by: 'self' as const, textHash: 'fictional-hash', voice: '' as const, research: false, aiProcessing: false },
      demo: false as const,
    }
    const calls: Array<{ url: string; method: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input), method = init?.method ?? 'GET'
      calls.push({ url, method })
      if (url === '/api/auth/me') return response({ user: patientUser })
      if (url === '/api/patient/assessments/drafts' && method === 'GET') return response({ drafts: [{ id: 'draft-1', symptomKey: 'bloodSugar', concern: 'Fictional concern', language: 'en-IN', startedAt: draftData.startedAt, updatedAt: new Date().toISOString() }] })
      if (url === '/api/patient/assessments/drafts/draft-1') return response({ draft: { id: 'draft-1', draftData, updatedAt: new Date().toISOString() } })
      if (url === '/api/patient/assessments/drafts' && method === 'PUT') return response({ draft: { id: 'draft-1' } })
      throw new Error(`Unexpected test API request: ${method} ${url}`)
    }))

    window.location.hash = '#/patient/drafts'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Incomplete intakes' })).toBeTruthy()
    fireEvent.click(await screen.findByRole('link', { name: 'Resume intake' }))
    expect((await screen.findAllByText(/What blood sugar or diabetes concern would you like to discuss/)).length).toBeGreaterThan(0)
    expect(calls.some((call) => call.url === '/api/patient/assessments/drafts/draft-1')).toBe(true)
  })

  it('saves triage notes and routes a case to a doctor organization using the live portal API actions', async () => {
    let triageStatus = 'PENDING'
    let triageNotes = ''
    let organizationId = 'org-demo'
    const patchBodies: Array<{ action: string; notes: string; organizationId?: string }> = []
    const caseItem = () => ({
      id: 'case-urgent-1', queueToken: 'NIDAN-DEMO123', assignedDoctorId: null, organizationId,
      status: 'SUBMITTED', triageStatus, triageNotes: triageNotes || null, triagedAt: triageStatus === 'PENDING' ? null : new Date().toISOString(),
      language: 'en-IN', consultationType: 'general', concern: 'Fictional injury concern', symptomKey: 'injury', bodyRegions: [], answers: { injury_warning: 'Yes' },
      safetyFindings: [{ id: 'injury_warning', tier: 'urgent', label: 'Patient-reported injury warning', evidence: 'Yes answer: injury_warning' }], submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      organization: { id: 'org-demo', name: 'Demo Clinic', kind: 'CLINIC' }, patient: { id: 'patient-demo', fullName: 'Fictional Patient', ageYears: 35, sex: null, preferredLanguage: 'en-IN' },
    })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input), method = init?.method ?? 'GET'
      if (url === '/api/auth/me') return response({ user: staffUser })
      if (url === '/api/staff/cases' && method === 'GET') return response({ cases: [caseItem()] })
      if (url === '/api/staff/organizations') return response({ organizations: [{ id: 'org-demo', name: 'Demo Clinic', kind: 'CLINIC' }] })
      if (url === '/api/staff/cases/case-urgent-1/triage' && method === 'PATCH') {
        const body = JSON.parse(String(init?.body)) as { action: string; notes: string; organizationId?: string }
        patchBodies.push(body)
        triageNotes = body.notes
        if (body.action === 'REFER') { triageStatus = 'REFERRED'; organizationId = body.organizationId ?? organizationId }
        else triageStatus = 'TRIAGED'
        return response({ ok: true, triageStatus })
      }
      throw new Error(`Unexpected test API request: ${method} ${url}`)
    }))

    window.location.hash = '#/staff-portal'
    const { container } = render(<App />)
    expect(await screen.findByRole('heading', { name: 'Review queue' })).toBeTruthy()
    expect(screen.getByLabelText('Staff triage queue')).toBeTruthy()
    expect(await screen.findByText('Urgent rule flag')).toBeTruthy()
    expect(await screen.findByText('Fictional injury concern')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Triage note'), { target: { value: 'Fictional handoff note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark triaged' }))
    await waitFor(() => expect(patchBodies[0]).toMatchObject({ action: 'TRIAGE', notes: 'Fictional handoff note' }))
    await waitFor(() => expect(container.querySelector('.staff-review-panel .case-detail-head .case-state-badge')?.textContent).toBe('Triaged'))
    fireEvent.click(screen.getByRole('button', { name: 'Refer to doctor queue' }))
    await waitFor(() => expect(patchBodies[1]).toMatchObject({ action: 'REFER', notes: 'Fictional handoff note', organizationId: 'org-demo' }))
    await waitFor(() => expect(container.querySelector('.staff-review-panel .case-detail-head .case-state-badge')?.textContent).toBe('Referred'))
  })

  it('presents the doctor clinical workbench and preserves case claim and review actions', async () => {
    const doctorUser = { id: 'doctor-demo', email: 'doctor@example.test', role: 'DOCTOR', organizationId: 'org-demo', organization: { id: 'org-demo', name: 'Demo Clinic', kind: 'CLINIC' }, patientProfile: null }
    let claimed = false
    let savedNotes = ''
    const visit = () => ({
      id: 'case-doctor-1', queueToken: 'NIDAN-CASE123', assignedDoctorId: claimed ? doctorUser.id : null, status: claimed ? 'IN_REVIEW' : 'SUBMITTED', triageStatus: 'REFERRED', triageNotes: 'Fictional handoff note', triagedAt: new Date().toISOString(),
      language: 'en-IN', consultationType: 'general', concern: 'Fictional recurring headache', symptomKey: 'headache', bodyRegions: [], answers: { headache_duration: 'two days' }, safetyFindings: [], submittedAt: new Date().toISOString(),
      patient: { id: 'patient-demo', fullName: 'Fictional Doctor Patient', ageYears: 35, sex: null, phone: null, preferredLanguage: 'en-IN', medicalHistory: { allergies: 'None reported' } },
      documents: [{ id: 'report-demo', originalName: 'fictional-report.pdf', mimeType: 'application/pdf', byteSize: 1200, status: 'NEEDS_CONFIRMATION', ocrText: 'Synthetic report text for testing only.', ocrMethod: 'tesseract-local', ocrConfidence: 0.71, confirmedAt: null }], reviews: [],
    })
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input), method = init?.method ?? 'GET'
      calls.push(`${method} ${url}`)
      if (url === '/api/auth/me') return response({ user: doctorUser })
      if (url === '/api/doctor/cases' && method === 'GET') return response({ cases: [visit()], organization: doctorUser.organization })
      if (url === '/api/doctor/cases/case-doctor-1/claim' && method === 'POST') { claimed = true; return response({ assessment: visit() }) }
      if (url === '/api/doctor/cases/case-doctor-1/review' && method === 'POST') {
        savedNotes = (JSON.parse(String(init?.body)) as { notes: string }).notes
        return response({ assessment: { ...visit(), reviews: [{ id: 'review-1', status: 'REVIEWED', notes: savedNotes, createdAt: new Date().toISOString(), doctor: { email: doctorUser.email } }] } })
      }
      throw new Error(`Unexpected test API request: ${method} ${url}`)
    }))

    window.location.hash = '#/doctor'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your review desk, at a glance.' })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: /Fictional Doctor Patient/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Claim case' }))
    expect(await screen.findByRole('heading', { name: 'Visit concern' })).toBeTruthy()
    fireEvent.click(screen.getByText('Intake answers and report evidence'))
    expect(await screen.findByText('Unverified OCR preview')).toBeTruthy()
    expect(await screen.findByText('Synthetic report text for testing only.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Your notes'), { target: { value: 'Fictional clinician review note' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save review' }))
    await waitFor(() => expect(savedNotes).toBe('Fictional clinician review note'))
    expect(calls.some((call) => call.includes('/doctor/cases/case-doctor-1/claim'))).toBe(true)
    expect(await screen.findByText('Review status saved.')).toBeTruthy()
  })
})
