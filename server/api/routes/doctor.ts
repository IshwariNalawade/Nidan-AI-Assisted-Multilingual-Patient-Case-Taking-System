import { AssessmentStatus, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../security.js'
import { asyncRoute, audit } from '../utils.js'

const router = Router()
router.use(requireAuth, requireRole(UserRole.DOCTOR))
const caseSelect = { id: true, queueToken: true, assignedDoctorId: true, status: true, triageStatus: true, triageNotes: true, triagedAt: true, language: true, consultationType: true, ayushSystem: true, concern: true, symptomKey: true, bodyRegions: true, answers: true, safetyFindings: true, submittedAt: true, updatedAt: true, patient: { select: { id: true, fullName: true, ageYears: true, sex: true, preferredLanguage: true, medicalHistory: { select: { conditions: true, allergies: true, medications: true, familyHistory: true, additionalNotes: true, updatedAt: true } } } }, documents: { select: { id: true, originalName: true, mimeType: true, byteSize: true, status: true, ocrText: true, ocrMethod: true, ocrConfidence: true, confirmedAt: true, createdAt: true } }, reviews: { orderBy: { createdAt: 'desc' as const }, take: 5, select: { id: true, status: true, notes: true, createdAt: true, doctor: { select: { id: true, email: true } } } } } as const
const queueSelect = { id: true, queueToken: true, assignedDoctorId: true, status: true, triageStatus: true, triageNotes: true, triagedAt: true, language: true, consultationType: true, symptomKey: true, safetyFindings: true, submittedAt: true, updatedAt: true } as const
router.get('/cases', asyncRoute(async (req, res) => {
  const doctorId = req.authUser!.id, organizationId = req.authUser!.organizationId
  const [assigned, unassigned] = await Promise.all([
    prisma.assessment.findMany({ where: { status: { in: [AssessmentStatus.SUBMITTED, AssessmentStatus.IN_REVIEW] }, assignedDoctorId: doctorId, ...(organizationId ? { organizationId } : {}) }, orderBy: { submittedAt: 'asc' }, select: caseSelect }),
    organizationId ? prisma.assessment.findMany({ where: { status: AssessmentStatus.SUBMITTED, assignedDoctorId: null, organizationId }, orderBy: { submittedAt: 'asc' }, select: queueSelect }) : Promise.resolve([]),
  ])
  const cases = [...assigned, ...unassigned]
  cases.sort((a, b) => Number(Array.isArray(b.safetyFindings) && b.safetyFindings.some((x) => (x as { tier?: string }).tier === 'urgent')) - Number(Array.isArray(a.safetyFindings) && a.safetyFindings.some((x) => (x as { tier?: string }).tier === 'urgent')))
  return res.json({ cases, organization: req.authUser!.organization, visibility: req.authUser!.organization ? 'organization-scoped' : 'no-organization-assigned' })
}))
router.post('/cases/:id/claim', asyncRoute(async (req, res) => {
  const id = req.params.id, doctorId = req.authUser!.id, organizationId = req.authUser!.organizationId
  const changed = await prisma.assessment.updateMany({ where: { id, ...(organizationId ? { organizationId } : { assignedDoctorId: doctorId }), status: { in: [AssessmentStatus.SUBMITTED, AssessmentStatus.IN_REVIEW] }, OR: [{ assignedDoctorId: null }, { assignedDoctorId: doctorId }] }, data: { assignedDoctorId: doctorId, status: AssessmentStatus.IN_REVIEW } })
  if (!changed.count) return res.status(409).json({ error: 'This case is unavailable or assigned to another clinician.' })
  await audit(doctorId, 'case_claimed', 'assessment', id)
  const assessment = await prisma.assessment.findFirst({ where: { id, assignedDoctorId: doctorId, ...(organizationId ? { organizationId } : {}) }, select: caseSelect })
  return res.json({ assessment })
}))
router.get('/cases/:id', asyncRoute(async (req, res) => {
  const assessment = await prisma.assessment.findFirst({ where: { id: req.params.id, assignedDoctorId: req.authUser!.id, ...(req.authUser!.organizationId ? { organizationId: req.authUser!.organizationId } : {}) }, select: caseSelect })
  if (!assessment) return res.status(404).json({ error: 'Assigned case not found.' })
  return res.json({ assessment })
}))
router.get('/cases/token/:token', asyncRoute(async (req, res) => {
  const token = req.params.token.trim().toUpperCase(), organizationId = req.authUser!.organizationId
  const assessment = await prisma.assessment.findFirst({ where: { queueToken: token, ...(organizationId ? { organizationId } : {}) }, select: queueSelect })
  if (!assessment) return res.status(404).json({ error: 'No case was found for that token in your organization.' })
  if (assessment.assignedDoctorId && assessment.assignedDoctorId !== req.authUser!.id) return res.status(403).json({ error: 'This token is assigned to another clinician.' })
  return res.json({ assessment, visibility: assessment.assignedDoctorId ? 'full-after-assignment' : 'limited-unassigned' })
}))
router.post('/cases/:id/review', asyncRoute(async (req, res) => {
  const parsed = z.object({ status: z.enum(['IN_REVIEW', 'REVIEWED']), notes: z.string().max(10000).default('') }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Review values are invalid.' })
  const doctorId = req.authUser!.id
  const found = await prisma.assessment.findFirst({ where: { id: req.params.id, assignedDoctorId: doctorId, ...(req.authUser!.organizationId ? { organizationId: req.authUser!.organizationId } : {}) } })
  if (!found) return res.status(404).json({ error: 'Assigned case not found.' })
  const status = parsed.data.status as AssessmentStatus
  const result = await prisma.$transaction(async (tx) => {
    await tx.assessment.update({ where: { id: found.id }, data: { status } })
    const review = await tx.doctorReview.create({ data: { assessmentId: found.id, doctorId, status, notes: parsed.data.notes } })
    const assessment = await tx.assessment.findUnique({ where: { id: found.id }, select: caseSelect })
    return { review, assessment }
  })
  await audit(doctorId, 'case_review_updated', 'assessment', found.id)
  return res.json(result)
}))
export default router
