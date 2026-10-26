import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import request from 'supertest'
import { describe, expect, it, afterAll, beforeAll } from 'vitest'
import { UserRole } from '@prisma/client'
import { createApp } from './app.js'
import { env } from './config.js'
import { prisma } from './db.js'
import { readDocumentObject, removeDocumentObject } from './storage.js'

const enabled = process.env.NIDAN_RUN_PERSISTENCE_TESTS === 'YES'
const integrationDescribe = describe.skipIf(!enabled)
const tag = randomUUID().replaceAll('-', '')
const patientEmail = `patient-${tag}@nidan.invalid`
const otherPatientEmail = `other-${tag}@nidan.invalid`
const doctorEmail = `doctor-${tag}@nidan.invalid`
const password = 'Local-Test-Password-9382'
const origin = 'http://localhost:3000'
const app = createApp()
let connected = false
let storedKey: string | null = null
let organizationId: string | null = null

integrationDescribe('NIDAN MySQL persistence and ownership integration', () => {
  beforeAll(async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? '')
    if (databaseUrl.protocol !== 'mysql:' || !databaseUrl.pathname.toLowerCase().includes('nidan_test')) {
      throw new Error('Safety stop: integration tests require a disposable MySQL database whose name includes nidan_test.')
    }
    if (!new Set(['localhost', '127.0.0.1', '::1']).has(databaseUrl.hostname.toLowerCase())) {
      throw new Error('Safety stop: persistence integration tests may run only against loopback MySQL; the managed database is shared with publication.')
    }
    if (env.NIDAN_STORAGE_BACKEND !== 'local') throw new Error('Safety stop: integration tests require NIDAN_STORAGE_BACKEND=local; do not create test objects in hosted project storage.')
    await prisma.$connect()
    connected = true
  })

  afterAll(async () => {
    if (!connected) return
    try {
      const documents = await prisma.medicalDocument.findMany({ where: { patient: { user: { email: { in: [patientEmail, otherPatientEmail] } } } }, select: { storageKey: true } })
      for (const doc of documents) await removeDocumentObject(doc.storageKey).catch(() => false)
      if (storedKey) await removeDocumentObject(storedKey).catch(() => false)
      await prisma.user.deleteMany({ where: { email: { in: [patientEmail, otherPatientEmail] } } })
      await prisma.user.deleteMany({ where: { email: doctorEmail } })
      if (organizationId) await prisma.organization.delete({ where: { id: organizationId } })
    } finally { await prisma.$disconnect() }
  })

  it('persists records across reconnects and enforces patient/doctor ownership on assessment and files', async () => {
    const patient = request.agent(app)
    const otherPatient = request.agent(app)
    const doctor = request.agent(app)
    const organization = await prisma.organization.create({ data: { slug: `test-${tag}`, name: 'Synthetic Test Organization' } })
    organizationId = organization.id

    const registered = await patient.post('/api/auth/register').set('Origin', origin).send({ name: 'Test Patient', email: patientEmail, password, language: 'en-IN' })
    expect(registered.status).toBe(201)
    expect(registered.body.user.role).toBe('PATIENT')
    await prisma.user.update({ where: { id: registered.body.user.id }, data: { organizationId } })
    expect(registered.headers['set-cookie']?.[0]).toContain('HttpOnly')
    const expectedSameSite = env.PUBLIC_HTTPS || process.env.MANUS_ADDON_PREVIEW_PUBLIC_ORIGIN?.startsWith('https://') ? 'None' : 'Lax'
    expect(registered.headers['set-cookie']?.[0]).toContain(`SameSite=${expectedSameSite}`)
    expect((await patient.get('/api/patient/profile')).body.profile.fullName).toBe('Test Patient')

    const history = { conditions: 'Patient test condition', allergies: 'None reported', medications: 'Patient test medicine', familyHistory: 'Not provided', additionalNotes: 'Synthetic integration fixture' }
    expect((await patient.put('/api/patient/history').set('Origin', origin).send(history)).status).toBe(200)
    expect((await patient.get('/api/patient/history')).body.history.conditions).toBe(history.conditions)

    const sourceSessionId = randomUUID()
    const assessmentResponse = await patient.post('/api/patient/assessments').set('Origin', origin).send({ sourceSessionId, language: 'en-IN', consultationType: 'general', concern: 'Routine follow-up for mild tiredness', symptomKey: 'chest', bodyRegions: [], answers: { duration: '2 days', severity: 3, chest_current: 'No' }, consent: { careConsent: true, researchConsent: false, aiProcessing: false, version: 'nidan-care-v1' } })
    expect(assessmentResponse.status).toBe(201)
    const assessmentId = assessmentResponse.body.assessment.id as string
    expect(assessmentId).toBeTruthy()
    expect(assessmentResponse.body.assessment.safetyFindings).toEqual([])
    const duplicate = await patient.post('/api/patient/assessments').set('Origin', origin).send({ sourceSessionId, language: 'en-IN', consultationType: 'general', concern: 'Routine follow-up for mild tiredness', symptomKey: 'chest', answers: { duration: '2 days', severity: 3, chest_current: 'No' }, consent: { careConsent: true } })
    expect(duplicate.status).toBe(200)
    expect(duplicate.body.duplicate).toBe(true)
    const forged = await patient.post('/api/patient/assessments').set('Origin', origin).send({ sourceSessionId: randomUUID(), language: 'en-IN', consultationType: 'general', concern: 'Routine follow-up', answers: {}, safetyFindings: [{ id: 'made_up', tier: 'urgent', label: 'Forged emergency', evidence: 'client supplied' }], consent: { careConsent: true } })
    expect(forged.status).toBe(400)
    const edit = await patient.patch(`/api/patient/assessments/${assessmentId}`).set('Origin', origin).send({ concern: 'Chest pressure now', answers: { duration: '2 days', chest_current: 'Yes' } })
    expect(edit.status).toBe(200)
    expect(edit.body.assessment.safetyFindings).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'chest_pain', tier: 'urgent' })]))

    const otherRegistration = await otherPatient.post('/api/auth/register').set('Origin', origin).send({ name: 'Other Test Patient', email: otherPatientEmail, password, language: 'en-IN' })
    expect(otherRegistration.status).toBe(201)
    expect((await otherPatient.get(`/api/patient/assessments/${assessmentId}`)).status).toBe(404)
    expect((await otherPatient.get('/api/doctor/cases')).status).toBe(403)

    const pdf = Buffer.from('%PDF-1.4\nNIDAN SYNTHETIC TEST PDF\n%%EOF\n')
    const uploaded = await patient.post('/api/documents').set('Origin', origin).field('assessmentId', assessmentId).attach('file', pdf, { filename: `synthetic-${tag}.pdf`, contentType: 'application/pdf' })
    expect(uploaded.status).toBe(201)
    const documentId = uploaded.body.document.id as string
    const storedDocument = await prisma.medicalDocument.findUniqueOrThrow({ where: { id: documentId } })
    storedKey = storedDocument.storageKey
    expect((await patient.get(`/api/documents/${documentId}/file`)).status).toBe(200)
    expect((await otherPatient.get(`/api/documents/${documentId}/file`)).status).toBe(404)
    expect((await otherPatient.post(`/api/documents/${documentId}/confirm`).set('Origin', origin).send({ text: 'spoof' })).status).toBe(404)
    expect((await patient.post(`/api/documents/${documentId}/confirm`).set('Origin', origin).send({ text: 'Synthetic confirmed text: test serum marker result was reported.' })).status).toBe(200)
    expect((await patient.post('/api/documents').set('Origin', origin).attach('file', Buffer.from('not a PDF'), { filename: 'fake.pdf', contentType: 'application/pdf' })).status).toBe(415)
    const deletable = await patient.post('/api/documents').set('Origin', origin).attach('file', pdf, { filename: `delete-${tag}.pdf`, contentType: 'application/pdf' })
    expect(deletable.status).toBe(201)
    expect((await patient.delete(`/api/documents/${deletable.body.document.id}`).set('Origin', origin)).body.ok).toBe(true)
    expect((await patient.get(`/api/documents/${deletable.body.document.id}/file`)).status).toBe(404)

    expect((await patient.post(`/api/patient/assessments/${assessmentId}/ai-consent`).set('Origin', origin).send({ allow: true })).status).toBe(200)
    const draft = await patient.post('/api/ai/draft').set('Origin', origin).send({ assessmentId, task: 'summary' })
    expect(draft.status).toBe(200)
    expect(draft.body.method).toBe('rule-based')
    expect(draft.body.providerConfigured).toBe(false)
    expect(draft.body.note).toMatch(/no AI call is claimed/i)
    expect(draft.body.output.safety).toMatch(/urgent rule-based finding/i)
    expect(JSON.stringify(draft.body.output)).toContain('Synthetic confirmed text')
    expect((await otherPatient.post('/api/ai/draft').set('Origin', origin).send({ assessmentId })).status).toBe(404)
    expect((await patient.post(`/api/patient/assessments/${assessmentId}/ai-consent`).set('Origin', origin).send({ allow: false })).status).toBe(200)
    expect((await patient.post('/api/ai/draft').set('Origin', origin).send({ assessmentId })).status).toBe(403)

    const doctorHash = await bcrypt.hash(password, 4)
    await prisma.user.create({ data: { email: doctorEmail, passwordHash: doctorHash, role: UserRole.DOCTOR, organizationId } })
    expect((await doctor.post('/api/auth/login').set('Origin', origin).send({ email: doctorEmail, password })).status).toBe(200)
    expect((await doctor.get(`/api/doctor/cases/${assessmentId}`)).status).toBe(404)
    expect((await doctor.get('/api/doctor/cases')).body.cases.some((c: { id: string }) => c.id === assessmentId)).toBe(true)
    const claim = await doctor.post(`/api/doctor/cases/${assessmentId}/claim`).set('Origin', origin).send({})
    expect(claim.status).toBe(200)
    expect(claim.body.assessment.patient.medicalHistory.conditions).toBe(history.conditions)
    expect((await patient.patch(`/api/patient/assessments/${assessmentId}`).set('Origin', origin).send({ concern: 'Changed after claim' })).status).toBe(409)
    const review = await doctor.post(`/api/doctor/cases/${assessmentId}/review`).set('Origin', origin).send({ status: 'REVIEWED', notes: 'Synthetic clinician review note' })
    expect(review.status).toBe(200)
    expect(review.body.assessment.status).toBe('REVIEWED')
    expect((await doctor.get(`/api/documents/${documentId}/file`)).status).toBe(200)
    expect((await patient.get(`/api/patient/assessments/${assessmentId}`)).body.assessment.reviews).toBeUndefined()

    await prisma.$disconnect()
    await prisma.$connect()
    expect((await prisma.assessment.findUniqueOrThrow({ where: { id: assessmentId } })).status).toBe('REVIEWED')
    expect((await patient.post('/api/auth/logout').set('Origin', origin)).status).toBe(200)
    expect((await patient.get('/api/auth/me')).status).toBe(401)

    const retained = await readDocumentObject(storedKey!)
    expect(retained?.equals(pdf)).toBe(true)
  }, 30000)
})
