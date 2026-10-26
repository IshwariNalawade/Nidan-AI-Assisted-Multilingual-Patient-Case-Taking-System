import { LocaleSelector, PrototypeNotice, useLocaleText } from './LocaleProvider'
import { useEffect, useState, type ReactNode } from 'react'
import { languages } from '../data/languages'
import { hasUiTranslation, uiTier } from '../i18n'
import { ocrLangs } from '../lib/ocr'
import { onDeviceCapable, recognitionSupported } from '../lib/voice'
import { vaultReady } from '../lib/vault'
import { loadAlerts } from '../lib/alerts'

type R = { name: string; status: 'pass' | 'warn' | 'fail'; detail: string; fix?: string }
const Frame = ({ a11y, title, children }: { a11y: ReactNode; title: string; children: ReactNode }) => { const _t = useLocaleText(); return ((
  <div className="app staff"><PrototypeNotice/><header className="topbar"><b className="brand-name">NIDAN<i /></b><span className="mono tiny">{_t(title)}</span><div className="top-actions"><LocaleSelector/>{a11y}<a className="btn" href="#/">← Kiosk</a></div></header><main className="main wide">{children}</main></div>)); }
const voicesFor = (tag: string) => ('speechSynthesis' in window ? window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith(tag.slice(0, 2).toLowerCase())) : false)

export function SelfTest({ a11y }: { a11y: ReactNode }) {
  const _t = useLocaleText();
  const [res, setRes] = useState<R[]>([]), [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true); const out: R[] = []; const add = (r: R) => { out.push(r); setRes([...out]) }
    add({ name: 'Secure context (needed for mic, camera, encryption)', status: window.isSecureContext ? 'pass' : 'fail', detail: window.location.origin, fix: 'Open via http://localhost or HTTPS.' })
    add({ name: 'Internet connection', status: navigator.onLine ? 'pass' : 'warn', detail: navigator.onLine ? 'online' : 'offline', fix: 'Chrome/Edge cloud speech recognition needs internet. Typing and touch still work offline.' })
    add({ name: 'Speech recognition API', status: recognitionSupported() ? 'pass' : 'fail', detail: recognitionSupported() ? 'available' : 'not available in this browser', fix: 'Use Chrome or Edge. Without it, the app falls back to typing.' })
    add({ name: 'On-device speech recognition (works offline)', status: onDeviceCapable() ? 'pass' : 'warn', detail: onDeviceCapable() ? 'browser supports it (language pack may still need installing)' : 'not supported by this browser — voice will use the cloud service', fix: 'Do not rely on voice offline. Rehearse the typing fallback.' })
    try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach((t) => t.stop()); add({ name: 'Microphone permission', status: 'pass', detail: 'granted' }) } catch { add({ name: 'Microphone permission', status: 'fail', detail: 'blocked or no microphone', fix: 'Click the lock icon in the address bar → Microphone → Allow; check Windows Privacy → Microphone.' }) }
    for (const [tag, n] of [['mr-IN', 'Marathi'], ['hi-IN', 'Hindi'], ['en-IN', 'English']] as const) add({ name: `Read-aloud voice: ${n}`, status: voicesFor(tag) ? 'pass' : 'warn', detail: voicesFor(tag) ? 'installed' : 'no voice installed on this device', fix: 'Windows Settings → Time & language → Speech → add voices. Text is always shown as a fallback.' })
    try { const st = await navigator.mediaDevices.getUserMedia({ video: true }); st.getTracks().forEach((t) => t.stop()); add({ name: 'Camera permission', status: 'pass', detail: 'granted' }) } catch { add({ name: 'Camera permission', status: 'warn', detail: 'blocked or no camera', fix: 'Allow the camera, or use file upload.' }) }
    add({ name: 'Encryption (WebCrypto)', status: crypto?.subtle ? 'pass' : 'fail', detail: crypto?.subtle ? 'available' : 'unavailable', fix: 'Needs a secure context.' })
    add({ name: 'Staff vault', status: vaultReady() ? 'pass' : 'warn', detail: vaultReady() ? 'set up' : 'not set up — intakes will NOT be saved', fix: 'Open the Staff area and set a passphrase before the demo.' })
    try { localStorage.setItem('nidan-selftest', '1'); localStorage.removeItem('nidan-selftest'); add({ name: 'Local storage', status: 'pass', detail: 'writable' }) } catch { add({ name: 'Local storage', status: 'fail', detail: 'blocked', fix: 'Disable private/incognito mode or allow site data.' }) }
    try { const r = await fetch('/ocr/lang/eng.traineddata.gz', { method: 'HEAD' }); add({ name: 'Offline OCR assets (English)', status: r.ok ? 'pass' : 'warn', detail: r.ok ? 'bundled' : 'not found — OCR will try to download language data', fix: 'Run npm install (it copies the OCR assets) or host them under /ocr.' }) } catch { add({ name: 'Offline OCR assets', status: 'warn', detail: 'could not check', fix: 'OCR may need internet on first use.' }) }
    add({ name: 'Alert channel', status: 'pass', detail: `${loadAlerts().length} alerts stored; same-browser staff board works. Cross-device needs VITE_ALERT_WEBHOOK or VITE_API_BASE.` })
    setBusy(false)
  }
  return (<Frame a11y={a11y} title={_t("DEMO-READINESS SELF-TEST")}><h1>{_t("Is this device ready for the demo?")}</h1><p className="status">{_t("Run this 10 minutes before presenting, on the actual machine and network. A red item is a thing that WILL fail on stage.")}</p>
    <button className="btn dark" onClick={() => void run()} disabled={busy}>{busy ? _t("Checking…") : _t("Run checks")}</button>
    <table className="tbl"><tbody>{res.map((r) => <tr key={_t(r.name)}><td>{r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌'}</td><td><b>{_t(r.name)}</b><br /><span className="status">{_t(r.detail)}</span>{r.fix && r.status !== 'pass' && <><br /><span className="status">→ {_t(r.fix)}</span></>}</td></tr>)}</tbody></table></Frame>)
}

export function About({ a11y }: { a11y: ReactNode }) {
  const _t = useLocaleText();
  const [, f] = useState(0); useEffect(() => { if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => f((n) => n + 1) }, [])
  return (<Frame a11y={a11y} title={_t("ABOUT · WHAT IS REAL")}><h1>{_t("What is real, and what is simulated")}</h1>
    <div className="panel"><h2>{_t("Real in this prototype")}</h2><ul><li>{_t("Voice input and read-aloud (your browser's speech features), typing and touch for everything.")}</li><li>{_t("Language list of 22 scheduled languages + English;")}{" "}<b>{_t("full interface translation only for English, Marathi, Hindi")}</b>.</li><li>{_t("Red-flag matching with negation, spelling/romanisation tolerance and age/pregnancy context; staff alert queue; hash-chained audit log; encrypted saved data; patient deletion; 30-day retention.")}</li><li>{_t("OCR of uploaded images/PDFs (Tesseract, runs in the browser) and a rule-based field finder.")}</li><li>{_t("FHIR R4 export of an intake.")}</li></ul></div>
    <div className="panel"><h2>{_t("Simulated or not built")}</h2><ul><li>{_t("ABHA/Aadhaar: demo IDs only; real-looking IDs are rejected.")}</li><li>{_t("Hospital system / ABDM gateway: not connected. FHIR is exported or POSTed to an endpoint you configure.")}</li><li>{_t("The \"Hackathon demo\" button fills a fictional patient. Nothing medical is \"decided\" by AI: the summary only restructures what the patient said.")}</li><li>{_t("Clinical content (red-flag rules, Marathi/Hindi questions) is a")}{" "}<b>{_t("draft not yet reviewed by a clinician")}</b>.</li></ul></div>
    <div className="panel"><h2>{_t("Where your data goes")}</h2><ul><li><b>{_t("Audio:")}</b> {_t("if the patient allows voice, the browser sends it to its speech service (Google for Chrome, Microsoft for Edge). NIDAN does not store audio. Typing-only is always available.")}</li><li><b>{_t("Text and photos:")}</b> {_t("stay in this browser. Saved intakes are encrypted for staff; the in-progress intake is held in memory only and wiped after 3 minutes idle.")}</li><li><b>{_t("Alerts:")}</b> {_t("the staff message contains a queue token and the warning labels, not the patient's name.")}</li></ul></div>
    <div className="panel"><h2>{_t("Language support on this device")}</h2><table className="tbl"><thead><tr><th>{_t("Language")}</th><th>{_t("Interface")}</th><th>{_t("Read-aloud voice installed here")}</th><th>{_t("OCR data")}</th></tr></thead><tbody>{languages.map((l) => <tr key={l.code}><td>{l.nativeName} <span className="status">{l.name}</span></td><td>{hasUiTranslation(l.code) ? _t("translated") : _t("English")}</td><td>{voicesFor(l.voiceTag) ? _t("yes") : _t("no")}</td><td>{ocrLangs(l.code).native ? _t("yes") : _t("English only")}</td></tr>)}</tbody></table></div></Frame>)
}
