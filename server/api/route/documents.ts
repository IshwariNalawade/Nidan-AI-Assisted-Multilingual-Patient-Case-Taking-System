import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { DocumentStatus, UserRole } from '@prisma/client'
import { z } from 'zod'
import { env } from '../config.js'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../security.js'
import { documentStorageKey, readDocumentObject, removeDocumentObject, saveDocumentObject } from '../storage.js'
import { asyncRoute, audit } from '../utils.js'

const router = Router()
const execFileAsync = promisify(execFile)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } })
const uploadRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false })
const allowed = new Map([['application/pdf', '.pdf'], ['image/jpeg', '.jpg'], ['image/png', '.png']])
function sniff(mime: string, data: Buffer) {
  if (mime === 'application/pdf') return data.subarray(0, 5).toString() === '%PDF-'
  if (mime === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  if (mime === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  return false
}
async function scanFile(bytes: Buffer) {
  if (env.CLAMAV_SCAN !== 'required') return true
  const filePath = path.join(tmpdir(), `nidan-scan-${randomUUID()}`)
  try {
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 })
    await execFileAsync('clamdscan', ['--no-summary', '--fdpass', filePath], { timeout: 30_000 })
    return true
  } catch { return false } finally { await unlink(filePath).catch(() => {}) }
}
async function authorizedDocument(id: string, userId: string, role: UserRole) {
  if (role === UserRole.PATIENT) return prisma.medicalDocument.findFirst({ where: { id, patient: { userId } } })
  return prisma.medicalDocument.findFirst({ where: { id, assessment: { assignedDoctorId: userId } } })
}
router.post('/', uploadRateLimit, requireAuth, requireRole(UserRole.PATIENT), upload.single('file'), asyncRoute(async (req, res) => {
  const file = req.file, profile = req.authUser!.patientProfile
  if (!file || !profile) return res.status(400).json({ error: 'Choose a PDF, JPG or PNG report.' })
  const ext = allowed.get(file.mimetype)
  if (!ext || !sniff(file.mimetype, file.buffer)) return res.status(415).json({ error: 'File contents do not match a supported PDF, JPG or PNG type.' })
  let assessmentId: string | undefined
  if (req.body.assessmentId) {
    const assessment = await prisma.assessment.findFirst({ where: { id: String(req.body.assessmentId), patientId: profile.id } })
    if (!assessment) return res.status(404).json({ error: 'Assessment not found.' })
    assessmentId = assessment.id
  }
  if (!(await scanFile(file.buffer))) return res.status(422).json({ error: 'The uploaded document did not pass the configured malware scan.' })
  const id = randomUUID(), storageKey = documentStorageKey(id, ext)
  await saveDocumentObject(storageKey, file.mimetype, file.buffer)
  const document = await prisma.medicalDocument.create({ data: { patientId: profile.id, assessmentId, originalName: path.basename(file.originalname).slice(0, 180), mimeType: file.mimetype, byteSize: file.size, status: DocumentStatus.UPLOADED, storageKey, sha256: createHash('sha256').update(file.buffer).digest('hex') }, select: { id: true, originalName: true, mimeType: true, byteSize: true, status: true, createdAt: true } })
  await audit(req.authUser!.id, 'document_uploaded', 'medical_document', document.id)
  return res.status(201).json({ document })
}))
router.post('/:id/confirm', requireAuth, requireRole(UserRole.PATIENT), asyncRoute(async (req, res) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(50000), method: z.enum(['pdf-text', 'ocr', 'ai4bharat-ocr', 'typed']).default('typed'), confidence: z.number().int().min(0).max(100).nullable().optional() }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Confirm the corrected extracted text before saving.' })
  const p = req.authUser!.patientProfile!
  const found = await prisma.medicalDocument.findFirst({ where: { id: req.params.id, patientId: p.id } })
  if (!found) return res.status(404).json({ error: 'Report not found.' })
  const document = await prisma.medicalDocument.update({ where: { id: found.id }, data: { status: DocumentStatus.CONFIRMED, ocrText: parsed.data.text, ocrMethod: parsed.data.method, ocrConfidence: parsed.data.confidence ?? null, confirmedAt: new Date(), confirmedBy: req.authUser!.id }, select: { id: true, originalName: true, status: true, ocrText: true, ocrMethod: true, ocrConfidence: true, confirmedAt: true } })
  await audit(req.authUser!.id, 'document_text_confirmed', 'medical_document', document.id)
  return res.json({ document })
}))
router.get('/:id/file', requireAuth, asyncRoute(async (req, res) => {
  const doc = await authorizedDocument(req.params.id, req.authUser!.id, req.authUser!.role)
  if (!doc) return res.status(404).json({ error: 'Report not found.' })
  const file = await readDocumentObject(doc.storageKey)
  if (!file) return res.status(404).json({ error: 'The private report file is unavailable.' })
  res.setHeader('Content-Type', doc.mimeType)
  res.setHeader('Content-Length', String(file.length))
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`)
  res.setHeader('Cache-Control', 'private, no-store')
  return res.send(file)
}))
router.delete('/:id', requireAuth, requireRole(UserRole.PATIENT), asyncRoute(async (req, res) => {
  const p = req.authUser!.patientProfile!
  const doc = await prisma.medicalDocument.findFirst({ where: { id: req.params.id, patientId: p.id } })
  if (!doc) return res.status(404).json({ error: 'Report not found.' })
  await prisma.medicalDocument.delete({ where: { id: doc.id } })
  const storageErasure = await removeDocumentObject(doc.storageKey)
  await audit(req.authUser!.id, 'document_deleted', 'medical_document', doc.id)
  return res.json({ ok: true, storageErasure })
}))
export default router
