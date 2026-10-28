import { AssessmentStatus, TriageStatus, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../security.js'
import { asyncRoute, audit } from '../utils.js'
import { deriveSafetyFindings } from '../clinical-safety.js'

const router = Router()
router.use(requireAuth, requireRole(UserRole.STAFF))

const activeStatuses = [AssessmentStatus.SUBMITTED, AssessmentStatus.IN_REVIEW]
const triageUpdateSchema = z.object({
  action: z.enum(['TRIAGE', 'REFER']),
  notes: z.string().max(2000).default(''),
  organizationId: z.string().min(1).max(191).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.action === 'REFER' && !value.organizationId) ctx.addIssue({ code: 'custom', path: ['organizationId'], message: 'Choose a care organization before referring.' })
})

router.get('/organizations', asyncRoute(async (_req, res) => {
  const organizations = await prisma.organization.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true } })
  return res.json({ organizations })
}))

router.get('/cases', asyncRoute(async (_req, res) => {
  const rows = await prisma.assessment.findMany({
    where: { status: { in: activeStatuses } },
    orderBy: { submittedAt: 'asc' },
    select: {
      id: true, queueToken: true, assignedDoctorId: true, status: true, triageStatus: true, triageNotes: true, triagedAt: true,
      organizationId: true, language: true, consultationType: true, ayushSystem: true, concern: true,
      symptomKey: true, bodyRegions: true, answers: true, submittedAt: true, updatedAt: true,
      organization: { select: { id: true, name: true, kind: true } },
      patient: { select: { id: true, fullName: true, ageYears: true, sex: true, preferredLanguage: true } },
    },
  })
  const cases = rows.map((row) => {
    const answers = row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers) ? row.answers as Record<string, unknown> : {}
    const safetyFindings = deriveSafetyFindings({ concern: row.concern, answers, symptomKey: row.symptomKey, ageYears: row.patient.ageYears, sex: row.patient.sex })
    return { ...row, safetyFindings }
  }).sort((a, b) => {
    const urgent = Number(b.safetyFindings.some((finding) => finding.tier === 'urgent')) - Number(a.safetyFindings.some((finding) => finding.tier === 'urgent'))
    if (urgent) return urgent
    const pending = Number(a.triageStatus !== TriageStatus.PENDING) - Number(b.triageStatus !== TriageStatus.PENDING)
    if (pending) return pending
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
  })
  return res.json({ cases, visibility: 'staff-triage-only' })
}))

router.patch('/cases/:id/triage', asyncRoute(async (req, res) => {
  const parsed = triageUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid triage action and care organization.' })
  const item = await prisma.assessment.findFirst({
    where: { id: req.params.id, status: { in: activeStatuses } },
    select: { id: true, assignedDoctorId: true },
  })
  if (!item) return res.status(404).json({ error: 'Active case not found.' })
  if (parsed.data.action === 'REFER' && item.assignedDoctorId) return res.status(409).json({ error: 'This case is already assigned to a clinician and cannot be rerouted by triage.' })
  if (parsed.data.action === 'REFER' && parsed.data.organizationId) {
    const organization = await prisma.organization.findUnique({ where: { id: parsed.data.organizationId }, select: { id: true } })
    if (!organization) return res.status(400).json({ error: 'The selected care organization does not exist.' })
  }
  const triageStatus = parsed.data.action === 'REFER' ? TriageStatus.REFERRED : TriageStatus.TRIAGED
  const result = await prisma.assessment.updateMany({
    where: { id: item.id, status: { in: activeStatuses }, ...(parsed.data.action === 'REFER' ? { assignedDoctorId: null } : {}) },
    data: {
      triageStatus,
      triageNotes: parsed.data.notes,
      triagedById: req.authUser!.id,
      triagedAt: new Date(),
      ...(parsed.data.action === 'REFER' && parsed.data.organizationId ? { organizationId: parsed.data.organizationId } : {}),
    },
  })
  if (!result.count) return res.status(409).json({ error: 'This case changed or was assigned while you were triaging it. Refresh the queue.' })
  await audit(req.authUser!.id, parsed.data.action === 'REFER' ? 'case_referred_by_triage' : 'case_triaged', 'assessment', item.id)
  return res.json({ ok: true, triageStatus, triagedAt: new Date().toISOString() })
}))

export default router
