import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { env } from '../config.js'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../security.js'
import { asyncRoute, audit } from '../utils.js'

const router = Router()
const aiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false })
const safeText = (v: unknown, max = 2000) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const scrub = (v: string) => v.replace(/(?:(?<!\w)\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, '[PHONE]').replace(/\b\d{2}-?\d{4}-?\d{4}-?\d{4}\b/g, '[ID]').replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '[ID]').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]').replace(/\bABHA[-\w]*/gi, '[ID]')
const isLocalUrl = (input: string) => { try { const u = new URL(input); const h = u.hostname.toLowerCase(); return ['localhost','127.0.0.1','::1'].includes(h) || h.endsWith('.local') || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) } catch { return false } }
const requestSchema = z.object({ assessmentId: z.string().min(8).max(64), task: z.enum(['summary']).default('summary') }).strict()
const clinicalReviewSchema = z.object({ assessmentId: z.string().min(8).max(64) }).strict()
const reviewJsonSchema = {
  type: 'object',
  properties: {
    primarySymptom: { type: 'string' }, duration: { type: 'string' }, severity: { type: 'number' }, translatedSummary: { type: 'string' },
    soap: { type: 'object', properties: { subjective: { type: 'string' }, objective: { type: 'string' }, assessment: { type: 'string' }, plan: { type: 'string' } }, required: ['subjective', 'objective', 'assessment', 'plan'] },
    followUpQuestions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 }, missingInformation: { type: 'array', items: { type: 'string' } },
  }, required: ['primarySymptom', 'duration', 'severity', 'translatedSummary', 'soap', 'followUpQuestions', 'missingInformation'],
}

const clinicalReviewFallback = (assessment: { concern: string; language: string; symptomKey: string | null; answers: unknown; safetyFindings: unknown }) => {
  const answers = assessment.answers && typeof assessment.answers === 'object' ? assessment.answers as Record<string, unknown> : {}
  const urgent = Array.isArray(assessment.safetyFindings) ? (assessment.safetyFindings as Array<{ tier?: string; label?: string; evidence?: string }>).filter((x) => x.tier === 'urgent') : []
  const review = Array.isArray(assessment.safetyFindings) ? (assessment.safetyFindings as Array<{ tier?: string; label?: string; evidence?: string }>).filter((x) => x.tier === 'review') : []
  const triage = urgent.length ? 'RED — Emergency review now' : review.length ? 'YELLOW — Urgent clinician review' : 'GREEN — Routine review'
  return { primarySymptom: assessment.symptomKey || 'Not stated', duration: safeText(answers.duration ?? answers.duration_days ?? 'Not stated', 120), severity: Number(answers.severity ?? 0) || 0, translatedSummary: assessment.concern || 'Not stated', soap: { subjective: assessment.concern || 'Not stated', objective: 'No objective examination data recorded in this intake.', assessment: `${triage}. Rule-based safety findings: ${[...urgent, ...review].map((x) => x.label).join('; ') || 'none recorded'}.`, plan: 'Clinician to verify the patient report, complete examination, and decide next steps. This draft is not a treatment plan.' }, followUpQuestions: ['When did this concern begin, and is it getting better or worse?', 'What makes it better or worse?', 'Are there any new or severe symptoms right now?'], missingInformation: ['This fallback did not infer missing facts.'], triage: { level: urgent.length ? 'RED' : review.length ? 'YELLOW' : 'GREEN', label: triage, evidence: [...urgent, ...review].map((x) => x.evidence).filter(Boolean) }, sourceLanguage: assessment.language, method: 'rule-based' as const }
}

router.post('/ai/clinical-review', aiRateLimit, requireAuth, requireRole(UserRole.DOCTOR), asyncRoute(async (req, res) => {
  const parsed = clinicalReviewSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'A valid assessment ID is required.' })
  const user = req.authUser!, id = parsed.data.assessmentId
  const assessment = await prisma.assessment.findFirst({ where: { id, assignedDoctorId: user.id, ...(user.organizationId ? { organizationId: user.organizationId } : {}) }, select: { concern: true, language: true, symptomKey: true, answers: true, safetyFindings: true, consultationType: true, consent: { select: { aiProcessing: true } } } })
  if (!assessment) return res.status(404).json({ error: 'Assigned case not found.' })
  if (!assessment.consent?.aiProcessing) return res.status(403).json({ error: 'Separate consent for AI-assisted processing is not recorded for this assessment.' })
  const data = { language: safeText(assessment.language, 20), consultationType: assessment.consultationType, concern: scrub(safeText(assessment.concern)), symptomKey: assessment.symptomKey, answers: Object.fromEntries(Object.entries(assessment.answers && typeof assessment.answers === 'object' ? assessment.answers as Record<string, unknown> : {}).slice(0, 40).map(([key, value]) => [safeText(key, 80), scrub(safeText(value, 1000))])), serverSafetyFindings: assessment.safetyFindings }
  const fallback = clinicalReviewFallback(assessment)
  if (env.NIDAN_AI_PROVIDER !== 'gemini' || !env.GEMINI_API_KEY) return res.json(fallback)
  const system = `You are a clinical documentation assistant, not a doctor. Convert the scrubbed patient intake into structured JSON. Translate the patient wording to standard clinical English when needed, but preserve uncertainty and label it as patient-reported. Do not diagnose, prescribe, invent examination findings, or override server safety findings. SOAP Objective must say when no objective examination data is available. Assessment must say this is a draft for clinician review. Plan must be clinician verification and next-step discussion, not treatment advice. Generate exactly 2 or 3 non-diagnostic follow-up questions. Use severity 0 to 10; return 0 when not stated.`
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.NIDAN_AI_MODEL || 'gemini-3.8-flash')}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: reviewJsonSchema } }), signal: AbortSignal.timeout(30000) }).catch(() => null)
  if (!response?.ok) return res.json(fallback)
  const body = await response.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
  try {
    const raw = body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    const result = JSON.parse(raw) as { primarySymptom: string; duration: string; severity: number; translatedSummary: string; soap: { subjective: string; objective: string; assessment: string; plan: string }; followUpQuestions: string[]; missingInformation: string[] }
    if (typeof result.primarySymptom !== 'string' || typeof result.duration !== 'string' || typeof result.translatedSummary !== 'string' || !result.soap || !Array.isArray(result.followUpQuestions) || !Array.isArray(result.missingInformation)) return res.json(fallback)
    const urgent = Array.isArray(assessment.safetyFindings) ? (assessment.safetyFindings as Array<{ tier?: string; evidence?: string }>).filter((x) => x.tier === 'urgent') : []
    const review = Array.isArray(assessment.safetyFindings) ? (assessment.safetyFindings as Array<{ tier?: string; evidence?: string }>).filter((x) => x.tier === 'review') : []
    await audit(user.id, 'ai_clinical_review_created', 'assessment', id)
    return res.json({ primarySymptom: safeText(result.primarySymptom, 200), duration: safeText(result.duration, 200), severity: Math.max(0, Math.min(10, Number(result.severity) || 0)), translatedSummary: safeText(result.translatedSummary, 3000), soap: { subjective: safeText(result.soap.subjective, 4000), objective: safeText(result.soap.objective, 4000), assessment: safeText(result.soap.assessment, 4000), plan: safeText(result.soap.plan, 4000) }, followUpQuestions: result.followUpQuestions.slice(0, 3).map((x) => safeText(x, 500)), missingInformation: result.missingInformation.slice(0, 20).map((x) => safeText(x, 300)), triage: { level: urgent.length ? 'RED' : review.length ? 'YELLOW' : 'GREEN', label: urgent.length ? 'RED — Emergency review now' : review.length ? 'YELLOW — Urgent clinician review' : 'GREEN — Routine review', evidence: [...urgent, ...review].map((x) => x.evidence).filter(Boolean) }, sourceLanguage: assessment.language, method: 'gemini' })
  } catch { return res.json(fallback) }
}))
router.post('/ai/draft', aiRateLimit, requireAuth, asyncRoute(async (req, res) => {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'A valid assessment and task are required.' })
  const id = parsed.data.assessmentId, user = req.authUser!
  const assessment = await prisma.assessment.findFirst({ where: user.role === UserRole.PATIENT ? { id, patient: { userId: user.id } } : { id, assignedDoctorId: user.id }, include: { consent: true, documents: { where: { status: 'CONFIRMED' }, select: { originalName: true, ocrText: true } } } })
  if (!assessment) return res.status(404).json({ error: 'Assessment not found or not authorized.' })
  if (!assessment.consent?.aiProcessing) return res.status(403).json({ error: 'Separate consent for AI-assisted processing is not recorded for this assessment.' })
  const answers = assessment.answers && typeof assessment.answers === 'object' ? assessment.answers as Record<string, unknown> : {}
  const inputs = [{ source: 'patient-reported concern', text: safeText(assessment.concern) }, ...Object.entries(answers).slice(0, 40).map(([key, value]) => ({ source: `patient-reported answer ${safeText(key, 80)}`, text: safeText(value, 1000) })), ...assessment.documents.slice(0, 10).map((doc) => ({ source: `patient-confirmed report text: ${safeText(doc.originalName, 120)}`, text: safeText(doc.ocrText, 2500) }))].filter((item) => item.text)
  const sources = [...new Set(inputs.map((x) => x.source.split(':')[0]))]
  if (!inputs.length) return res.status(422).json({ error: 'No confirmed patient information is available for a draft.' })
  const urgent = Array.isArray(assessment.safetyFindings) ? (assessment.safetyFindings as Array<{ tier?: string; label?: string }>).filter((x) => x.tier === 'urgent').map((x) => safeText(x.label, 200)) : []
  const data = { language: safeText(assessment.language, 20), consultationType: assessment.consultationType, symptom: assessment.symptomKey, inputs: inputs.map((x) => ({ source: x.source, text: scrub(x.text) })), urgentSafetyFindings: urgent }
  const fallback = () => ({ title: 'Structured information summary', language: assessment.language, complaint: data.inputs.find((x) => x.source === 'patient-reported concern')?.text || 'Not stated', details: data.inputs.filter((x) => x.source !== 'patient-reported concern').map((x) => `${x.source}: ${x.text}`), missingInformation: ['This is a rule-based summary, not an AI analysis.', 'Duration and progression may be missing if not answered.'], safety: urgent.length ? `Urgent rule-based finding(s): ${urgent.join('; ')}. Seek immediate in-person medical assessment; call 112 in India if needed.` : 'No urgent rule-based finding was returned; this does not rule out an emergency.', disclaimer: 'Informational intake summary only; not a diagnosis or treatment recommendation. A clinician must review.' })
  let output = fallback(), method: 'local-ai' | 'gemini' | 'rule-based' = 'rule-based'
  if (env.NIDAN_AI_PROVIDER === 'ollama' && env.NIDAN_AI_BASE_URL && env.NIDAN_AI_MODEL) {
    if (!isLocalUrl(env.NIDAN_AI_BASE_URL) && !env.NIDAN_AI_ALLOW_REMOTE) return res.status(503).json({ error: 'AI provider host is not a private/local address. Remote AI is disabled to protect patient privacy.' })
    const system = `You prepare non-diagnostic patient intake summaries in ${data.language}. Use only the provided patient words and source labels. Never diagnose, prescribe, invent details, or infer missing facts. Mention uncertainty and missing facts. Return JSON with complaint:string, details:string[], missingInformation:string[]. Add no other keys.`
    const response = await fetch(`${env.NIDAN_AI_BASE_URL.replace(/\/$/, '')}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: env.NIDAN_AI_MODEL, system, prompt: JSON.stringify(data), stream: false, format: 'json', options: { temperature: 0.1 } }), signal: AbortSignal.timeout(45000) }).catch(() => null)
    if (response?.ok) {
      const body = await response.json().catch(() => null) as { response?: string } | null
      try {
        const result = JSON.parse(body?.response ?? '') as { complaint: string; details: string[]; missingInformation: string[] }
        if (typeof result.complaint === 'string' && Array.isArray(result.details) && Array.isArray(result.missingInformation)) {
          output = { title: 'AI-generated draft — unverified', language: data.language, complaint: safeText(result.complaint), details: result.details.slice(0, 20).map((x) => safeText(x)), missingInformation: result.missingInformation.slice(0, 20).map((x) => safeText(x)), safety: urgent.length ? `Urgent rule-based finding(s): ${urgent.join('; ')}. Seek immediate in-person care; call 112 in India if needed.` : 'No urgent rule-based finding was returned; this does not rule out an emergency.', disclaimer: 'Unverified informational draft only; not a diagnosis or treatment recommendation. Clinician review required.' }
          method = 'local-ai'
        }
      } catch { /* malformed model response is not surfaced as a successful AI result */ }
    }
  }
  if (env.NIDAN_AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
    const model = env.NIDAN_AI_MODEL || 'gemini-3.8-flash'
    const system = `You prepare a non-diagnostic patient intake summary in ${data.language}. Use only the scrubbed patient words and source labels supplied in the request. Never diagnose, prescribe, recommend treatment, invent details, or infer missing facts. Mention uncertainty and missing facts. Return JSON only with exactly these fields: complaint:string, details:string[], missingInformation:string[].`
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(data) }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }), signal: AbortSignal.timeout(30000) }).catch(() => null)
    if (response?.ok) {
      const body = await response.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
      const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
      try {
        const result = JSON.parse(text) as { complaint: string; details: string[]; missingInformation: string[] }
        if (typeof result.complaint === 'string' && Array.isArray(result.details) && Array.isArray(result.missingInformation)) {
          output = { title: 'Gemini-generated draft — unverified', language: data.language, complaint: safeText(result.complaint), details: result.details.slice(0, 20).map((x) => safeText(x)), missingInformation: result.missingInformation.slice(0, 20).map((x) => safeText(x)), safety: urgent.length ? `Urgent rule-based finding(s): ${urgent.join('; ')}. Seek immediate in-person care; call 112 in India if needed.` : 'No urgent rule-based finding was returned; this does not rule out an emergency.', disclaimer: 'Unverified informational draft only; not a diagnosis or treatment recommendation. Clinician review required.' }
          method = 'gemini'
        }
      } catch { /* malformed Gemini JSON keeps the transparent fallback */ }
    }
  }
  await audit(user.id, 'ai_draft_created', 'assessment', id)
  return res.json({ output, method, providerConfigured: method === 'local-ai' || method === 'gemini', sources, urgentGuidanceIndependentOfAI: true, note: method === 'local-ai' ? 'Generated by the configured local model; unverified.' : method === 'gemini' ? 'Generated by the configured Gemini provider; unverified.' : 'No usable AI provider response was available. This is an explicit rule-based fallback; no AI call is claimed.' })
}))

router.get('/experimental/handwriting/status', requireAuth, (_req, res) => res.json({ available: false, configured: Boolean(env.NIDAN_HANDWRITING_URL), experimental: true, supported: false, message: env.NIDAN_HANDWRITING_URL ? 'An endpoint URL is set, but its request/response adapter is not implemented or tested; recognition is unavailable.' : 'No handwriting-recognition model is included or configured. Existing Tesseract OCR targets printed text; handwriting support is not claimed.' }))
export default router
