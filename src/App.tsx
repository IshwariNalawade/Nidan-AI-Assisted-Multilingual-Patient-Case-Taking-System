import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VoiceProvider, useSpeakApi, type VoiceApi } from './components/Voice'
import type { Nav, SetFn, StepProps } from './components/Frame'
import { AyushSys, Body, Concern, Consent, Consultation, Language, Patient, Register, Welcome } from './components/Steps1'
import { AyHist, Done, Questions, Reports, Review, Safety, Summary } from './components/Steps2'
import Staff from './components/Staff'
import { AccountPortal, DoctorPortal, PatientDraftsPortal, PatientPortal, StaffPortal } from './components/Portal'
import { About, SelfTest } from './components/Tools'
import WorkspaceDashboard from './components/WorkspaceDashboard'
import PageVoice from './components/PageVoice'
import AccessHub from './components/AccessHub'
import { isRtl, makeUi, nativeName } from './i18n'
import { STEPS, newSession, type Session, type StepKey } from './model'
import { assessSession } from './lib/report'
import { stopSpeaking } from './lib/voice'
import { languageByCode } from './data/languages'
import { acknowledge as _a, dropPatientData, loadAlerts, markLeft, purgeAcknowledged, raiseAlert, subscribe, type Alert } from './lib/alerts'
import { purgeOlderThan, removeSaved, saveSession } from './lib/store'
import { vaultReady } from './lib/vault'
import { log } from './lib/audit'
import { nextToken } from './lib/token'
import { patientKey } from './lib/pid'
import { mBegin, mEnd, mStep } from './lib/metrics'
import { api as apiRequest, ApiError, json } from './lib/api'
import { LocaleProvider, useLocale, useLocaleText } from './components/LocaleProvider'
void _a

const RETENTION_DAYS = 30, IDLE_MS = 3 * 60_000
const skipped = (st: StepKey, s: Session) => (s.consultation !== 'ayush' && (st === 'ayushSys' || st === 'ayHist')) || (s.express && (st === 'register' || st === 'body' || st === 'reports'))
const Logo = () => { const _t = useLocaleText(); return (<span className="logo" aria-hidden><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="3" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6M8 14c-2 0-3-1-3.5-3M16 14c2 0 3-1 3.5-3" /></svg></span>); }
const useHash = () => { const [h, setH] = useState(window.location.hash); useEffect(() => { const f = () => setH(window.location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, []); return h }
const prefs = () => { try { return JSON.parse(localStorage.getItem('nidan-prefs') ?? '{}') as { size?: number; contrast?: boolean } } catch { return {} } }

export default function App({ initial }: { initial?: Partial<Session> }) {
  const _t = useLocaleText();
  return <LocaleProvider><AppRouter initial={initial} /></LocaleProvider>
}

function AppRouter({ initial }: { initial?: Partial<Session> }) {
  const _t = useLocaleText();
  const { language } = useLocale()
  useLocaleText()
  const hash = useHash()
  useEffect(() => {
    if (!hash.startsWith('#/') || hash.startsWith('#/resume')) return
    document.documentElement.lang = language.split('-')[0]
    document.documentElement.dir = isRtl(language) ? 'rtl' : 'ltr'
  }, [hash, language])
  const [pf, setPf] = useState(prefs)
  useEffect(() => { document.documentElement.style.fontSize = `${[100, 115, 130][pf.size ?? 0]}%`; document.documentElement.dataset.contrast = pf.contrast ? 'high' : ''; try { localStorage.setItem('nidan-prefs', JSON.stringify(pf)) } catch { /* ignore */ } }, [pf])
  const a11y = (
    <span className="a11y" role="group" aria-label={_t("Accessibility")}>
      <button className="btn small" aria-label={_t("Smaller text")} onClick={() => setPf({ ...pf, size: Math.max(0, (pf.size ?? 0) - 1) })}>A−</button>
      <button className="btn small" aria-label={_t("Larger text")} onClick={() => setPf({ ...pf, size: Math.min(2, (pf.size ?? 0) + 1) })}>A+</button>
      <button className="btn small" aria-pressed={!!pf.contrast} onClick={() => setPf({ ...pf, contrast: !pf.contrast })}>◐</button>
    </span>
  )
  if (hash.startsWith('#/staff-portal')) return <><StaffPortal /><PageVoice /></>
  if (hash.startsWith('#/access')) return <><AccessHub /><PageVoice /></>
  if (hash.startsWith('#/dashboard')) return <><WorkspaceDashboard /><PageVoice /></>
  if (hash.startsWith('#/patient/drafts')) return <PatientDraftsPortal />
  if (hash.startsWith('#/resume')) { const query = new URLSearchParams(hash.slice(hash.indexOf('?') + 1)); return <ResumeIntake draftId={query.get('id') ?? ''} a11y={a11y} /> }
  if (hash.startsWith('#/staff')) return <Staff a11y={a11y} />
  if (hash.startsWith('#/account')) return <><AccountPortal /><PageVoice /></>
  if (hash.startsWith('#/patient')) return <><PatientPortal /><PageVoice /></>
  if (hash.startsWith('#/doctor')) return <><DoctorPortal /><PageVoice /></>
  if (hash.startsWith('#/selftest')) return <SelfTest a11y={a11y} />
  if (hash.startsWith('#/about')) return <About a11y={a11y} />
  return <Kiosk initial={initial} a11y={a11y} />
}

function ResumeIntake({ draftId, a11y }: { draftId: string; a11y: React.ReactNode }) {
  const _t = useLocaleText();
  const [initial, setInitial] = useState<Partial<Session> | null>(null), [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    if (!draftId) { setError('This resume link is missing its draft ID.'); return () => { cancelled = true } }
    void apiRequest<{ draft: { draftData: Partial<Session> } }>(`/patient/assessments/drafts/${encodeURIComponent(draftId)}`)
      .then(({ draft }) => { if (!cancelled) setInitial({ ...draft.draftData, docs: [] }) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not restore this intake.') })
    return () => { cancelled = true }
  }, [draftId])
  if (error) return <div className="app"><main className="main"><section className="panel"><h1>{_t("Could not resume intake")}</h1><p className="form-error" role="alert">{error}</p><a className="btn dark" href="#/patient/drafts">{_t("Return to incomplete intakes")}</a><a className="btn" href="#/account">{_t("Sign in again")}</a></section></main></div>
  if (!initial) return <div className="app"><main className="main"><section className="panel"><p role="status">{_t("Loading your saved intake…")}</p></section></main></div>
  return <Kiosk key={draftId} initial={initial} a11y={a11y} />
}

function Kiosk({ initial, a11y }: { initial?: Partial<Session>; a11y: React.ReactNode }) {
  const [s, setS] = useState<Session>(() => { const base = newSession(); return { ...base, ...initial, profile: { ...base.profile, ...initial?.profile }, settings: { ...base.settings, ...initial?.settings }, docs: [] } })
  const _t = useLocaleText(s.lang)
  const [help, setHelp] = useState(false), [voiceAsk, setVoiceAsk] = useState(false)
  const [pending, setPendingList] = useState<string[]>([]), [alert, setAlert] = useState<Alert | null>(null)
  const [saved, setSaved] = useState<'saved' | 'unsaved' | 'pending'>('pending'), [vault, setVault] = useState(vaultReady())
  const [backendHandoff, setBackendHandoff] = useState(''), serverSync = useRef(new Set<string>())
  const [draftPatient, setDraftPatient] = useState(''), [draftSaveState, setDraftSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const primary = useRef<(() => void) | null>(null), stoppers = useRef(new Set<() => void>()), mainRef = useRef<HTMLElement>(null)
  const ui = useMemo(() => makeUi(s.lang), [s.lang])
  const { speakText, voiceMissing } = useSpeakApi(s.lang, s.settings.muted)

  useEffect(() => { purgeOlderThan(RETENTION_DAYS); purgeAcknowledged(); mBegin(s.id, s.step); const i = setInterval(() => setVault(vaultReady()), 2000); return () => clearInterval(i) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const base = s.lang.split('-')[0]; document.documentElement.lang = base; document.documentElement.dir = isRtl(s.lang) ? 'rtl' : 'ltr' }, [s.lang])
  useEffect(() => { mainRef.current?.scrollTo?.({ top: 0 }); window.scrollTo({ top: 0 }); mStep(s.step) }, [s.step])
  useEffect(() => {
    if (!s.consent || !s.consentLog || s.demo || s.profile.forWho !== 'self') { setDraftPatient(''); setDraftSaveState('idle'); return }
    let cancelled = false
    void apiRequest<{ user: { id: string; role: string } }>('/auth/me').then(({ user }) => { if (!cancelled) setDraftPatient(user.role === 'PATIENT' ? user.id : '') }).catch(() => { if (!cancelled) setDraftPatient('') })
    return () => { cancelled = true }
  }, [s.consent, s.consentLog, s.demo, s.profile.forWho])

  const set: SetFn = useCallback((p) => setS((c) => ({ ...c, ...(typeof p === 'function' ? p(c) : p) })), [])
  const stopAll = useCallback(() => { stopSpeaking(); stoppers.current.forEach((f) => f()) }, [])
  const setPending = useCallback((id: string, on: boolean) => setPendingList((l) => (on ? (l.includes(id) ? l : [...l, id]) : l.filter((x) => x !== id))), [])
  const step = s.step, idx = STEPS.indexOf(step)
  const move = useCallback((dir: 1 | -1) => {
    stopAll(); setPendingList([])
    setS((c) => { let i = STEPS.indexOf(c.step) + dir; while (i > 0 && i < STEPS.length - 1 && skipped(STEPS[i], c)) i += dir; return { ...c, step: STEPS[Math.max(0, Math.min(STEPS.length - 1, i))] } })
  }, [stopAll])
  const nav: Nav = useMemo(() => ({ next: () => move(1), back: () => move(-1), go: (st) => { stopAll(); setPendingList([]); set({ step: st }) } }), [move, stopAll, set])

  const result = useMemo(() => assessSession(s), [s])
  const urgentKey = result.urgent.map((f) => f.id).sort().join(',')
  const reset = useCallback((keepLang = true) => {
    stopAll(); markLeft(s.id); mEnd({ lang: s.lang, completed: s.step === 'done', urgent: result.urgent.length > 0, assisted: s.assisted, express: s.express })
    const n = { ...newSession(), ...(keepLang ? { lang: s.lang, settings: s.settings } : {}) }; setPendingList([]); setAlert(null); setSaved('pending'); setS(n); mBegin(n.id, n.step)
  }, [stopAll, s, result.urgent.length])
  const resetRef = useRef(reset); resetRef.current = reset
  useEffect(() => { // privacy: wipe an abandoned session
    let t: ReturnType<typeof setTimeout>; const arm = () => { clearTimeout(t); t = setTimeout(() => { if (STEPS.indexOf(step) > 0) { void log('system', 'idle_wipe', s.id); resetRef.current() } }, IDLE_MS) }
    arm(); const ev = ['pointerdown', 'keydown']; ev.forEach((e) => window.addEventListener(e, arm)); return () => { clearTimeout(t); ev.forEach((e) => window.removeEventListener(e, arm)) }
  }, [step, s.id])
  const demo = () => { stopAll(); setS((c) => ({ ...c, step: 'patient', demo: true, consent: false, guardian: false, profile: { ...c.profile, name: 'Anjali Patil', age: '42', ageUnit: 'years', sex: 'female', phone: '9876543210', abha: 'ABHA-DEMO-DEMO-042', type: 'new', forWho: 'self', relation: '', pregnant: 'no' } })) }

  // ---- urgent findings → token → staff alert (raised as soon as they appear, not at the end)
  useEffect(() => {
    if (!urgentKey || idx < STEPS.indexOf('concern')) return
    const token = s.token && s.token.startsWith('U') ? s.token : nextToken(true)
    if (token !== s.token) set({ token })
    void raiseAlert({ sessionId: s.id, token, name: s.profile.name, age: s.profile.age, ageUnit: s.profile.ageUnit, findings: result.urgent })
    if (s.settings.autoSpeak) speakText(ui('emTitle') + '. ' + ui('emBody', { x: result.urgent.map((f) => f.label).join(', ') }))
  }, [urgentKey, idx >= STEPS.indexOf('concern')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const f = () => setAlert(loadAlerts().find((a) => a.sessionId === s.id) ?? null); f(); return subscribe(f) }, [s.id, urgentKey])
  useEffect(() => {
    if (!draftPatient || !s.consent || !s.consentLog || s.demo || s.profile.forWho !== 'self' || step === 'review' || step === 'done') return
    let cancelled = false
    setDraftSaveState('saving')
    const timer = setTimeout(() => {
      const draftData: Session = { ...s, profile: { ...s.profile, abha: '' }, pid: '', docs: [], notes: '', reviewedAt: '' }
      void apiRequest('/patient/assessments/drafts', json('PUT', { sourceSessionId: s.id, language: s.lang, draftData }))
        .then(() => { if (!cancelled) setDraftSaveState('saved') })
        .catch((e) => { if (!cancelled) { setDraftSaveState('error'); if (e instanceof ApiError && e.status === 401) setDraftPatient('') } })
    }, 1000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [s, draftPatient, step])
  // ---- hand-over: sealed save when the patient reaches step 15; everyone gets a token
  useEffect(() => {
    if (step !== 'review' || saved !== 'pending') return
    const t = s.token || nextToken(false); if (t !== s.token) set({ token: t })
    void patientKey(s.profile.phone, s.profile.abha).then((pid) => { if (pid !== s.pid) set({ pid }); return saveSession({ ...s, token: t, pid, research: s.consentLog?.research ?? s.research }) }).then((ok) => setSaved(ok ? 'saved' : 'unsaved'))
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step !== 'review' || !s.consent || !s.consentLog || s.demo || !s.concern.trim()) return
    const consentLog = s.consentLog
    let cancelled = false
    void (async () => {
      try {
        const { user } = await apiRequest<{ user: { id: string; role: string } }>('/auth/me')
        if (cancelled) return
        if (user.role !== 'PATIENT') { setBackendHandoff('This kiosk intake remains available to staff; sign in as a patient to save a copy to your patient dashboard.'); return }
        if (s.profile.forWho !== 'self') { setBackendHandoff('Proxy/guardian intake stays in the existing staff handoff and is not attached to the signed-in person’s patient account.'); return }
        const marker = `${user.id}:${s.id}`
        if (serverSync.current.has(marker)) return
        const ageYears = s.profile.age.trim() ? (s.profile.ageUnit === 'months' ? Math.floor(Number(s.profile.age) / 12) : Number(s.profile.age)) : null
        await apiRequest('/patient/profile', json('PATCH', { fullName: s.profile.name, ageYears, sex: s.profile.sex || null, phone: s.profile.phone || null, preferredLanguage: s.lang }))
        const answers = { ...s.answers, ...(s.profile.pregnant ? { profile_pregnancy: s.profile.pregnant } : {}) }
        const { assessment } = await apiRequest<{ assessment: { id: string; queueToken?: string | null } }>('/patient/assessments', json('POST', { sourceSessionId: s.id, language: s.lang, consultationType: s.consultation || 'general', ayushSystem: s.ayushSystem || null, concern: s.concern.slice(0, 5000), symptomKey: s.symptom || null, bodyRegions: s.body, answers, consent: { careConsent: true, researchConsent: Boolean(consentLog.research), aiProcessing: consentLog.aiProcessing === true, version: consentLog.version || 'nidan-care-v1' } }))
        if (assessment.queueToken && assessment.queueToken !== s.token) set({ token: assessment.queueToken })
        serverSync.current.add(marker)
        const failed = []
        for (const d of s.docs.slice(0, 10)) {
          const sourceImage = d.originalImage ?? d.image
          if (!sourceImage?.startsWith('data:')) continue
          try {
            const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(sourceImage)
            if (!match) continue
            const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
            const form = new FormData(); form.append('file', new File([bytes], d.name, { type: match[1] })); form.append('assessmentId', assessment.id)
            const { document } = await apiRequest<{ document: { id: string } }>('/documents', { method: 'POST', body: form })
            if (d.patientConfirmed && d.text.trim()) await apiRequest(`/documents/${document.id}/confirm`, json('POST', { text: d.text.slice(0, 50000), method: d.method ?? 'typed', confidence: d.confidence ? Math.round(d.confidence) : null }))
          } catch { failed.push(d.name) }
        }
        if (!cancelled) setBackendHandoff(failed.length ? `Assessment saved to your patient dashboard; ${failed.length} source file(s) could not be uploaded. They remain in the existing local staff handoff.` : 'Authenticated intake saved to your patient dashboard. Staff handoff remains available.')
      } catch (e) {
        if (!cancelled) setBackendHandoff(e instanceof Error && 'status' in e && (e as { status: number }).status === 401 ? 'Sign in to connect this intake to your patient dashboard; staff handoff remains available.' : 'The authenticated API could not save this intake. It remains in the existing staff handoff; retry after the backend is available.')
      }
    })()
    return () => { cancelled = true }
  }, [step, s.id, s.consent, s.demo]) // eslint-disable-line react-hooks/exhaustive-deps
  const onDelete = () => { removeSaved(s.id, 'kiosk'); dropPatientData(s.id); setSaved('unsaved') }

  const api: VoiceApi = {
    lang: s.lang, ui, speakText, stopAll, muted: s.settings.muted, autoSpeak: s.settings.autoSpeak,
    setMuted: (b) => set((c) => ({ settings: { ...c.settings, muted: b } })), setAutoSpeak: (b) => set((c) => ({ settings: { ...c.settings, autoSpeak: b } })),
    pending, setPending, primary, voiceMissing, stoppers, voiceOptIn: s.voiceOptIn, askVoice: () => setVoiceAsk(true),
  }
  const p: StepProps = { s, set, nav }
  const showSidebar = step !== 'welcome', pct = Math.round((idx / (STEPS.length - 1)) * 100)
  const showBanner = result.urgent.length > 0 && idx >= STEPS.indexOf('concern') && !['safety', 'summary', 'review', 'done'].includes(step)
  const alertLine = alert ? (alert.status === 'ack' ? ui('alertAck') : alert.delivery === 'queued' ? ui('alertQueued') : alert.delivery === 'sent' ? ui('alertSent') : ui('alertLocal')) : ''
  const body = {
    welcome: <Welcome {...p} />, language: <Language {...p} />, patient: <Patient {...p} />, register: <Register {...p} />, consent: <Consent {...p} />,
    consultation: <Consultation {...p} />, ayushSys: <AyushSys {...p} />, concern: <Concern {...p} />, body: <Body {...p} />, ayHist: <AyHist {...p} />,
    questions: <Questions {...p} />, reports: <Reports {...p} />, safety: <Safety {...p} />, summary: <Summary {...p} />, review: <Review {...p} saved={saved} backendHandoff={backendHandoff} />, done: <Done {...p} reset={() => reset()} onDelete={onDelete} />,
  }[step]
  return (
    <LocaleProvider language={s.lang}>
    <VoiceProvider value={api}>
      <div className="app" data-step={step}>
        <div className="strip prototype-warning" role="note" aria-label={ui('demoTitle')}><strong>{ui('demoTitle')}</strong><span>{ui('demoWarning')}</span></div>
        {draftPatient && draftSaveState !== 'idle' && <div className={'strip ' + (draftSaveState === 'error' ? 'warn' : '')} role="status">{draftSaveState === 'saving' ? _t("Saving your consented intake draft…") : draftSaveState === 'saved' ? _t("Your intake progress is saved to your patient account. In-progress local attachments are not included in the draft.") : _t("Draft could not be saved to your account. Check your connection before leaving this intake.")}</div>}
        {!vault && <div className="strip warn" role="status">{_t("⚠ Staff setup not done — nothing is saved on this device.")}{" "}<a href="#/staff">{_t("Set up now")}</a></div>}
        {s.demo && <div className="strip demo" role="status">{ui('demoBanner')}</div>}
        <header className="topbar app-chrome">
          <button className="brand" onClick={() => nav.go('welcome')} aria-label={_t("NIDAN home")}><Logo /><span><b className="brand-name">{_t("NIDAN")}<i /></b><span className="mono tiny">{ui('brandSub')}</span></span></button>
          <div className="pills"><span className="pill-soft"><i className="dot-green" />{ui('voiceTouch')}</span><span className="pill-soft muted">{ui('fictionalOnly')}</span></div>
          <div className="top-actions">{a11y}
            <a className="btn" href="#/account">{_t("Patient account")}</a>
            <a className="btn" href="#/access">{_t("Doctor / staff access")}</a>
            <a className="btn dark" href="#/dashboard">{_t("Clinical dashboard")}</a>
            <button className="btn" onClick={() => setHelp(true)}>◎ {ui('help')}</button>
            <button className="btn dark" onClick={demo}>▶ {ui('demo')}</button>
            <button className="btn round" aria-label={ui('reset')} title={ui('reset')} onClick={() => { if (window.confirm(ui('confirmReset'))) reset() }}>↺</button>
          </div>
        </header>
        <div className={'shell' + (showSidebar ? ' with-side' : '')}>
          {showSidebar && (
            <nav className="side app-chrome" aria-label={_t("progress")}>
              <div className="side-top"><div><div className="mono tiny">{ui('flow')}</div><b>{ui('stepOf', { a: idx + 1, b: STEPS.length })}</b></div><span className="mono tiny">{pct}%</span></div>
              <div className="mini-bar"><i style={{ width: `${pct}%` }} /></div>
              <ol>{STEPS.map((st, i) => {
                const sk = skipped(st, s), done = i < idx && !sk, cur = i === idx
                return (<li key={st}><button className={'step' + (cur ? ' cur' : '') + (done ? ' done' : '') + (sk ? ' skip' : '')} aria-current={cur ? 'step' : undefined} disabled={i > idx || sk} onClick={() => nav.go(st)}>
                  <span className="num">{done ? '✓' : String(i + 1).padStart(2, '0')}</span>
                  <span className="step-t"><span>{ui('s_' + st)}</span>{(cur || done || sk) && <small>{cur ? ui('inProgress') : sk ? ui('skippedS') : ui('doneS')}</small>}</span></button></li>)
              })}</ol>
              <p className="side-lang mono tiny">{nativeName(s.lang)} · {languageByCode(s.lang).voiceTag}</p>
              <p className="side-lang"><a href="#/about" className="mono tiny">{_t("About · what is real")}</a> · <a href="#/selftest" className="mono tiny">{_t("Self-test")}</a></p>
            </nav>
          )}
          <main className="main" ref={mainRef}>
            {showBanner && <div className="emergency sticky" role="alert"><b>🚨 {ui('emTitle')}</b><span>{ui('emBody', { x: result.urgent.map((f) => f.label).join(', ') })}</span>{alertLine && <strong className="alert-line">{alertLine}</strong>}<div className="emergency-actions"><a className="btn dark" href="tel:112">📞 112</a><a className="btn" href="#/access?role=staff">{_t("Sign in as staff")}</a></div></div>}
            {body}
          </main>
        </div>
        {help && (<div className="modal-back" role="dialog" aria-modal="true" onClick={() => setHelp(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h2>{ui('helpTitle')}</h2><p>{ui('helpBody')}</p><a className="btn dark" href="tel:112">📞 112</a> <button className="btn" onClick={() => setHelp(false)} autoFocus>{ui('close')}</button></div></div>)}
        {voiceAsk && (<div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="vt"><div className="modal"><h2 id="vt">{ui('voiceTitle')}</h2><p>{ui('voiceBody')}</p>
          <div className="modal-actions"><button className="btn" onClick={() => { set({ voiceOptIn: 'no' }); setVoiceAsk(false); void log('kiosk', 'voice_declined', s.id) }}>{ui('voiceDeny')}</button><button className="btn dark" autoFocus onClick={() => { set({ voiceOptIn: 'yes' }); setVoiceAsk(false); void log('kiosk', 'voice_allowed', s.id) }}>{ui('voiceAllow')}</button></div></div></div>)}
      </div>
    </VoiceProvider>
    </LocaleProvider>
  )
}
