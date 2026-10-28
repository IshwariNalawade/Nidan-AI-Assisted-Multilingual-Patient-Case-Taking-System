import { AssessmentStatus, Prisma, UserRole } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../security.js'
import { asyncRoute, audit } from '../utils.js'
import { deriveSafetyFindings } from '../clinical-safety.js'

const router = Router()
const CARE_CONSENT_VERSION = 'nidan-care-v1'
const assessmentRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false })
const queueToken = () => `NIDAN-${randomBytes(4).toString('hex').toUpperCase()}`
const profileSchema = z.object({ fullName: z.string().trim().min(2).max(120).optional(), ageYears: z.number().int().min(0).max(120).nullable().optional(), sex: z.string().max(30).nullable().optional(), phone: z.string().max(30).nullable().optional(), preferredLanguage: z.string().max(20).optional() }).strict()
const answerSchema = z.record(z.string().max(120), z.union([z.string().max(50000), z.number(), z.boolean()]))
const draftDataSchema = z.object({
  id: z.string().min(6).max(100), startedAt: z.string().max(40), lang: z.string().max(20),
  step: z.enum(['welcome', 'language', 'patient', 'register', 'consent', 'consultation', 'ayushSys', 'concern', 'body', 'ayHist', 'questions', 'reports', 'safety', 'summary', 'review', 'done']),
  profile: z.object({ name: z.string().max(120), age: z.string().max(3), ageUnit: z.enum(['years', 'months']), sex: z.enum(['', 'male', 'female', 'pns']), phone: z.string().max(30), abha: z.string().max(40), type: z.enum(['', 'new', 'returning']), forWho: z.enum(['self', 'child', 'other']), relation: z.string().max(120), pregnant: z.enum(['', 'yes', 'no', 'unsure']) }).strict(),
  pid: z.string().max(128), research: z.boolean(), aiProcessing: z.boolean(), consent: z.literal(true), guardian: z.boolean(),
  consentLog: z.object({ at: z.string().max(40), version: z.string().max(80), lang: z.string().max(20), by: z.enum(['self', 'guardian']), textHash: z.string().max(128), voice: z.enum(['yes', 'no', '']), research: z.boolean(), aiProcessing: z.boolean() }).strict().nullable(),
  voiceOptIn: z.enum(['', 'yes', 'no']), assisted: z.boolean(), express: z.boolean(), demo: z.literal(false), token: z.string().max(100),
  consultation: z.enum(['', 'general', 'ayush']), ayushSystem: z.string().max(80), concern: z.string().max(5000), symptom: z.string().max(80),
  body: z.array(z.string().max(50)).max(30), ayHist: z.record(z.string().max(80), z.string().max(200)), answers: z.record(z.string().max(120), z.string().max(50000)), qi: z.number().int().min(0).max(100),
  docs: z.array(z.never()).max(0).default([]), notes: z.string().max(10000), reviewedAt: z.string().max(40), settings: z.object({ autoSpeak: z.boolean(), muted: z.boolean() }).strict(),
}).strict()
const draftSchema = z.object({ sourceSessionId: z.string().min(6).max(100), language: z.string().max(20), draftData: draftDataSchema }).strict()
const assessmentSchema = z.object({
  sourceSessionId: z.string().min(6).max(100).optional(), language: z.string().max(20), consultationType: z.enum(['general', 'ayush']), ayushSystem: z.string().max(80).optional().nullable(), concern: z.string().trim().min(1).max(5000), symptomKey: z.string().max(80).optional().nullable(), bodyRegions: z.array(z.string().max(50)).max(30).default([]), answers: answerSchema.default({}),
  consent: z.object({ careConsent: z.literal(true), researchConsent: z.boolean().default(false), aiProcessing: z.boolean().default(false), version: z.literal(CARE_CONSENT_VERSION).default(CARE_CONSENT_VERSION) }).strict(),
}).strict()
const historySchema = z.object({ conditions: z.string().max(5000), allergies: z.string().max(5000), medications: z.string().max(5000), familyHistory: z.string().max(5000), additionalNotes: z.string().max(5000) }).strict()
const safeAssessment = { id: true, queueToken: true, status: true, triageStatus: true, language: true, consultationType: true, ayushSystem: true, concern: true, symptomKey: true, bodyRegions: true, answers: true, safetyFindings: true, submittedAt: true, createdAt: true, updatedAt: true, documents: { select: { id: true, originalName: true, mimeType: true, byteSize: true, status: true, ocrText: true, ocrMethod: true, ocrConfidence: true, confirmedAt: true, createdAt: true } } } as const
router.use(requireAuth, requireRole(UserRole.PATIENT))

router.get('/profile', asyncRoute(async (req, res) => {
  const p = req.authUser!.patientProfile
  if (!p) return res.status(404).json({ error: 'Patient profile not found.' })
  return res.json({ profile: p })
}))
router.patch('/profile', asyncRoute(async (req, res) => {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Profile values are invalid.' })
  const p = req.authUser!.patientProfile
  if (!p) return res.status(404).json({ error: 'Patient profile not found.' })
  const updated = await prisma.patientProfile.update({ where: { id: p.id }, data: parsed.data })
  await audit(req.authUser!.id, 'patient_profile_updated', 'patient_profile', p.id)
  return res.json({ profile: updated })
}))
router.get('/history', asyncRoute(async (req, res) => {
  const p = req.authUser!.patientProfile!
  const history = await prisma.medicalHistory.findUnique({ where: { patientId: p.id } })
  return res.json({ history })
}))
router.get('/documents', asyncRoute(async (req, res) => {
  const documents = await prisma.medicalDocument.findMany({ where: { patientId: req.authUser!.patientProfile!.id }, orderBy: { createdAt: 'desc' }, select: { id: true, originalName: true, mimeType: true, byteSize: true, status: true, ocrText: true, ocrMethod: true, ocrConfidence: true, confirmedAt: true, createdAt: true } })
  return res.json({ documents })
}))
router.get('/assessments/drafts', asyncRoute(async (req, res) => {
  const drafts = await prisma.assessment.findMany({ where: { patientId: req.authUser!.patientProfile!.id, status: AssessmentStatus.DRAFT }, orderBy: { updatedAt: 'desc' }, select: { id: true, symptomKey: true, concern: true, language: true, startedAt: true, updatedAt: true } })
  return res.json({ drafts })
}))
router.get('/assessments/drafts/:id', asyncRoute(async (req, res) => {
  const draft = await prisma.assessment.findFirst({ where: { id: req.params.id, patientId: req.authUser!.patientProfile!.id, status: AssessmentStatus.DRAFT }, select: { id: true, draftData: true, updatedAt: true } })
  if (!draft || !draft.draftData) return res.status(404).json({ error: 'Incomplete intake not found.' })
  return res.json({ draft })
}))
router.put('/assessments/drafts', assessmentRateLimit, asyncRoute(async (req, res) => {
  const parsed = draftSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Draft intake values are invalid or too large.' })
  if (parsed.data.sourceSessionId !== parsed.data.draftData.id) return res.status(400).json({ error: 'Draft session identity does not match.' })
  const profile = req.authUser!.patientProfile!
  const patientId = profile.id
  const session = parsed.data.draftData
  const existing = await prisma.assessment.findUnique({ where: { sourceSessionId: parsed.data.sourceSessionId } })
  if (existing && existing.patientId !== patientId) return res.status(409).json({ error: 'This intake session is already owned by another account.' })
  if (existing && existing.status !== AssessmentStatus.DRAFT) return res.status(409).json({ error: 'This intake has already been submitted and can no longer be saved as a draft.' })
  const updated = await prisma.$transaction(async (tx) => {
    const consent = existing?.consentId
      ? await tx.consent.update({ where: { id: existing.consentId }, data: { careConsent: true, researchConsent: session.research, aiProcessing: session.aiProcessing, language: parsed.data.language, version: session.consentLog?.version ?? CARE_CONSENT_VERSION } })
      : await tx.consent.create({ data: { patientId, careConsent: true, researchConsent: session.research, aiProcessing: session.aiProcessing, language: parsed.data.language, version: session.consentLog?.version ?? CARE_CONSENT_VERSION } })
    const values = { consentId: consent.id, language: parsed.data.language, consultationType: session.consultation || 'general', ayushSystem: session.ayushSystem || null, concern: session.concern, symptomKey: session.symptom || null, bodyRegions: session.body as Prisma.InputJsonValue, answers: session.answers as Prisma.InputJsonValue, draftData: session as unknown as Prisma.InputJsonValue, status: AssessmentStatus.DRAFT, startedAt: new Date(session.startedAt) }
    return existing
      ? tx.assessment.update({ where: { id: existing.id }, data: values, select: { id: true, symptomKey: true, concern: true, language: true, updatedAt: true } })
      : tx.assessment.create({ data: { ...values, patientId, sourceSessionId: parsed.data.sourceSessionId }, select: { id: true, symptomKey: true, concern: true, language: true, updatedAt: true } })
  })
  if (!existing) await audit(req.authUser!.id, 'patient_intake_draft_created', 'assessment', updated.id)
  return res.json({ draft: updated })
}))
router.post('/assessments/:id/ai-consent', asyncRoute(async (req, res) => {
  const parsed = z.object({ allow: z.boolean() }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'AI processing consent choice is required.' })
  const patientId = req.authUser!.patientProfile!.id
  const assessment = await prisma.assessment.findFirst({ where: { id: req.params.id, patientId } })
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' })
  const consent = await prisma.consent.create({ data: { patientId, careConsent: true, researchConsent: false, aiProcessing: parsed.data.allow, language: assessment.language, version: 'nidan-ai-processing-v1' } })
  await prisma.assessment.update({ where: { id: assessment.id }, data: { consentId: consent.id } })
  await audit(req.authUser!.id, parsed.data.allow ? 'ai_processing_consent_given' : 'ai_processing_consent_withdrawn', 'assessment', assessment.id)
  return res.json({ aiProcessing: consent.aiProcessing, consentedAt: consent.createdAt })
}))
router.put('/history', asyncRoute(async (req, res) => {
  const parsed = historySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Medical history values are invalid.' })
  const patientId = req.authUser!.patientProfile!.id
  const history = await prisma.medicalHistory.upsert({ where: { patientId }, create: { patientId, ...parsed.data }, update: parsed.data })
  await audit(req.authUser!.id, 'patient_history_updated', 'medical_history', history.id)
  return res.json({ history })
}))
router.get('/assessments', asyncRoute(async (req, res) => {
  const rows = await prisma.assessment.findMany({ where: { patientId: req.authUser!.patientProfile!.id, status: { not: AssessmentStatus.DRAFT } }, orderBy: { submittedAt: 'desc' }, select: safeAssessment })
  return res.json({ assessments: rows })
}))
router.post('/assessments', assessmentRateLimit, asyncRoute(async (req, res) => {
  const parsed = assessmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Assessment is incomplete or invalid.', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) })
  const profile = req.authUser!.patientProfile!
  const patientId = profile.id
  const existing = parsed.data.sourceSessionId ? await prisma.assessment.findUnique({ where: { sourceSessionId: parsed.data.sourceSessionId } }) : null
  if (existing && existing.patientId !== patientId) return res.status(409).json({ error: 'This intake session is already owned by another account.' })
  if (existing && existing.status !== AssessmentStatus.DRAFT) {
    const saved = await prisma.assessment.findUnique({ where: { id: existing.id }, select: safeAssessment })
    return res.status(200).json({ assessment: saved, duplicate: true })
  }
  const findings = deriveSafetyFindings({ concern: parsed.data.concern, answers: parsed.data.answers, symptomKey: parsed.data.symptomKey, ageYears: profile.ageYears, sex: profile.sex })
  const created = await prisma.$transaction(async (tx) => {
    const consent = existing?.consentId
      ? await tx.consent.update({ where: { id: existing.consentId }, data: { careConsent: true, researchConsent: parsed.data.consent.researchConsent, aiProcessing: parsed.data.consent.aiProcessing, language: parsed.data.language, version: parsed.data.consent.version } })
      : await tx.consent.create({ data: { patientId, careConsent: true, researchConsent: parsed.data.consent.researchConsent, aiProcessing: parsed.data.consent.aiProcessing, language: parsed.data.language, version: parsed.data.consent.version } })
    const values = { organizationId: req.authUser!.organizationId, queueToken: queueToken(), consentId: consent.id, language: parsed.data.language, consultationType: parsed.data.consultationType, ayushSystem: parsed.data.ayushSystem ?? null, concern: parsed.data.concern, symptomKey: parsed.data.symptomKey ?? null, bodyRegions: parsed.data.bodyRegions as Prisma.InputJsonValue, answers: parsed.data.answers as Prisma.InputJsonValue, safetyFindings: findings as Prisma.InputJsonValue, status: AssessmentStatus.SUBMITTED, draftData: Prisma.DbNull, submittedAt: new Date() }
    return existing
      ? tx.assessment.update({ where: { id: existing.id }, data: values, select: safeAssessment })
      : tx.assessment.create({ data: { ...values, patientId, sourceSessionId: parsed.data.sourceSessionId }, select: safeAssessment })
  })
  await audit(req.authUser!.id, existing ? 'patient_intake_draft_submitted' : 'assessment_submitted', 'assessment', created.id)
  return res.status(201).json({ assessment: created })
}))
router.get('/assessments/:id', asyncRoute(async (req, res) => {
  const assessment = await prisma.assessment.findFirst({ where: { id: req.params.id, patientId: req.authUser!.patientProfile!.id }, select: safeAssessment })
  if (!assessment) return res.status(404).json({ error: 'Assessment not found.' })
  return res.json({ assessment })
}))
router.patch('/assessments/:id', asyncRoute(async (req, res) => {
  const parsed = z.object({ answers: answerSchema.optional(), concern: z.string().trim().min(1).max(5000).optional() }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Assessment changes are invalid.' })
  const profile = req.authUser!.patientProfile!
  const owned = await prisma.assessment.findFirst({ where: { id: req.params.id, patientId: profile.id } })
  if (!owned) return res.status(404).json({ error: 'Assessment not found.' })
  if (owned.status !== AssessmentStatus.SUBMITTED) return res.status(409).json({ error: 'An assessment already in clinician review cannot be edited here.' })
  const oldAnswers = owned.answers && typeof owned.answers === 'object' && !Array.isArray(owned.answers) ? owned.answers as Record<string, unknown> : {}
  const answers = parsed.data.answers ?? oldAnswers
  const concern = parsed.data.concern ?? owned.concern
  const findings = deriveSafetyFindings({ concern, answers, symptomKey: owned.symptomKey, ageYears: profile.ageYears, sex: profile.sex })
  const updateData = { ...(parsed.data.concern !== undefined ? { concern: parsed.data.concern } : {}), ...(parsed.data.answers !== undefined ? { answers: parsed.data.answers as never } : {}), safetyFindings: findings as never }
  const assessment = await prisma.assessment.update({ where: { id: owned.id }, data: updateData, select: safeAssessment })
  await audit(req.authUser!.id, 'assessment_updated', 'assessment', assessment.id)
  return res.json({ assessment })
}))

export default router
