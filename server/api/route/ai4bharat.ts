import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { env } from '../config.js'
import { asyncRoute } from '../utils.js'

const router = Router()
const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false })
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } })
const languages = /^[a-z]{2,4}(?:-[A-Z]{2})?$/

async function forward(url: string | undefined, field: Express.Multer.File, language: string) {
  if (!url) return null
  const form = new FormData()
  form.append('file', new Blob([field.buffer], { type: field.mimetype }), field.originalname)
  form.append('audio', new Blob([field.buffer], { type: field.mimetype }), field.originalname)
  form.append('language', language)
  const response = await fetch(url, { method: 'POST', body: form, signal: AbortSignal.timeout(45_000) }).catch(() => null)
  if (!response?.ok) return null
  const body = await response.json().catch(() => null) as { text?: unknown; transcript?: unknown; confidence?: unknown; method?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text : typeof body?.transcript === 'string' ? body.transcript : ''
  if (!text.trim()) return null
  return { text: text.trim().slice(0, 50_000), confidence: typeof body?.confidence === 'number' ? Math.max(0, Math.min(100, Math.round(body.confidence))) : null, method: typeof body?.method === 'string' ? body.method : 'ai4bharat' }
}

router.post('/asr', limit, upload.single('audio'), asyncRoute(async (req, res) => {
  const file = req.file, language = String(req.body?.language ?? '')
  if (!file || !languages.test(language)) return res.status(400).json({ error: 'Audio and a valid language tag are required.' })
  const result = await forward(env.AI4BHARAT_ASR_URL, file, language)
  if (!result) return res.status(503).json({ error: 'AI4Bharat ASR is not configured or unavailable. Browser voice and typing remain available.' })
  return res.json({ ...result, language })
}))

router.post('/ocr', limit, upload.single('file'), asyncRoute(async (req, res) => {
  const file = req.file, language = String(req.body?.language ?? '')
  if (!file || !languages.test(language)) return res.status(400).json({ error: 'A document and a valid language tag are required.' })
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) return res.status(415).json({ error: 'Only PDF, JPG, and PNG files are supported.' })
  const result = await forward(env.AI4BHARAT_OCR_URL, file, language)
  if (!result) return res.status(503).json({ error: 'AI4Bharat OCR is not configured or unavailable. Existing local OCR remains available.' })
  return res.json({ ...result, language })
}))

export default router
