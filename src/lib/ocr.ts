import { createWorker } from 'tesseract.js'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { LanguageCode } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Tesseract language data that exists for the scheduled languages. Others fall back to English-only OCR.
const TESS: Record<string, string> = { as: 'asm', bn: 'ben', gu: 'guj', hi: 'hin', kn: 'kan', mai: 'mai', ml: 'mal', mr: 'mar', ne: 'nep', or: 'ori', pa: 'pan', sa: 'san', sd: 'snd', ta: 'tam', te: 'tel', ur: 'urd', kok: 'kok' }
export function ocrLangs(lang: LanguageCode): { codes: string; native: boolean } {
  const base = lang.split('-')[0]
  const extra = TESS[base]
  const set = new Set(['eng'])
  if (extra) set.add(extra)
  if (base === 'mr' || base === 'hi') { set.add('hin'); set.add('mar') } // printed Marathi/Hindi often mix both
  return { codes: [...set].join('+'), native: Boolean(extra) || base === 'en' }
}

export const ACCEPT = ['application/pdf', 'image/jpeg', 'image/png']
export const MAX_BYTES = 15 * 1024 * 1024
export const validateFile = (f: File) => ACCEPT.includes(f.type) && f.size <= MAX_BYTES

export interface OcrResult { text: string; method: 'pdf-text' | 'ocr' | 'ai4bharat-ocr'; confidence?: number; langs?: string; thumb?: string; fallback?: boolean }

const ai4BharatOcrEnabled = String((import.meta.env as unknown as Record<string, string | undefined>).VITE_AI4BHARAT_OCR ?? '').toLowerCase() === 'true'
async function remoteOcr(input: Blob, lang: LanguageCode, filename: string) {
  if (!ai4BharatOcrEnabled) return null
  const form = new FormData(); form.append('file', input, filename); form.append('language', lang)
  const response = await fetch('/api/ai4bharat/ocr', { method: 'POST', body: form, credentials: 'include' }).catch(() => null)
  if (!response?.ok) return null
  const body = await response.json().catch(() => null) as { text?: unknown; confidence?: unknown } | null
  if (typeof body?.text !== 'string' || !body.text.trim()) return null
  return { text: body.text.trim(), method: 'ai4bharat-ocr' as const, confidence: typeof body.confidence === 'number' ? body.confidence : undefined, langs: lang }
}

type RecognitionResult = { text: string; confidence: number; langs: string; fallback?: boolean }
async function recognizeImage(src: string | HTMLCanvasElement, codes: string, local: boolean, onProgress: (p: number) => void): Promise<RecognitionResult> {
  const worker = await createWorker(codes, 1, {
    workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', gzip: true,
    ...(local ? { langPath: '/ocr/lang' } : {}),
    logger: (m) => { if (m.status === 'recognizing text') onProgress(m.progress) },
  })
  try {
    const { data } = await worker.recognize(src)
    return { text: data.text.trim(), confidence: data.confidence, langs: codes }
  } finally { await worker.terminate() }
}

async function ocrImage(src: string | HTMLCanvasElement, lang: LanguageCode, onProgress: (p: number) => void) {
  const { codes } = ocrLangs(lang)
  const local = codes.split('+').every((c) => ['eng', 'hin', 'mar'].includes(c))
  try {
    return await recognizeImage(src, codes, local, onProgress)
  } catch (preferredError) {
    // A selected language may need a network download. Keep the reader useful offline by retrying
    // with locally bundled packs. Hindi/Marathi already include each other; use English if those fail.
    if (codes === 'eng') throw new Error(`Bundled English OCR could not start (${preferredError instanceof Error ? preferredError.message : 'local OCR failed'}).`)
    const fallbackCodes = local ? 'eng' : ocrLangs(lang.split('-')[0] === 'hi' ? 'hi-IN' : lang.split('-')[0] === 'mr' ? 'mr-IN' : 'en-IN').codes
    try {
      const fallback = await recognizeImage(src, fallbackCodes, true, onProgress)
      return { ...fallback, fallback: true }
    } catch (fallbackError) {
      const detail = fallbackError instanceof Error ? fallbackError.message : 'local OCR could not start'
      throw new Error(`Selected-language OCR failed and the bundled English fallback could not start (${detail}).`)
    }
  }
}

export async function readImage(dataUrl: string, lang: LanguageCode, onProgress: (p: number) => void): Promise<OcrResult> {
  const encoded = dataUrl.split(',')[1]
  if (encoded && ai4BharatOcrEnabled) {
    try {
      const remote = await remoteOcr(await (await fetch(dataUrl)).blob(), lang, 'nidan-image.png')
      if (remote) { onProgress(1); return { ...remote, thumb: dataUrl } }
    } catch { /* optional remote path must never block local OCR */ }
  }
  const r = await ocrImage(dataUrl, lang, onProgress)
  return { ...r, method: 'ocr', thumb: dataUrl }
}

export async function readPdf(file: File, lang: LanguageCode, onProgress: (p: number) => void): Promise<OcrResult> {
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = Math.min(pdf.numPages, 3)
  let direct = ''
  for (let i = 1; i <= pages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent()
    direct += c.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n'
  }
  if (direct.replace(/\s/g, '').length > 40) return { text: direct.trim(), method: 'pdf-text' } // digital PDF: exact text, no OCR guess
  const remote = await remoteOcr(file, lang, file.name)
  if (remote) { onProgress(1); return remote }
  let text = '', conf = 0, langs = '', fallback = false
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i), vp = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
    const r = await ocrImage(canvas, lang, (p) => onProgress((i - 1 + p) / pages))
    text += r.text + '\n'; conf += r.confidence / pages; langs = r.langs; fallback ||= Boolean(r.fallback)
  }
  return { text: text.trim(), method: 'ocr', confidence: conf, langs, ...(fallback ? { fallback: true } : {}) }
}

export function fileToDataUrl(f: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f) })
}

export function trimImage(dataUrl: string, m: { top: number; right: number; bottom: number; left: number }, max = 1800): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const sx = (img.width * m.left) / 100, sy = (img.height * m.top) / 100
      const sw = img.width * (1 - (m.left + m.right) / 100), sh = img.height * (1 - (m.top + m.bottom) / 100)
      const k = Math.min(1, max / Math.max(sw, sh))
      const c = document.createElement('canvas'); c.width = Math.max(1, sw * k); c.height = Math.max(1, sh * k)
      c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
      res(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => rej(new Error('image load failed')); img.src = dataUrl
  })
}

// Rule-based field finder over the extracted text. It only copies lines that match; it never invents values.
export interface Fields { medicines: string[]; diagnosis: string[]; tests: string[]; allergies: string[]; observations: string[] }
export function findFields(text: string): Fields {
  const lines = text.split(/\n|;/).map((l) => l.trim()).filter(Boolean)
  const pick = (re: RegExp) => [...new Set(lines.filter((l) => re.test(l)))].slice(0, 8)
  return {
    medicines: pick(/\b(tab|tablet|cap|capsule|syp|syrup|inj|injection|drops|cream|ointment)\b|\d+\s?(mg|mcg|ml|gm)\b|गोळी|औषध|दवा/i),
    diagnosis: pick(/\b(diagnosis|dx|impression|assessment|c\/o|complaint)\b|निदान/i),
    tests: pick(/\b(cbc|crp|esr|hba1c|hemoglobin|haemoglobin|platelet|ns1|dengue|malaria|widal|lft|kft|rft|tsh|ecg|x-?ray|mri|ct scan|ultrasound|usg|urine|sugar|glucose|lipid)\b|चाचणी|जाँच/i),
    allergies: pick(/allerg|ॲलर्जी|एलर्जी/i),
    observations: pick(/\b(temp(erature)?|pulse|bp|blood pressure|spo2|rr|respiratory rate|weight|height)\b|\d{2,3}\s?\/\s?\d{2,3}\s?(mm\s?hg)?|°\s?[cf]\b/i),
  }
}
