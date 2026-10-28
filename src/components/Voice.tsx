import { useLocaleText } from './LocaleProvider'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { createRecognizer, onDeviceCapable, outputVoiceAvailable, recognitionSupported, speak, stopSpeaking, voiceLocaleCandidates } from '../lib/voice'
import { mCorrection, mVoice } from '../lib/metrics'
import { matchChoice, normDigits, spokenNumber, type Choice } from '../lib/parse'
import { languageByCode } from '../data/languages'
import type { Ui } from '../i18n'
import type { LanguageCode } from '../types'

export interface VoiceApi {
  lang: LanguageCode; ui: Ui; speakText: (t: string) => void; stopAll: () => void
  muted: boolean; autoSpeak: boolean; setMuted: (b: boolean) => void; setAutoSpeak: (b: boolean) => void
  pending: string[]; setPending: (id: string, on: boolean) => void
  voiceOptIn: '' | 'yes' | 'no'; askVoice: () => void
  primary: MutableRefObject<(() => void) | null>; voiceMissing: boolean; stoppers: MutableRefObject<Set<() => void>>
}
export const VoiceCtx = createContext<VoiceApi>(null as unknown as VoiceApi)
export const useVoice = () => useContext(VoiceCtx)
export function VoiceProvider({ value, children }: { value: VoiceApi; children: ReactNode }) {
  const _t = useLocaleText(); return <VoiceCtx.Provider value={value}>{children}</VoiceCtx.Provider> }

/** Prompts are only translated for en/mr/hi; other languages read the English text with an English voice. */
export const promptLang = (lang: LanguageCode, text = '') => (!text || /[^\x00-\x7f]/.test(text) ? languageByCode(lang).voiceTag : 'en-IN')   // speak in the patient's language whenever the text is not plain English

export function useSpeakApi(lang: LanguageCode, muted: boolean) {
  const [voiceMissing, setMissing] = useState(false)
  const bhashiniTts = String((import.meta.env as unknown as Record<string, string | undefined>).VITE_BHASHINI_TTS ?? '').toLowerCase() === 'true'
  const audio = useRef<HTMLAudioElement | null>(null)
  const speakText = useCallback((t: string) => {
    setMissing(false)
    audio.current?.pause()
    if (bhashiniTts && !muted) {
      void fetch('/api/bhashini/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify({ text: t, language: lang }) })
        .then(async (response) => response.ok ? await response.json() as { audioContent?: string; mimeType?: string } : null)
        .then((body) => {
          if (!body?.audioContent) throw new Error('no audio')
          const player = new Audio(`data:${body.mimeType ?? 'audio/wav'};base64,${body.audioContent}`)
          audio.current = player
          return player.play()
        })
        .catch(() => speak(t, promptLang(lang, t), muted, () => setMissing(true)))
      return
    }
    speak(t, promptLang(lang, t), muted, () => setMissing(true))
  }, [bhashiniTts, lang, muted])
  return { speakText, voiceMissing }
}

export function useListen(lang: LanguageCode, ui: Ui) {
  const v = useVoice()
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const rec = useRef<{ stop: () => void } | null>(null)
  const bhashiniAsr = String((import.meta.env as unknown as Record<string, string | undefined>).VITE_BHASHINI_ASR ?? '').toLowerCase() === 'true'
  const ai4BharatAsr = String((import.meta.env as unknown as Record<string, string | undefined>).VITE_AI4BHARAT_ASR ?? '').toLowerCase() === 'true'
  const stop = useCallback(() => { try { rec.current?.stop() } catch { /* already stopped */ } }, [])
  useEffect(() => { v.stoppers.current.add(stop); return () => { v.stoppers.current.delete(stop); stop() } }, [v.stoppers, stop])
  const start = useCallback((onText: (t: string, isFinal?: boolean) => void) => {
    setError('')
    if (!recognitionSupported()) { setError(ui('noRecog')); return }
    if (v.voiceOptIn !== 'yes') { v.askVoice(); return }          // voice only after the patient has been told where audio goes
    if (!navigator.onLine && !onDeviceCapable()) { setError(ui('noRecog')); return }
    stopSpeaking(); v.stopAll()
    const tags = voiceLocaleCandidates(languageByCode(lang).voiceTag)
    if ((bhashiniAsr || ai4BharatAsr) && 'MediaRecorder' in window && navigator.mediaDevices?.getUserMedia) {
      let recorder: MediaRecorder
      const chunks: Blob[] = []
      navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true, noiseSuppression: true, echoCancellation: true, channelCount: 1 } }).then((stream) => {
        recorder = new MediaRecorder(stream)
        recorder.onstart = () => setListening(true)
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
        recorder.onerror = () => { stream.getTracks().forEach((track) => track.stop()); setListening(false); setError(ui('micUnavailable')) }
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop()); setListening(false)
          const form = new FormData(); form.append('audio', new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), 'nidan-voice.webm'); form.append('language', tags[0] ?? languageByCode(lang).voiceTag)
          const response = await fetch(bhashiniAsr ? '/api/bhashini/asr' : '/api/ai4bharat/asr', { method: 'POST', body: form, credentials: 'include' }).catch(() => null)
          const body = await response?.json().catch(() => null) as { text?: unknown; error?: string } | null
          if (response?.ok && typeof body?.text === 'string' && body.text.trim()) { mVoice(true); onText(body.text.trim(), true) }
          else setError(body?.error || ui('voiceNetwork'))
        }
        rec.current = { stop: () => recorder.stop() }
        recorder.start()
      }).catch(() => setError(ui('micDenied')))
      return
    }
    const attempt = (local: boolean, tagIndex = 0) => {
      const r = createRecognizer(tags[tagIndex] ?? tags[0], {
        onStart: () => setListening(true), onEnd: () => setListening(false),
        onError: (code) => {
          if (code === 'language-not-supported' && tagIndex + 1 < tags.length) { attempt(local, tagIndex + 1); return }
          if (local && code === 'language-not-supported') { attempt(false, 0); return }      // no on-device pack: fall back to the browser service
          mVoice(false); setError(code === 'not-allowed' || code === 'service-not-allowed' ? ui('micDenied') : code === 'audio-capture' ? ui('micUnavailable') : code === 'network' ? ui('voiceNetwork') : code === 'aborted' ? '' : ui('noSpeech'))
        },
        onTranscript: (t, isFinal) => { if (isFinal) { mVoice(true); onText(t, true) } },
        onInterim: (t) => onText(t, false),
      }, local)
      if (!r) { setError(ui('noRecog')); return }
      rec.current = r
      try { r.start() } catch { setError(ui('noSpeech')) }
    }
    attempt(true, 0)
  }, [ai4BharatAsr, bhashiniAsr, lang, ui, v])
  return { listening, error, start, stop, setError, supported: recognitionSupported(), outputAvailable: outputVoiceAvailable(lang) }
}

export function MicIcon() {
  const _t = useLocaleText(); return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg> }
export function SpeakerIcon() {
  const _t = useLocaleText(); return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg> }

/** Field with speaker (reads the prompt), microphone, live status and a confirm/correct bar. */
export function VoiceInput(p: {
  id: string; label?: string; prompt: string; value: string; onChange: (v: string) => void; onConfirm?: () => void
  multiline?: boolean; kind?: 'text' | 'age' | 'phone'; placeholder?: string; invalid?: string; inputMode?: 'numeric' | 'text'; rows?: number; autoPrimary?: boolean
}) {
  const _t = useLocaleText();
  const v = useVoice(), { ui } = v
  const [heard, setHeard] = useState('')
  const [interim, setInterim] = useState('')
  const { listening, error, start, stop, setError, supported, outputAvailable } = useListen(v.lang, ui)
  const begin = useCallback(() => {
    start((raw, isFinal = true) => {
      if (!isFinal) { setInterim(raw); return }
      setInterim('')
      const text = p.kind === 'age' || p.kind === 'phone' ? spokenNumber(raw, p.kind) : raw.trim()
      if (!text) { setError(ui('noSpeech')); return }
      p.onChange(p.multiline && p.value.trim() ? `${p.value.trim()} ${text}` : text); setHeard(text); v.setPending(p.id, true)
    })
  }, [start, p, ui, v, setError])
  useEffect(() => { if (p.autoPrimary) { v.primary.current = begin; return () => { if (v.primary.current === begin) v.primary.current = null } } }, [p.autoPrimary, begin, v.primary])
  useEffect(() => () => v.setPending(p.id, false), []) // eslint-disable-line react-hooks/exhaustive-deps
  const confirm = () => { setHeard(''); setInterim(''); v.setPending(p.id, false); p.onConfirm?.() }
  const common = { id: p.id, className: 'input', value: p.value, placeholder: p.placeholder, 'aria-invalid': Boolean(p.invalid) }
  const onCh = (e: { target: { value: string } }) => { p.onChange(e.target.value); if (heard) { setHeard(''); v.setPending(p.id, false); mCorrection() } }
  return (
    <div className={'vfield' + (p.invalid ? ' invalid' : '')}>
      {p.label && (
        <div className="vlabel">
          <label htmlFor={p.id}>{p.label}</label>
          <button type="button" className="icon-btn" aria-label={ui('replay')} title={ui('replay')} onClick={() => v.speakText(p.prompt)}><SpeakerIcon /></button>
        </div>
      )}
      <div className="vrow">
        {p.multiline ? <textarea {...common} rows={p.rows ?? 4} onChange={onCh} /> : <input {...common} inputMode={p.inputMode} onChange={onCh} />}
        <button type="button" className={'mic-btn' + (listening ? ' live' : '')} disabled={!supported} aria-pressed={listening} aria-label={listening ? ui('stopListen') : ui('speakAns')} title={supported ? (listening ? ui('stopListen') : ui('speakAns')) : ui('noRecog')} onClick={listening ? stop : begin}><MicIcon /></button>
      </div>
      {listening && <p className="status live" role="status"><span className="pulse" />{ui('listening')}</p>}
      {listening && interim && <p className="status transcript-live" aria-live="polite">{interim}</p>}
      {error && <p className="status err" role="alert">{error}</p>}
      {!supported && <p className="status">{ui('noRecog')}</p>}
      {supported && !outputAvailable && <p className="status">{_t("Voice input may work, but this device has no installed speech-output voice for this language.")}</p>}
      {supported && v.voiceOptIn === 'no' && <p className="status">{ui('voiceOff')}</p>}
      {p.invalid && <p className="status err" role="alert">{p.invalid}</p>}
      {heard && !listening && (
        <div className="confirm-bar" role="group">
          <span>{ui('heard')} <b>“{heard}”</b> <small>{ui('editHint')} {_t("Browser confidence is not calibrated; confirm or retry.")}</small></span>
          <button type="button" className="btn small dark" onClick={confirm}>✓ {ui('correct')}</button>
          <button type="button" className="btn small" onClick={() => { setHeard(''); begin() }}>{ui('retry')}</button>
        </div>
      )}
    </div>
  )
}

/** Microphone for a fixed set of choices; selects only when exactly one option is unambiguously matched. */
export function ChoiceMic({ choices, onPick, label, primary, onMatched }: { choices: Choice[]; onPick: (v: string) => void; label: (v: string) => string; primary?: boolean; onMatched?: (v: string) => void }) {
  const _t = useLocaleText();
  const v = useVoice(), { ui } = v
  const [msg, setMsg] = useState('')
  const { listening, error, start, stop, supported } = useListen(v.lang, ui)
  const begin = useCallback(() => {
    setMsg('')
    start((raw, isFinal = true) => {
      if (!isFinal) return
      const m = matchChoice(normDigits(raw), choices)
      if (m) { onPick(m); setMsg(ui('picked', { x: label(m) })); onMatched?.(m); stop() } else setMsg(ui('unclear'))
    })
  }, [start, choices, onPick, label, onMatched, stop, ui])
  useEffect(() => { if (primary) { v.primary.current = begin; return () => { if (v.primary.current === begin) v.primary.current = null } } }, [primary, begin, v.primary])
  return (
    <div className="choice-mic">
      <button type="button" className={'btn small' + (listening ? ' live' : '')} disabled={!supported} onClick={listening ? stop : begin}><MicIcon /> {listening ? ui('listening') : ui('speakOpt')}</button>
      {(msg || error) && <span className="status" role="status">{error || msg}</span>}
      {!supported && <span className="status">{ui('noRecog')}</span>}
    </div>
  )
}

export function GuideCard({ prompt }: { prompt?: string }) {
  const _t = useLocaleText();
  const v = useVoice(), { ui } = v
  return (
    <section className="guide" aria-label={_t("AI guide")}>
      <div className="guide-icon"><MicIcon /></div>
      <div className="guide-text">
        <div className="mono">{ui('voiceTouch')} · {ui('guide')}</div>
        {prompt && <p className="guide-prompt">{prompt}</p>}
        <p>{ui('guideTip')}</p>
        {v.voiceMissing && <p className="status err" role="alert">{ui('noVoice')}</p>}
      </div>
      <div className="guide-actions">
        <button className="btn" onClick={() => prompt && v.speakText(prompt)}><SpeakerIcon /> {ui('replay')}</button>
        <button className="btn" onClick={() => v.stopAll()}>■ {ui('stop')}</button>
        <button className="btn" aria-pressed={v.muted} onClick={() => { v.setMuted(!v.muted); if (!v.muted) stopSpeaking() }}>{v.muted ? ui('unmute') : ui('mute')}</button>
        <button className="btn" aria-pressed={v.autoSpeak} onClick={() => v.setAutoSpeak(!v.autoSpeak)}>{v.autoSpeak ? '☑' : '☐'} {ui('auto')}</button>
        <button className="btn dark" onClick={() => v.primary.current?.()}><MicIcon /> {ui('speakAns')}</button>
      </div>
    </section>
  )
}
