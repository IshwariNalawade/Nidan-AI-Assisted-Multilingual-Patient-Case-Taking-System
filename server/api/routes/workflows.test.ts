import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssessmentStatus } from '@prisma/client'

const Triage = { PENDING: 'PENDING', REFERRED: 'REFERRED' } as const

const { prisma } = vi.hoisted(() => ({
  prisma: {
    assessment: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    organization: { findMany: vi.fn(), findUnique: vi.fn() },
    consent: { create: vi.fn(), update: vi.fn() },
    auditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('../db.js', () => ({ prisma }))
vi.mock('../security.js', () => ({
  requireAuth: (req: { header: (name: string) => string | undefined }, res: { status: (code: number) => { json: (body: unknown) => unknown }; json: (body: unknown) => unknown }, next: () => void) => {
    const role = req.header('x-test-role')
    if (!role) return res.status(401).json({ error: 'Authentication required.' })
    ;(req as unknown as { authUser: unknown }).authUser = {
      id: role === 'STAFF' ? 'fixture-staff' : 'fixture-patient-user', email: `${role.toLowerCase()}@example.test`, role,
      organizationId: null, organization: null,
      patientProfile: role === 'PATIENT' ? { id: 'fixture-patient', fullName: 'Fictional Patient', ageYears: 35, sex: null, preferredLanguage: 'en-IN', phone: null } : null,
    }
    next()
  },
  requireRole: (role: string) => (req: { authUser?: { role?: string } }, res: { status: (code: number) => { json: (body: unknown) => unknown } }, next: () => void) =>
    req.authUser?.role === role ? next() : res.status(403).json({ error: 'Forbidden.' }),
}))

import patientRouter from './patient.js'
import staffRouter from './staff.js'
import { newSession } from '../../../src/model.js'

const app = express()
app.use(express.json())
app.use('/api/patient', patientRouter)
app.use('/api/staff', staffRouter)

const fakeAssessment = (id: string, answers: Record<string, unknown>, offset: number) => ({
  id, queueToken: `NIDAN-${id}`, assignedDoctorId: null, status: AssessmentStatus.SUBMITTED,
  triageStatus: Triage.PENDING, triageNotes: null, triagedAt: null, organizationId: 'org-demo',
  language: 'en-IN', consultationType: 'general', ayushSystem: null, concern: 'Fictional demo intake',
  symptomKey: 'injury', bodyRegions: [], answers, submittedAt: new Date(1_700_000_000_000 + offset), updatedAt: new Date(1_700_000_000_000 + offset),
  organization: { id: 'org-demo', name: 'Demo Clinic', kind: 'CLINIC' },
  patient: { id: `patient-${id}`, fullName: `Fictional ${id}`, ageYears: 35, sex: null, preferredLanguage: 'en-IN' },
})

beforeEach(() => {
  for (const group of [prisma.assessment, prisma.organization, prisma.consent, prisma.auditEvent]) {
    for (const fn of Object.values(group)) if (typeof fn === 'function' && 'mockReset' in fn) (fn as ReturnType<typeof vi.fn>).mockReset()
  }
  prisma.$transaction.mockReset()
  prisma.auditEvent.create.mockResolvedValue({ id: 'fixture-audit' })
  prisma.organization.findMany.mockResolvedValue([{ id: 'org-demo', name: 'Demo Clinic', kind: 'CLINIC' }])
})

describe('patient draft and staff triage API workflows (isolated mocks)', () => {
  it('lists and restores only the signed-in patient’s incomplete drafts', async () => {
    prisma.assessment.findMany.mockResolvedValue([{ id: 'draft-owner-only', symptomKey: 'headache', concern: '', language: 'en-IN', startedAt: new Date(), updatedAt: new Date() }])
    const list = await request(app).get('/api/patient/assessments/drafts').set('x-test-role', 'PATIENT')
    expect(list.status).toBe(200)
    expect(prisma.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { patientId: 'fixture-patient', status: AssessmentStatus.DRAFT } }))

    const draftData = { ...newSession(), step: 'questions' as const, lang: 'en-IN' as const, consent: true as const, consentLog: { at: new Date().toISOString(), version: 'nidan-care-v1', lang: 'en-IN', by: 'self' as const, textHash: 'fixture-hash', voice: '' as const, research: false, aiProcessing: false } }
    prisma.assessment.findFirst.mockResolvedValue({ id: 'draft-owner-only', draftData, updatedAt: new Date() })
    const restored = await request(app).get('/api/patient/assessments/drafts/draft-owner-only').set('x-test-role', 'PATIENT')
    expect(restored.status).toBe(200)
    expect(prisma.assessment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'draft-owner-only', patientId: 'fixture-patient', status: AssessmentStatus.DRAFT } }))
  })

  it('saves consented patient draft data under the authenticated owner and excludes uploaded report bytes', async () => {
    const session = { ...newSession(), lang: 'en-IN' as const, consent: true as const, consentLog: { at: new Date().toISOString(), version: 'nidan-care-v1', lang: 'en-IN', by: 'self' as const, textHash: 'fixture-hash', voice: '' as const, research: false, aiProcessing: false }, docs: [] as never[] }
    prisma.assessment.findUnique.mockResolvedValue(null)
    const tx = {
      consent: { create: vi.fn().mockResolvedValue({ id: 'consent-fixture' }) },
      assessment: { create: vi.fn().mockResolvedValue({ id: 'draft-fixture', symptomKey: null, concern: '', language: 'en-IN', updatedAt: new Date() }), update: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx))
    const response = await request(app).put('/api/patient/assessments/drafts').set('x-test-role', 'PATIENT').send({ sourceSessionId: session.id, language: 'en-IN', draftData: session })
    expect(response.status).toBe(200)
    expect(tx.assessment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patientId: 'fixture-patient', sourceSessionId: session.id, status: AssessmentStatus.DRAFT, draftData: expect.objectContaining({ docs: [] }) }) }))
  })

  it('converts an owned draft to a submitted assessment using persisted consent and clears draft JSON', async () => {
    const session = { ...newSession(), lang: 'en-IN' as const }
    prisma.assessment.findUnique.mockResolvedValue({ id: 'draft-fixture', patientId: 'fixture-patient', status: AssessmentStatus.DRAFT, consentId: 'consent-fixture' })
    const tx = {
      consent: { update: vi.fn().mockResolvedValue({ id: 'consent-fixture' }), create: vi.fn() },
      assessment: { update: vi.fn().mockResolvedValue({ id: 'draft-fixture', status: AssessmentStatus.SUBMITTED, triageStatus: Triage.PENDING }), create: vi.fn() },
    }
    prisma.$transaction.mockImplementation(async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx))
    const response = await request(app).post('/api/patient/assessments').set('x-test-role', 'PATIENT').send({
      sourceSessionId: session.id, language: 'en-IN', consultationType: 'general', concern: 'Mild headache since yesterday', symptomKey: 'headache', bodyRegions: [], answers: { duration: '1 day' },
      consent: { careConsent: true, researchConsent: false, aiProcessing: false, version: 'nidan-care-v1' },
    })
    expect(response.status).toBe(201)
    expect(tx.consent.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'consent-fixture' }, data: expect.objectContaining({ careConsent: true }) }))
    expect(tx.assessment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'draft-fixture' }, data: expect.objectContaining({ status: AssessmentStatus.SUBMITTED, draftData: expect.anything() }) }))
  })

  it('sorts urgent cases before routine intake and saves organization referral into the doctor queue fields', async () => {
    prisma.assessment.findMany.mockResolvedValue([
      fakeAssessment('routine', {}, 0),
      fakeAssessment('urgent', { injury_warning: 'Yes' }, 1000),
    ])
    const queue = await request(app).get('/api/staff/cases').set('x-test-role', 'STAFF')
    expect(queue.status).toBe(200)
    expect(queue.body.cases.map((item: { id: string }) => item.id)).toEqual(['urgent', 'routine'])
    expect(queue.body.cases[0].safetyFindings).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'injury_warning', tier: 'urgent' })]))

    prisma.assessment.findFirst.mockResolvedValue({ id: 'urgent', assignedDoctorId: null })
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-demo' })
    prisma.assessment.updateMany.mockResolvedValue({ count: 1 })
    const referral = await request(app).patch('/api/staff/cases/urgent/triage').set('x-test-role', 'STAFF').send({ action: 'REFER', organizationId: 'org-demo', notes: 'Fictional handoff' })
    expect(referral.status).toBe(200)
    expect(referral.body.triageStatus).toBe(Triage.REFERRED)
    expect(prisma.assessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'urgent', assignedDoctorId: null }), data: expect.objectContaining({ triageStatus: Triage.REFERRED, organizationId: 'org-demo', triagedById: 'fixture-staff', triageNotes: 'Fictional handoff' }) }))
  })

  it('does not let patient accounts read the staff queue', async () => {
    const response = await request(app).get('/api/staff/cases').set('x-test-role', 'PATIENT')
    expect(response.status).toBe(403)
    expect(prisma.assessment.findMany).not.toHaveBeenCalled()
  })
})
