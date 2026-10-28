import { Router } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { asyncRoute } from '../utils.js'
import { synthesize, transcribe } from '../bhashini.js'

const router = Router()
const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false })
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } })

router.post('/asr', limit, upload.single('audio'), asyncRoute(async (req, res) => {
  const file = req.file
  const language = String(req.body?.language ?? '')
  if (!file || !language) return res.status(400).json({ error: 'Audio and a language are required.' })
  try {
    return res.json(await transcribe(file.buffer, file.mimetype, language))
  } catch {
    return res.status(503).json({ error: 'Bhashini ASR is unavailable. Browser voice and typing remain available.' })
  }
}))

router.post('/tts', limit, asyncRoute(async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
  const language = typeof req.body?.language === 'string' ? req.body.language : ''
  const gender = req.body?.gender === 'male' ? 'male' : 'female'
  if (!text || !language) return res.status(400).json({ error: 'Text and a language are required.' })
  try {
    return res.json(await synthesize(text, language, gender))
  } catch {
    return res.status(503).json({ error: 'Bhashini TTS is unavailable. The browser read-aloud fallback remains available.' })
  }
}))

export default router
