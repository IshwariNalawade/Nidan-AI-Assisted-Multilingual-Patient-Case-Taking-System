import type { LanguageCode } from '../types'

interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives?: number
  processLocally?: boolean
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null
  start: () => void
  stop: () => void
}

type RecognitionConstructor = new () => RecognitionLike

/** Ordered browser locale candidates. Alternatives only vary region/script tags; NIDAN never silently changes a patient language to English. */
// Languages that browsers cannot recognise by their own tag use the closest supported recogniser (the app shows that language's text too).
const RECOG_PROXY: Record<string, string> = { kok: 'mr-IN', mai: 'hi-IN', doi: 'hi-IN', brx: 'hi-IN', sa: 'hi-IN', sat: 'hi-IN', ks: 'ur-IN', sd: 'ur-IN', mni: 'bn-IN' }
export const recognitionLang = (language: LanguageCode): string => RECOG_PROXY[language.split('-')[0].toLowerCase()] ?? language

export const voiceLocaleCandidates = (language: LanguageCode): string[] => {
  const base = language.split('-')[0].toLowerCase()
  const aliases: Record<string, string[]> = {
    en: ['en-IN', 'en-US'], bn: ['bn-IN', 'bn-BD'], gu: ['gu-IN'], hi: ['hi-IN'], kn: ['kn-IN'], ml: ['ml-IN'], mr: ['mr-IN'], ne: ['ne-IN', 'ne-NP'], or: ['or-IN'], pa: ['pa-IN'], ta: ['ta-IN'], te: ['te-IN'], ur: ['ur-IN', 'ur-PK'], as: ['as-IN'], brx: ['brx-IN'], doi: ['doi-IN'], ks: ['ks-IN'], kok: ['kok-IN'], mai: ['mai-IN'], mni: ['mni-IN'], sa: ['sa-IN'], sat: ['sat-IN'], sd: ['sd-IN'],
  }
  return [...new Set([language, ...(aliases[base] ?? [language])])]
}

export const recognitionSupported = () => Boolean((window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition)

export let lastMode: 'on-device' | 'cloud' | '' = ''
export function createRecognizer(language: string, handlers: {
  onStart: () => void
  onEnd: () => void
  onError: (code: string) => void
  onTranscript: (text: string, isFinal: boolean) => void
  onInterim?: (text: string) => void
}, local = false) {
  const browserWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  const Constructor = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition
  if (!Constructor) return null
  const recognizer = new Constructor()
  recognizer.lang = recognitionLang(language)
  if (local && 'processLocally' in recognizer) (recognizer as unknown as { processLocally: boolean }).processLocally = true // on-device recognition where the browser supports it
  lastMode = local && 'processLocally' in recognizer ? 'on-device' : 'cloud'
  // Long answers are common in intake. Continuous + interim mode lets the browser
  // return a sentence at a time instead of cutting the patient off after one phrase.
  recognizer.continuous = true
  recognizer.interimResults = true
  recognizer.maxAlternatives = 3
  recognizer.onstart = handlers.onStart
  recognizer.onend = handlers.onEnd
  recognizer.onerror = (event) => handlers.onError(event.error ?? 'unknown')
  recognizer.onresult = (event) => {
    let finalText = '', interimText = ''
    for (const result of Array.from(event.results)) {
      const text = result[0]?.transcript ?? ''
      if (result.isFinal === false) interimText += `${text} `
      else finalText += `${text} `
    }
    finalText = finalText.trim(); interimText = interimText.trim()
    if (finalText) handlers.onTranscript(finalText, true)
    if (interimText) handlers.onInterim?.(interimText)
    if (!finalText && !interimText) handlers.onError('no-speech')
  }
  return recognizer
}

// Speech-output proxies: languages with no installed browser voice borrow the closest related voice (same script / family).
const SYNTH_PROXY: Record<string, string[]> = {
  as: ['bn'], mni: ['bn'], kok: ['mr', 'hi'], mai: ['hi'], doi: ['hi', 'pa'], brx: ['hi', 'bn'], sa: ['hi', 'mr'], sat: ['hi', 'bn'], ks: ['ur', 'hi'], sd: ['ur', 'hi'], ne: ['ne', 'hi'], or: ['or', 'bn', 'hi'],
  gu: ['gu', 'hi'], kn: ['kn', 'ta'], ml: ['ml', 'ta'], pa: ['pa', 'hi'], ta: ['ta'], te: ['te', 'ta'], ur: ['ur', 'hi'], bn: ['bn'], hi: ['hi'], mr: ['mr', 'hi'],
}
const baseTag = (tag: string) => tag.split(/[-_]/)[0].toLowerCase()

export function findVoice(language: LanguageCode): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const candidates = voiceLocaleCandidates(language)
  const base = baseTag(language)
  const exact = voices.find((voice) => candidates.some((tag) => voice.lang.replace('_', '-').toLowerCase() === tag.toLowerCase()))
  const prefix = voices.find((voice) => baseTag(voice.lang) === base)
  if (exact ?? prefix) return (exact ?? prefix) as SpeechSynthesisVoice
  for (const proxy of SYNTH_PROXY[base] ?? []) { const hit = voices.find((voice) => baseTag(voice.lang) === proxy); if (hit) return hit }
  if (base === 'en') return voices.find((voice) => /^en([_-]|$)/i.test(voice.lang)) ?? voices.find((voice) => voice.default) ?? voices[0] ?? null
  // No related voice: any Hindi/Indic voice is far more intelligible for an Indian-language prompt than a Latin-only voice.
  return voices.find((voice) => /^(hi|mr|bn|ta|te|gu|kn|ml|pa|ur)([_-]|$)/i.test(voice.lang)) ?? null
}

export const outputVoiceAvailable = (language: LanguageCode) => Boolean(findVoice(language))
/** True when the voice used is a related-language stand-in rather than the language itself. */
export const usingProxyVoice = (language: LanguageCode) => { const v = findVoice(language); return Boolean(v) && baseTag(v!.lang) !== baseTag(language) }

/** Chrome/Edge silently stop long utterances (~15 s); split into sentence chunks and queue them. */
const chunkText = (text: string, max = 180): string[] => {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?।॥?۔])\s+/)
  const out: string[] = []
  for (const part of parts) {
    if (part.length <= max) { out.push(part); continue }
    let rest = part
    while (rest.length > max) { const cut = Math.max(rest.lastIndexOf(',', max), rest.lastIndexOf(' ', max), max); out.push(rest.slice(0, cut)); rest = rest.slice(cut).trim() }
    if (rest) out.push(rest)
  }
  return out.filter(Boolean)
}

export function speak(text: string, language: LanguageCode, muted: boolean, onMissing?: () => void, onDone?: () => void) {
  if (muted || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  const speakNow = () => {
    if (muted) return
    synth.cancel()
    const voice = findVoice(language)
    if (!voice) onMissing?.()
    const chunks = chunkText(text)
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk)
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang ?? recognitionLang(language)
      utterance.rate = 0.92
      if (index === chunks.length - 1 && onDone) { utterance.onend = onDone; utterance.onerror = onDone }
      synth.speak(utterance)
    })
    // Chromium/Edge can leave the queue paused after a previous interrupted utterance.
    if (typeof synth.resume === 'function') synth.resume()
  }
  if (synth.getVoices().length) { speakNow(); return }
  // Voices are often populated only after voiceschanged; wait briefly before using the browser default.
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    if (typeof synth.removeEventListener === 'function') synth.removeEventListener('voiceschanged', finish)
    speakNow()
  }
  if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', finish, { once: true })
  window.setTimeout(finish, 1200)
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export const onDeviceCapable = () => { const w = window as unknown as { SpeechRecognition?: { prototype: object }; webkitSpeechRecognition?: { prototype: object } }; const C = w.SpeechRecognition ?? w.webkitSpeechRecognition; return !!C && 'processLocally' in C.prototype }
