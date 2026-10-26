import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LocaleSelector, PrototypeNotice, useLocale, useLocaleText } from './LocaleProvider'
import { createRecognizer, outputVoiceAvailable, recognitionSupported, speak, stopSpeaking, usingProxyVoice } from '../lib/voice'
import { languageByCode } from '../data/languages'

type Status = 'Awaiting review' | 'In consultation' | 'Reviewed'
type Priority = 'Urgent' | 'Review' | 'Routine'
type View = 'overview' | 'queue' | 'patients' | 'team' | 'reports' | 'settings'
type Tab = 'overview' | 'responses' | 'fhir'

type Patient = {
  id: string; token: string; name: string; age: number; sex: string; language: string; concern: string; department: string
  priority: Priority; status: Status; arrived: string; attendedBy: string; summary: string; findings: string[]; notes: string; nextStep: string; lastUpdated: string
  responses?: [string, string][]
}

const seed: Patient[] = [
  { id: 'p1', token: 'U-1042', name: 'Anjali Patil', age: 42, sex: 'Female', language: 'मराठी', concern: 'Chest discomfort and breathlessness', department: 'General Medicine', priority: 'Urgent', status: 'In consultation', arrived: '09:14', attendedBy: 'Dr. Meera Shah', summary: 'Patient reports central chest discomfort beginning this morning with shortness of breath on walking. Red-flag rule matched; clinician review is in progress.', findings: ['Chest discomfort', 'Breathlessness on exertion', 'Started today'], notes: 'Vitals to be confirmed. Keep patient in monitored area while assessment continues.', nextStep: 'Complete clinician assessment and record vitals.', lastUpdated: '2 min ago', responses: [['When did it start?', 'This morning'], ['Pain level (0–10)', '6'], ['Any shortness of breath?', 'Yes, when walking'], ['Known allergies', 'None reported']] },
  { id: 'p2', token: 'NID-3187', name: 'Rohan Kulkarni', age: 28, sex: 'Male', language: 'हिन्दी', concern: 'Fever and body ache for two days', department: 'Family Medicine', priority: 'Review', status: 'Awaiting review', arrived: '09:21', attendedBy: 'Unassigned', summary: 'Patient-reported fever with generalized body ache. No urgent rule flag in the kiosk intake.', findings: ['Fever · 2 days', 'Body ache', 'No urgent flag'], notes: 'Review medication history and temperature before disposition.', nextStep: 'Assign clinician and confirm current medicines.', lastUpdated: '5 min ago', responses: [['Duration', 'Two days'], ['Fever measured?', 'Not measured'], ['Current medicines', 'Paracetamol (self-started)']] },
  { id: 'p3', token: 'NID-3186', name: 'Saira Khan', age: 35, sex: 'Female', language: 'English', concern: 'Recurring migraine and nausea', department: 'Outpatient Care', priority: 'Routine', status: 'Reviewed', arrived: '08:47', attendedBy: 'Dr. Arjun Rao', summary: 'Recurring headache pattern documented with patient-reported nausea. Doctor reviewed the intake and added follow-up guidance.', findings: ['Recurring migraine', 'Nausea', 'No safety alert'], notes: 'Discussed hydration, trigger log and planned outpatient follow-up.', nextStep: 'Follow-up recommended within seven days.', lastUpdated: '18 min ago', responses: [['Frequency', 'Several times a month'], ['Triggers', 'Bright light, skipped meals']] },
  { id: 'p4', token: 'NID-3185', name: 'Vikram Joshi', age: 61, sex: 'Male', language: 'मराठी', concern: 'Knee pain affecting mobility', department: 'Orthopaedics', priority: 'Review', status: 'Awaiting review', arrived: '09:28', attendedBy: 'Unassigned', summary: 'Patient reports worsening knee pain and difficulty climbing stairs. Uploaded report is waiting for clinician confirmation.', findings: ['Reduced mobility', 'Knee pain', 'Report uploaded'], notes: 'Open the original report before making a clinical decision.', nextStep: 'Review uploaded report and assess mobility.', lastUpdated: '1 min ago', responses: [['Which knee?', 'Right'], ['Difficulty with stairs?', 'Yes']] },
  { id: 'p5', token: 'NID-3184', name: 'Neha Deshmukh', age: 19, sex: 'Female', language: 'English', concern: 'Seasonal allergy symptoms', department: 'Family Medicine', priority: 'Routine', status: 'Reviewed', arrived: '08:31', attendedBy: 'Dr. Meera Shah', summary: 'Patient-reported sneezing and itchy eyes consistent with a seasonal concern. Intake reviewed and closed by the doctor.', findings: ['Sneezing', 'Itchy eyes', 'No urgent flag'], notes: 'Patient advised to return if breathing difficulty develops.', nextStep: 'Routine advice provided.', lastUpdated: '34 min ago', responses: [['Symptoms', 'Sneezing, itchy eyes'], ['Breathing difficulty?', 'No']] },
]

const HANDOFF_KEY = 'nidan.dashboard.handoffs'
const readHandoffs = (): Patient[] => { try { return JSON.parse(localStorage.getItem(HANDOFF_KEY) ?? '[]') as Patient[] } catch { return [] } }
const pClass = (p: Priority) => p === 'Urgent' ? 'urgent' : p === 'Review' ? 'review' : 'routine'
const sClass = (s: Status) => s === 'Reviewed' ? 'done' : s === 'In consultation' ? 'live' : 'wait'
const initials = (name: string) => name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

const team = [
  { name: 'Dr. Meera Shah', role: 'Attending physician', dept: 'General Medicine', on: true },
  { name: 'Dr. Arjun Rao', role: 'Physician', dept: 'Outpatient Care', on: true },
  { name: 'Nurse Kavita More', role: 'Triage nurse', dept: 'Emergency triage', on: true },
  { name: 'Dr. Sana Iqbal', role: 'Orthopaedics', dept: 'Orthopaedics', on: false },
]

export default function WorkspaceDashboard() {
  const _t = useLocaleText()
  const { language } = useLocale()
  const [patients, setPatients] = useState<Patient[]>(() => [...seed, ...readHandoffs()])
  const [selectedId, setSelectedId] = useState('p1')
  const [filter, setFilter] = useState<'All' | Priority>('All')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>('overview')
  const [tab, setTab] = useState<Tab>('overview')
  const [synced, setSynced] = useState(_t('just now'))
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceNote, setVoiceNote] = useState('')
  const recRef = useRef<{ stop: () => void } | null>(null)

  const selected = patients.find((p) => p.id === selectedId) ?? patients[0]
  const shown = useMemo(() => patients.filter((p) => (filter === 'All' || p.priority === filter) && `${p.name} ${p.token} ${p.concern} ${p.department}`.toLowerCase().includes(query.toLowerCase())), [filter, patients, query])
  const counts = { total: patients.length, urgent: patients.filter((p) => p.priority === 'Urgent').length, waiting: patients.filter((p) => p.status === 'Awaiting review').length, reviewed: patients.filter((p) => p.status === 'Reviewed').length }
  const pct = counts.total ? Math.round((counts.reviewed / counts.total) * 100) : 0

  useEffect(() => {
    const refresh = () => setPatients((cur) => { const ids = new Set(cur.map((p) => p.id)); return [...cur, ...readHandoffs().filter((p) => !ids.has(p.id))] })
    window.addEventListener('nidan-dashboard-update', refresh); window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('nidan-dashboard-update', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  useEffect(() => () => { stopSpeaking(); try { recRef.current?.stop() } catch { /* stopped */ } }, [])
  useEffect(() => { stopSpeaking(); setSpeaking(false) }, [language, view, selectedId])

  const markReviewed = () => setPatients((cur) => cur.map((p) => p.id === selected.id ? { ...p, status: 'Reviewed', attendedBy: 'Dr. Meera Shah', lastUpdated: 'just now' } : p))

  // ---- Voice: read the selected case aloud in the interface language
  const readCase = useCallback(() => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    const text = [selected.name, `${selected.age} ${_t('years')}`, `${_t('Priority')}: ${_t(selected.priority)}`, `${_t('Status')}: ${_t(selected.status)}`, selected.concern, selected.summary, `${_t('Next step')}: ${selected.nextStep}`].join('. ')
    setVoiceNote(outputVoiceAvailable(language) ? (usingProxyVoice(language) ? _t('Using the closest installed voice for this language.') : '') : _t('No installed speech voice for this language on this device; text stays available.'))
    setSpeaking(true)
    // Case content is entered in English by clinicians, so non-ASCII text is read in the interface language and English text with an English voice.
    speak(text, /[^\x00-\x7f]/.test(text) ? languageByCode(language).voiceTag : 'en-IN', false, () => setVoiceNote(_t('No installed speech voice for this language on this device; text stays available.')), () => setSpeaking(false))
  }, [selected, language, speaking, _t])

  // ---- Voice: speak a search ("Anjali", "urgent", token…) in any supported language
  const inFrame = (() => { try { return window.self !== window.top } catch { return true } })()
  const startRecognition = useCallback(() => {
    let finished = false
    const r = createRecognizer(languageByCode(language).voiceTag, {
      onStart: () => { setListening(true); setVoiceNote('') }, onEnd: () => setListening(false),
      onError: (code) => { setListening(false); setVoiceNote(code === 'not-allowed' || code === 'service-not-allowed' ? (inFrame ? _t('This embedded page is not allowed to use the microphone. Open the app directly (npm run dev) or in its own tab.') : _t('Microphone permission was denied.')) : code === 'language-not-supported' ? _t('This browser cannot recognise speech in the selected language; type instead.') : code === 'aborted' ? '' : code === 'network' ? _t('Speech service unreachable. Check your internet connection.') : _t('No speech detected. Try again.')) },
      onTranscript: (t) => { finished = true; setQuery(t.replace(/[.।]$/, '')); setView((v) => v === 'overview' || v === 'queue' ? v : 'queue'); try { recRef.current?.stop() } catch { /* stopped */ } },
      onInterim: (t) => { if (!finished) setQuery(t) },
    })
    if (!r) { setVoiceNote(_t('Voice recognition is unavailable in this browser. You can type instead.')); return }
    r.continuous = false
    recRef.current = r
    try { r.start() } catch { setVoiceNote(_t('No speech detected. Try again.')) }
  }, [language, inFrame, _t])
  const listen = useCallback(() => {
    if (listening) { try { recRef.current?.stop() } catch { /* stopped */ } return }
    if (!recognitionSupported()) { setVoiceNote(_t('Voice recognition is unavailable in this browser. Use Chrome or Edge, or type instead.')); return }
    stopSpeaking(); setVoiceNote(_t('Requesting microphone…'))
    // Ask for the microphone explicitly first so the browser shows its permission prompt and we can report the real reason if it is blocked.
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => { stream.getTracks().forEach((t) => t.stop()); startRecognition() })
        .catch(() => setVoiceNote(inFrame ? _t('This embedded page is not allowed to use the microphone. Open the app directly (npm run dev) or in its own tab.') : _t('Microphone permission was denied. Allow the microphone in the browser address bar and try again.')))
    } else startRecognition()
  }, [listening, startRecognition, inFrame, _t])

  const nav: [View, string, string, number?][] = [['overview', 'Overview', '▦'], ['queue', 'Live queue', '◉', counts.total], ['patients', 'Patients', '♙'], ['team', 'Care team', '✚'], ['reports', 'Reports', '☰'], ['settings', 'Settings', '⚙']]
  const stat = (label: string, value: number, sub: string, cls: string, icon: string) => <div className={'ws-stat ' + cls}><span className="ws-stat-icon">{icon}</span><div><span>{_t(label)}</span><strong>{value}</strong><small>{_t(sub)}</small></div></div>

  const queue = (limit?: number) => <>
    <div className="ws-tools">
      <label className="ws-search"><span aria-hidden>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={_t('Search by name, token or concern')} aria-label={_t('Search by name, token or concern')} /></label>
      <button type="button" className={'ws-mic' + (listening ? ' live' : '')} onClick={listen} aria-pressed={listening} aria-label={listening ? _t('Stop listening') : _t('Speak your search')} title={listening ? _t('Stop listening') : _t('Speak your search')}>🎤</button>
      <div className="ws-chips" role="group" aria-label={_t('Filter by priority')}>{(['All', 'Urgent', 'Review', 'Routine'] as const).map((f) => <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{_t(f)}{f === 'Urgent' && counts.urgent ? <b>{counts.urgent}</b> : null}</button>)}</div>
    </div>
    {listening && <p className="ws-hint" role="status">● {_t('Listening…')} {languageByCode(language).nativeName}</p>}
    {voiceNote && <p className="ws-hint" role="status">{voiceNote}</p>}
    <div className="ws-table" role="table">
      <div className="ws-row ws-head" role="row"><span>{_t('PATIENT')}</span><span>{_t('CONCERN')}</span><span>{_t('PRIORITY')}</span><span>{_t('STATUS')}</span></div>
      {shown.slice(0, limit).map((p) => <button key={p.id} role="row" type="button" className={'ws-row ws-case ' + pClass(p.priority) + (p.id === selected.id ? ' sel' : '')} onClick={() => { setSelectedId(p.id); setTab('overview') }}>
        <span className="ws-who"><i className="ws-av">{initials(p.name)}</i><span><b>{p.name}</b><small>{p.token} · {p.age} yrs · {_t(p.sex)}</small></span></span>
        <span className="ws-concern">{p.concern}<small>{_t(p.department)} · {_t('arrived')} {p.arrived}</small></span>
        <span><em className={'ws-pill ' + pClass(p.priority)}>{_t(p.priority)}</em></span>
        <span className={'ws-status ' + sClass(p.status)}><i />{_t(p.status)}</span>
      </button>)}
      {!shown.length && <p className="ws-empty">{_t('No demo cases match this filter.')}</p>}
    </div>
    <div className="ws-foot"><span>{_t('Showing')} {Math.min(limit ?? shown.length, shown.length)} {_t('of')} {patients.length} {_t('patients')}</span>{limit && <button type="button" className="ws-link" onClick={() => setView('queue')}>{_t('View full queue')} →</button>}</div>
  </>

  const detail = <aside className="ws-card ws-detail" aria-label={_t('Selected patient')}>
    <div className="ws-detail-head"><div><span className="ws-eyebrow">{_t('SELECTED PATIENT')} · {selected.token}</span><h2>{selected.name}</h2><p>{selected.age} {_t('years')} · {_t(selected.sex)} · {selected.language}</p></div><em className={'ws-pill big ' + pClass(selected.priority)}>{_t(selected.priority)} {_t('priority')}</em></div>
    <div className="ws-tabs" role="tablist">{([['overview', 'Overview'], ['responses', 'Intake responses'], ['fhir', 'FHIR record']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{_t(l)}</button>)}</div>
    {tab === 'overview' && <>
      <div className="ws-meta"><span>{_t('Queue token')}<b>{selected.token}</b></span><span>{_t('Department')}<b>{_t(selected.department)}</b></span><span>{_t('Arrived')}<b>{selected.arrived}</b></span></div>
      <section className="ws-ai"><i>✦</i><div><span className="ws-eyebrow">{_t('AI-ASSISTED SUMMARY')}</span><h3>{_t('Preliminary clinical context')}</h3><p>{selected.summary}</p><small>{_t('Patient-reported context · Not a diagnosis')}</small></div></section>
      <h3 className="ws-h3">{_t('Structured findings')}</h3>
      <ul className="ws-find">{selected.findings.map((f) => <li key={f}><span>✓</span>{f}</li>)}</ul>
      <section className="ws-note"><span className="ws-eyebrow">{_t('CLINICIAN NOTE')}</span><p>{selected.notes}</p></section>
      <p className="ws-upd">{_t('Last updated')} {selected.lastUpdated} · {_t('Next step')}: {selected.nextStep}</p>
      <div className="ws-actions">
        <button type="button" className="ws-btn" onClick={readCase} aria-pressed={speaking}>{speaking ? '■ ' + _t('Stop') : '🔊 ' + _t('Read aloud')}</button>
        <button type="button" className="ws-btn" onClick={() => window.print()}>{_t('Print summary')}</button>
        <button type="button" className="ws-btn dark" onClick={markReviewed}>{selected.status === 'Reviewed' ? _t('Reviewed') + ' ✓' : _t('Mark as reviewed')}</button>
      </div>
    </>}
    {tab === 'responses' && <dl className="ws-resp">{(selected.responses ?? []).map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}{!selected.responses?.length && <p className="ws-empty">{_t('No intake responses recorded.')}</p>}<p className="ws-upd">{_t('Patient-provided answers; not verified by a clinician.')}</p></dl>}
    {tab === 'fhir' && <pre className="ws-fhir" tabIndex={0}>{JSON.stringify({ resourceType: 'Bundle', type: 'collection', entry: [{ resource: { resourceType: 'Patient', id: selected.token, name: [{ text: selected.name }], gender: selected.sex.toLowerCase(), extension: [{ url: 'preferred-language', valueString: selected.language }] } }, { resource: { resourceType: 'Condition', clinicalStatus: 'active', verificationStatus: 'unconfirmed', code: { text: selected.concern }, subject: { reference: `Patient/${selected.token}` } } }] }, null, 2)}</pre>}
  </aside>

  const body = (() => {
    if (view === 'overview') return <>
      <p className="ws-date">{_t('SATURDAY, 24 OCTOBER 2026 · MORNING SHIFT')}</p>
      <div className="ws-hello"><div><h1>{_t('Good morning, Dr. Shah')}</h1><p>{_t('Here is what needs your attention today.')}</p></div><button type="button" className="ws-btn pill" onClick={() => setSynced(_t('just now'))}>↻ {_t('Refresh data')}</button></div>
      <div className="ws-stats">{stat('Total intakes', counts.total, '+12% vs yesterday', 'blue', '〰')}{stat('Urgent attention', counts.urgent, 'Needs review now', 'red', '!')}{stat('Awaiting review', counts.waiting, 'Across 3 departments', 'amber', '◔')}{stat('Doctor reviewed', counts.reviewed, `${pct}% of today's queue`, 'green', '✓')}</div>
      <div className="ws-grid"><section className="ws-card"><div className="ws-card-head"><div><span className="ws-eyebrow">{_t('LIVE INTAKE QUEUE')}</span><h2>{_t('Patients requiring attention')}</h2></div><span className="ws-live"><i />{_t('Live')}</span></div>{queue(5)}</section>{detail}</div>
    </>
    if (view === 'queue') return <><h1 className="ws-title">{_t('Live queue')}</h1><div className="ws-grid"><section className="ws-card">{queue()}</section>{detail}</div></>
    if (view === 'patients') return <><h1 className="ws-title">{_t('Patients')}</h1><section className="ws-card"><div className="ws-cards">{patients.map((p) => <button key={p.id} type="button" className="ws-pcard" onClick={() => { setSelectedId(p.id); setView('queue') }}><i className="ws-av">{initials(p.name)}</i><b>{p.name}</b><small>{p.token} · {p.age} yrs · {p.language}</small><em className={'ws-pill ' + pClass(p.priority)}>{_t(p.priority)}</em></button>)}</div></section></>
    if (view === 'team') return <><h1 className="ws-title">{_t('Care team')}</h1><section className="ws-card"><ul className="ws-team">{team.map((m) => <li key={m.name}><i className="ws-av">{initials(m.name.replace(/^(Dr\.|Nurse)\s/, ''))}</i><span><b>{m.name}</b><small>{_t(m.role)} · {_t(m.dept)}</small></span><span className={'ws-status ' + (m.on ? 'done' : 'wait')}><i />{m.on ? _t('On shift') : _t('Off shift')}</span></li>)}</ul></section></>
    if (view === 'reports') return <><h1 className="ws-title">{_t('Reports')}</h1><div className="ws-stats">{stat('Total intakes', counts.total, 'Today · all departments', 'blue', '〰')}{stat('Doctor reviewed', counts.reviewed, `${pct}% of today's queue`, 'green', '✓')}</div><section className="ws-card"><span className="ws-eyebrow">{_t('DEPARTMENT LOAD')}</span>{[['General Medicine', 68], ['Family Medicine', 44], ['Outpatient Care', 31], ['Orthopaedics', 18]].map(([n, v]) => <div className="ws-bar" key={String(n)}><span>{_t(String(n))}</span><b>{v}%</b><i><em style={{ width: `${v}%` }} /></i></div>)}<p className="ws-upd">{_t('Demo metrics — fictional data.')}</p></section></>
    return <><h1 className="ws-title">{_t('Settings')}</h1><section className="ws-card ws-settings"><label><span>{_t('Choose interface language')}</span><LocaleSelector /></label><p>{_t('The language you pick here is used for the interface, for spoken search (microphone) and for reading cases aloud.')}</p><p className={'ws-hint'}>{outputVoiceAvailable(language) ? (usingProxyVoice(language) ? _t('Using the closest installed voice for this language.') : _t('A speech voice for this language is installed.')) : _t('No installed speech voice for this language on this device; text stays available.')}</p><button type="button" className="ws-btn" onClick={() => speak(_t('Voice test. NIDAN can speak in this language.'), /[^\x00-\x7f]/.test(_t('Voice test. NIDAN can speak in this language.')) ? languageByCode(language).voiceTag : 'en-IN', false)}>🔊 {_t('Test voice')}</button></section></>
  })()

  return <div className="ws-page"><PrototypeNotice />
    <div className="ws-shell">
      <aside className="ws-side" aria-label={_t('Workspace navigation')}>
        <a className="ws-brand" href="#/"><span>N</span><div><b>NIDAN<sup>+</sup></b><small>{_t('CLINICAL OPERATIONS')}</small></div></a>
        <div className="ws-org"><small>{_t('WORKSPACE')}</small><b>{_t('Rural Care Centre')} <i>⌄</i></b></div>
        <nav>{nav.map(([k, label, icon, badge]) => <button key={k} type="button" className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}><span aria-hidden>{icon}</span>{_t(label)}{badge ? <em>{badge}</em> : null}</button>)}</nav>
        <div className="ws-demo"><i /><div><b>{_t('Demo workspace')}</b><small>{_t('Fictional data only')}</small></div></div>
        <div className="ws-user"><i>MS</i><div><b>Dr. Meera Shah</b><small>{_t('Attending physician')}</small></div></div>
      </aside>
      <div className="ws-main">
        <header className="ws-top"><nav className="ws-crumb" aria-label="breadcrumb">{_t('Workspace')} <span>/</span> <b>{_t(nav.find((n) => n[0] === view)?.[1] ?? 'Overview')}</b></nav>
          <div className="ws-top-r"><span className="ws-sync"><i />{_t('Last synced')} {synced}</span><LocaleSelector /><a className="ws-btn" href="#/">{_t('Kiosk intake')}</a><a className="ws-btn dark" href="#/staff-portal">{_t('Staff console')}</a></div></header>
        <main className="ws-content">{body}</main>
      </div>
    </div>
  </div>
}
