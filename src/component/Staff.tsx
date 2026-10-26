import { LocaleSelector, PrototypeNotice, useLocale, useLocaleText } from './LocaleProvider'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ackRemote, acknowledge, identity, loadAlerts, pullRemote, subscribe, type Alert, type Who } from '../lib/alerts'
import { isUnlocked, lock, lockoutSeconds, onVaultChange, setupVault, touch, unlock, vaultReady } from '../lib/vault'
import { listSaved, listSavedSynced, removeSaved, saveSession } from '../lib/store'
import { emptyRecord, getRecord, mergeVisit, saveRecord, type PatientRecord } from '../lib/patients'
import { askLocalAI, researchSet } from '../lib/localai'
import { patientKey } from '../lib/pid'
import { hubOn, pendingOutbox } from '../lib/sync'
import { auditIdle, log, readAudit, verifyAudit } from '../lib/audit'
import { readMetrics, summarise } from '../lib/metrics'
import { toBundle, pushFhir } from '../lib/fhir'
import { summaryText, download, assessSession } from '../lib/report'
import { makeUi } from '../i18n'
import type { Session } from '../model'
import { languages } from '../data/languages'

const REVIEWED = (import.meta.env as unknown as Record<string, string>).VITE_REVIEW_SIGNOFF
const ago = (t: string, lang: string, tr: (source: string, vars?: Record<string, string | number>) => string) => { const m = Math.round((Date.now() - +new Date(t)) / 60000); const num = (n: number) => new Intl.NumberFormat(lang).format(n); return m < 1 ? tr('just now') : m < 60 ? tr('{minutes} min ago', { minutes: num(m) }) : tr('{hours} h ago', { hours: num(Math.round(m / 60)) }) }
function beep() { try { const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext, c = new C(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.2; o.start(); o.stop(c.currentTime + 0.5) } catch { /* audio blocked until a click */ } }

export default function Staff({ a11y }: { a11y: ReactNode }) {
  const _t = useLocaleText();
  const [, force] = useState(0), [pass, setPass] = useState(''), [pass2, setPass2] = useState(''), [err, setErr] = useState(''), [tab, setTab] = useState<'alerts' | 'patients' | 'data' | 'metrics' | 'audit' | 'settings'>('alerts')
  useEffect(() => onVaultChange(() => force((n) => n + 1)), [])
  useEffect(() => { const i = setInterval(() => force((n) => n + 1), 5000); const t = () => touch(); window.addEventListener('pointerdown', t); return () => { clearInterval(i); window.removeEventListener('pointerdown', t) } }, [])
  const ready = vaultReady(), open = isUnlocked()
  const Shell = (c: ReactNode) => (<div className="app staff"><PrototypeNotice/><header className="topbar"><b className="brand-name">{_t("NIDAN")}<i /></b><span className="mono tiny">{_t("STAFF AREA")}</span><div className="top-actions"><LocaleSelector/>{a11y}<a className="btn" href="#/">{_t("← Kiosk")}</a>{open && <button className="btn" onClick={() => { lock(); void log('staff', 'staff_lock') }}>{_t("🔒 Lock")}</button>}</div></header><main className="main wide">{c}</main></div>)
  if (!ready) return Shell(
    <section className="panel narrow"><h1>{_t("First-time staff setup")}</h1><p>{_t("Choose a passphrase (8+ characters). There is")}{" "}<b>{_t("no default PIN")}</b>{_t(". Patient data saved on this device is encrypted so that only this passphrase can open it.")}{" "}<b>{_t("If you forget it, saved data cannot be recovered.")}</b></p>
      <input className="input" type="password" autoComplete="new-password" placeholder={_t("Passphrase")} value={pass} onChange={(e) => setPass(e.target.value)} /><input className="input" type="password" autoComplete="new-password" placeholder={_t("Repeat passphrase")} value={pass2} onChange={(e) => setPass2(e.target.value)} />
      <button className="btn dark" onClick={async () => { try { if (pass !== pass2) throw new Error('Passphrases do not match'); await setupVault(pass); await log('staff', 'staff_setup'); setPass(''); setPass2(''); setErr('') } catch (e) { setErr((e as Error).message) } }}>{_t("Create")}</button>{err && <p className="form-error">{_t(err)}</p>}</section>)
  if (!open) return Shell(
    <section className="panel narrow"><h1>{_t("Staff sign-in")}</h1><input className="input" type="password" autoComplete="current-password" placeholder={_t("Passphrase")} value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      <button className="btn dark" onClick={async () => { try { await unlock(pass); await log('staff', 'staff_login'); setPass(''); setErr('') } catch (e) { void log('staff', 'staff_login_failed'); setErr((e as Error).message) } }}>{_t("Sign in")}</button>
      {lockoutSeconds() > 0 && <p className="status err">{_t("Locked for")}{" "}{lockoutSeconds()}{_t("s after repeated failures.")}</p>}{err && <p className="form-error">{_t(err)}</p>}<p className="status">{_t("Sessions lock automatically after 5 minutes of inactivity.")}</p></section>)
  return Shell(<>
    {!REVIEWED && <p className="note-box warm" role="note">{_t("⚠ DRAFT clinical content: the red-flag rules and the Marathi/Hindi questions have")}{" "}<b>{_t("not")}</b> {_t("been clinically reviewed. See docs/REVIEW.md. (Set VITE_REVIEW_SIGNOFF once signed off.)")}</p>}
    <div className="tabs" role="tablist">{(['alerts', 'patients', 'data', 'metrics', 'audit', 'settings'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={'btn' + (tab === t ? ' dark' : '')} onClick={() => setTab(t)}>{t === 'patients' ? _t("Doctor dashboard") : _t(t[0].toUpperCase() + t.slice(1))}</button>)}</div>
    {tab === 'alerts' && <Alerts />}{tab === 'patients' && <Patients />}{tab === 'data' && <DataTab />}{tab === 'metrics' && <Metrics />}{tab === 'audit' && <Audit />}{tab === 'settings' && <Settings />}</>)
}

function Alerts() {
  const _t = useLocaleText();
  const { language } = useLocale()
  const [list, setList] = useState<Alert[]>(loadAlerts()), [who, setWho] = useState<Record<string, Who | null>>({}), seen = useRef(new Set<string>()), first = useRef(true)
  const base = (import.meta.env as unknown as Record<string, string>).VITE_API_BASE, [tok, setTok] = useState(() => sessionStorage.getItem('nidan-staff-token') ?? ''), [remote, setRemote] = useState<Alert[]>([])
  const refresh = useCallback(() => setList(loadAlerts()), [])
  useEffect(() => subscribe(refresh), [refresh])
  useEffect(() => { if (!base || !tok) return; const f = () => void pullRemote(base, tok).then(setRemote); f(); const i = setInterval(f, 4000); return () => clearInterval(i) }, [base, tok])
  const merged = [...list, ...remote.filter((r) => !list.some((l) => l.sessionId === r.sessionId))]
  useEffect(() => { for (const a of list) if (!(a.id in who)) void identity(a).then((w) => setWho((x) => ({ ...x, [a.id]: w }))) }, [list]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const fresh = merged.filter((a) => a.status === 'new' && !seen.current.has(a.id)); fresh.forEach((a) => seen.current.add(a.id)); if (fresh.length && !first.current) beep(); first.current = false
    const n = merged.filter((a) => a.status !== 'ack').length; document.title = n ? `🚨 (${n}) ${_t('NIDAN urgent')}` : _t('NIDAN — Staff') }, [list])
  const open = merged.filter((a) => a.status !== 'ack'), done = merged.filter((a) => a.status === 'ack')
  return (<section>{base && <p className="status">{_t("Relay server:")}{" "}<input className="input" type="password" placeholder={_t("staff token")} value={tok} onChange={(e) => { setTok(e.target.value); sessionStorage.setItem('nidan-staff-token', e.target.value) }} /></p>}<button className="btn small" onClick={beep}>{_t("🔔 Test sound")}</button> <span className="status">{_t("A sound plays for new notices. Remote kiosk notices are unverified and are not an emergency classification.")}</span>
    {!open.length && <p className="note-box ok">{_t("No open urgent alerts.")}</p>}
    {open.map((a) => (<article key={a.id} className={'alert-card ' + a.status}><div><b>{a.token}</b> · {_t(a.ageBand)} · {ago(a.at, language, _t)} {a.status === 'left' && <span className="chip-tag bad">{_t("PATIENT LEFT KIOSK")}</span>} {a.unverified && <span className="chip-tag bad">{_t("UNVERIFIED REMOTE NOTICE")}</span>} <span className="chip-tag">{_t(a.delivery)}</span></div>
      <p className="who-line">{who[a.id] ? `${who[a.id]!.name}, ${who[a.id]!.age}` : _t("(identity not available — sealed or deleted by patient)")}</p>
      <ul>{a.flags.map((f) => <li key={f.id}><b>{f.tier === 'urgent' ? '🚨' : '⚠'} {_t(f.label)}</b> <span className="status">{_t("matched “")}{f.evidence}”</span></li>)}</ul>{a.unverified && <p className="note-box warm">{_t("Remote relay did not verify red flags or clinical urgency. Check the active kiosk and patient before any clinical decision.")}</p>}
      <button className="btn dark" onClick={() => { acknowledge(a.id); if (base && tok) void ackRemote(base, tok, a.id) }}>{_t("✔ I am attending")}</button></article>))}
    {done.length > 0 && <details><summary>{_t("Handled (")}{done.length})</summary>{done.map((a) => <p key={a.id} className="status">{a.token} · {ago(a.at, language, _t)} {_t("· acknowledged")}{" "}{a.ackAt ? ago(a.ackAt, language, _t) : ''}</p>)}</details>}</section>)
}

function Patients() {
  const _t = useLocaleText();
  const { language } = useLocale()
  const [list, setList] = useState<Session[]>([]), [sel, setSel] = useState<Session | null>(null), [q, setQ] = useState(''), [msg, setMsg] = useState('')
  const load = useCallback(() => { void (hubOn() && sessionStorage.getItem('nidan-staff-token') ? listSavedSynced(sessionStorage.getItem('nidan-staff-token')!) : listSaved()).then((l) => setList(l.sort((a, b) => (assessSession(b).urgent.length > 0 ? 1 : 0) - (assessSession(a).urgent.length > 0 ? 1 : 0) || a.startedAt.localeCompare(b.startedAt)))) }, [])
  useEffect(load, [load])
  const [filter, setFilter] = useState<'all' | 'urgent' | 'pending' | 'reviewed'>('all')
  const isUrgent = (s: Session) => assessSession(s).urgent.length > 0
  const stats = { all: list.length, urgent: list.filter(isUrgent).length, pending: list.filter((s) => !s.reviewedAt).length, reviewed: list.filter((s) => !!s.reviewedAt).length }
  const shown = list.filter((s) => (s.profile.name + s.token + s.concern).toLowerCase().includes(q.toLowerCase()) && (filter === 'all' || (filter === 'urgent' ? isUrgent(s) : filter === 'pending' ? !s.reviewedAt : !!s.reviewedAt)))
  const openRec = (s: Session) => { setSel(s); setMsg(''); void log('staff', 'record_viewed', s.id) }
  const persist = async (s: Session, patch: Partial<Session>, action?: string) => { const n = { ...s, ...patch }; await saveSession(n); if (action) void log('staff', action, s.id); setSel(n); load(); return n }
  return (<><section className="panel" aria-label={_t("Doctor dashboard")}><h2>{_t("Doctor dashboard")}</h2>
    <div className="tabs" role="group" aria-label={_t("Filter cases")}>{(['all', 'urgent', 'pending', 'reviewed'] as const).map((f) => <button key={f} className={'btn' + (filter === f ? ' dark' : '')} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? _t("All") : f === 'urgent' ? '🚨 ' + _t("Urgent") : f === 'pending' ? _t("Awaiting review") : _t("Reviewed")} ({stats[f]})</button>)}</div>
    <p className="status">{_t("Urgent cases are listed first. Summaries are patient-reported and unverified until a clinician confirms them.")}</p></section>
  <div className="doc-layout"><aside className="panel"><input className="input" placeholder={_t("Search name, token, complaint")} value={q} onChange={(e) => setQ(e.target.value)} />
    {shown.map((s) => { const u = assessSession(s).urgent.length > 0; return <button key={s.id} className={'item' + (sel?.id === s.id ? ' on' : '') + (u ? ' urgent' : '')} onClick={() => openRec(s)}><b>{u && '🚨 '}{s.profile.name || '—'}</b> <span className="chip-tag">{s.token}</span><small>{s.concern.slice(0, 50) || '—'} · {s.reviewedAt ? _t("reviewed") : _t("awaiting review")}</small></button> })}
    {!shown.length && <p className="status">{_t("No saved intakes yet.")}</p>}</aside>
    <section className="panel">{!sel ? <p className="status">{_t("Select a patient.")}</p> : (<>
      <h2>{sel.profile.name} <small className="status">{sel.token} · {sel.profile.age} {_t(sel.profile.ageUnit)}</small></h2>
      <pre className="sum">{summaryText(sel, makeUi(language))}</pre>
      {sel.docs.map((d) => (<div className="doc-card" key={d.id}><b>{d.name}</b> <span className="chip-tag">{d.method ? _t(d.method) : ''}{d.confidence ? ` ${Math.round(d.confidence)}%` : ''}</span>
        {(d.image || d.thumb) && <img className="orig" src={d.image || d.thumb} alt={_t('Original: {name}', { name: d.name })} />}<p className="status pre">{d.text || '(no text)'}</p>
        <label className="toggle"><input type="checkbox" checked={!!d.verified} onChange={(e) => void persist(sel, { docs: sel.docs.map((x) => (x.id === d.id ? { ...x, verified: e.target.checked } : x)) }, 'document_verified')} /> {_t("Checked against the original")}</label></div>))}
      <HistoryPanel sel={sel} all={list} update={(p, a) => persist(sel, p, a)} />
      <AiPanel sel={sel} onUse={(t) => setSel({ ...sel, notes: (sel.notes ? sel.notes + '\n' : '') + '[AI draft, unverified] ' + t })} />
      <label>{_t("Clinician notes")}<textarea className="input" rows={4} value={sel.notes} onChange={(e) => setSel({ ...sel, notes: e.target.value })} /></label>
      <div className="modal-actions"><button className="btn" onClick={() => { download(`nidan-${sel.token}-fhir.json`, 'application/fhir+json', JSON.stringify(toBundle(sel), null, 2)); void log('staff', 'export_fhir', sel.id) }}>{_t("Export FHIR R4")}</button>
        <button className="btn" onClick={async () => setMsg((await pushFhir(sel)) ? _t('Sent to endpoint') : _t('No endpoint configured or send failed (VITE_FHIR_ENDPOINT)'))}>{_t("Send to hospital endpoint")}</button>
        <button className="btn" onClick={() => { if (window.confirm(_t('This record will be deleted permanently?'))) { removeSaved(sel.id, 'staff'); setSel(null); load() } }}>{_t("🗑 Delete")}</button>
        <button className="btn dark" onClick={async () => { await persist(sel, { reviewedAt: new Date().toISOString() }, 'record_reviewed'); setMsg('Marked reviewed') }}>{_t("✔ Mark reviewed")}</button></div>{msg && <p className="status ok" role="status">{_t(msg)}</p>}</>)}</section></div></>)
}

function Metrics() {
  const _t = useLocaleText();
  const { language } = useLocale()
  const m = readMetrics(), r = summarise(m), mm = (x: number) => _t('{minutes} min {seconds} s', { minutes: new Intl.NumberFormat(language).format(Math.floor(x / 60)), seconds: new Intl.NumberFormat(language).format(Math.round(x % 60)) }), reviewed = languages.filter((l) => l.translation === 'reviewed').length, browserVoice = languages.filter((l) => l.recognition === 'browser-dependent').length
  const csv = () => download('nidan-pilot-metrics.csv', 'text/csv', ['id,at,lang,seconds,completed,urgent,assisted,express,voiceTries,voiceOk,corrections', ...m.map((x) => [x.id, x.at, x.lang, x.seconds, x.completed, x.urgent, x.assisted, x.express, x.voiceTries, x.voiceOk, x.corrections].join(','))].join('\n'))
  return (<section className="panel"><h2>{_t("Pilot metrics (anonymous)")}</h2><p className="status">{_t("No names or answers are recorded here. Use these numbers — from real people — instead of claims. See docs/TEST-PROTOCOL.md.")}</p>
    <table className="tbl"><tbody><tr><td>{_t("Intakes started")}</td><td>{r.sessions}</td></tr><tr><td>{_t("Completed")}</td><td>{r.completed} ({Math.round(r.completionRate * 100)}%)</td></tr><tr><td>{_t("Median time to complete")}</td><td>{r.completed ? mm(r.medianSec) : '—'}</td></tr><tr><td>{_t("Mean time to complete")}</td><td>{r.completed ? mm(r.meanSec) : '—'}</td></tr>
      <tr><td>{_t("Voice success rate")}</td><td>{r.voiceSuccess == null ? '—' : _t('{rate}% of {attempts} attempts', { rate: new Intl.NumberFormat(language).format(Math.round(r.voiceSuccess * 100)), attempts: new Intl.NumberFormat(language).format(r.voiceTries) })}</td></tr><tr><td>{_t("Urgent cases")}</td><td>{r.urgent}</td></tr><tr><td>{_t("Staff-assisted / quick mode")}</td><td>{r.assisted} / {r.express}</td></tr></tbody></table>
    <section className="innovation-card"><div className="portal-section-head"><h3>{_t("Accessibility readiness")}</h3><span className="chip-tag ok">{_t("Measured capability")}</span></div><p className="status">{_t("This is a capability inventory, not a claim that every device supports every voice pack.")}</p><div className="metric-cards"><div><b>{languages.length}</b><span>{_t("listed languages")}</span></div><div><b>{reviewed}</b><span>{_t("reviewed UI sets")}</span></div><div><b>{browserVoice}</b><span>{_t("browser-dependent voice paths")}</span></div></div><details><summary>{_t("Language capability matrix")}</summary><table className="tbl compact"><thead><tr><th>{_t("Language")}</th><th>{_t("UI")}</th><th>{_t("Input")}</th><th>{_t("Output")}</th></tr></thead><tbody>{languages.map((l) => <tr key={l.code}><td>{l.nativeName} <small>{l.code}</small></td><td>{_t(l.translation.replace(/-/g, ' '))}</td><td>{_t(l.recognition.replace(/-/g, ' '))}</td><td>{_t(l.synthesis.replace(/-/g, ' '))}</td></tr>)}</tbody></table></details></section>
    <section className="innovation-card"><div className="portal-section-head"><h3>{_t("Research evaluation card")}</h3><span className="chip-tag warn">{_t("Synthetic until pilot")}</span></div><p className="status">{_t("Compare NIDAN with paper or ordinary digital intake using the same scenarios. Suggested measures: completion time, missing answers, voice repair rate, OCR corrections, patient comprehension, and clinician usefulness. Do not enter real patient outcomes as demo data.")}</p><ol className="status"><li>{_t("Run the same fictional case in paper, touch-only, and voice-assisted modes.")}</li><li>{_t("Record time, unanswered fields, corrections, and fallback-to-touch events.")}</li><li>{_t("Have a clinician rate summary usefulness separately from diagnostic accuracy.")}</li></ol></section>
    <button className="btn" onClick={csv} disabled={!m.length}>{_t("Export CSV")}</button></section>)
}

function Audit() {
  const _t = useLocaleText();
  const [ok, setOk] = useState<string>(''), list = readAudit()
  useEffect(() => { void auditIdle() }, [])
  return (<section className="panel"><h2>{_t("Audit trail")}</h2><p className="status">{_t("Hash-chained, ids and actions only (no patient content). Tamper-")}<i>{_t("evident")}</i>{_t(": editing an entry breaks the chain. It does not stop someone with full device access from deleting everything.")}</p>
    <button className="btn" onClick={async () => { const r = await verifyAudit(); setOk(r.ok ? `Chain intact (${list.length} entries)` : `BROKEN at entry ${r.badAt}`) }}>{_t("Verify chain")}</button> {ok && <b role="status">{ok}</b>}
    <table className="tbl"><thead><tr><th>#</th><th>{_t("Time")}</th><th>{_t("Actor")}</th><th>{_t("Action")}</th><th>{_t("Ref")}</th></tr></thead><tbody>{[...list].reverse().slice(0, 200).map((e) => <tr key={e.n}><td>{e.n}</td><td>{new Date(e.t).toLocaleString()}</td><td>{e.actor}</td><td>{e.action}</td><td className="mono-b">{e.ref}</td></tr>)}</tbody></table></section>)
}

function Settings() {
  const _t = useLocaleText();
  const e = import.meta.env as unknown as Record<string, string>
  return (<section className="panel"><h2>{_t("Configuration")}</h2><table className="tbl"><tbody>
    <tr><td>{_t("Alert webhook (VITE_ALERT_WEBHOOK)")}</td><td>{e.VITE_ALERT_WEBHOOK ? _t("configured") : _t("not set — alerts reach only staff screens in this browser")}</td></tr>
    <tr><td>{_t("Alert server (VITE_API_BASE)")}</td><td>{e.VITE_API_BASE ? _t("configured") : _t("not set")}</td></tr><tr><td>{_t("Hospital FHIR endpoint (VITE_FHIR_ENDPOINT)")}</td><td>{e.VITE_FHIR_ENDPOINT ? _t("configured") : _t("not set — FHIR export only")}</td></tr>
    <tr><td>{_t("Retention")}</td><td>{_t("30 days (saved intakes are deleted automatically)")}</td></tr><tr><td>{_t("Clinical sign-off")}</td><td>{REVIEWED || 'NOT SIGNED OFF (draft)'}</td></tr></tbody></table>
    <p><a href="#/selftest">{_t("Run demo-readiness self-test")}</a> · <a href="#/about">{_t("What is real vs simulated")}</a></p></section>)
}

function HistoryPanel({ sel, all, update }: { sel: Session; all: Session[]; update: (p: Partial<Session>, a?: string) => Promise<unknown> }) {
  const _t = useLocaleText();
  const [rec, setRec] = useState<PatientRecord | null>(null), [note, setNote] = useState(''), [phone, setPhone] = useState(''), [msg, setMsg] = useState('')
  useEffect(() => { setRec(null); setMsg(''); if (sel.pid) void getRecord(sel.pid).then((r) => setRec(r ?? emptyRecord(sel.pid, sel.profile.name, sel.profile.phone))) }, [sel.id, sel.pid])
  if (!sel.pid) return (<div className="panel slim"><h3>{_t("Patient history")}</h3><p className="status">{_t("This visit could not be linked to a patient (no phone or ID was given). Link it by phone number:")}</p>
    <div className="modal-actions"><input className="input" inputMode="numeric" placeholder={_t("10-digit phone")} value={phone} onChange={(e) => setPhone(e.target.value)} /><button className="btn" onClick={async () => { const pid = await patientKey(phone); if (!pid) { setMsg('Enter a 10-digit number'); return } await update({ pid, profile: { ...sel.profile, phone } }, 'visit_linked'); setMsg('Linked') }}>{_t("Link")}</button></div>{msg && <p className="status">{msg}</p>}</div>)
  const visits = all.filter((x) => x.pid === sel.pid && x.id !== sel.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const save = async (r: PatientRecord) => { try { setRec(await saveRecord(r)); setMsg('History saved (encrypted)') } catch (e) { setMsg((e as Error).message) } }
  return (<div className="panel slim"><h3>{_t("Patient history")}{" "}<span className="chip-tag">{visits.length} {_t("earlier visit")}{visits.length === 1 ? '' : 's'}</span></h3>
    <p className="status">{_t("Entered and owned by staff. The kiosk never reads this; returning patients are only asked how they feel now and what changed.")}</p>
    {rec && (<>
      <label>{_t("Long-term conditions")}<textarea className="input" rows={2} value={rec.chronic} onChange={(e) => setRec({ ...rec, chronic: e.target.value })} /></label>
      <label>{_t("Allergies")}<textarea className="input" rows={2} value={rec.allergies} onChange={(e) => setRec({ ...rec, allergies: e.target.value })} /></label>
      <label>{_t("Regular medicines")}<textarea className="input" rows={2} value={rec.meds} onChange={(e) => setRec({ ...rec, meds: e.target.value })} /></label>
      <div className="modal-actions"><button className="btn" onClick={() => setRec(mergeVisit(rec, { meds: sel.answers.hist_meds, allergy: sel.answers.hist_allergy }))}>{_t("+ Add this visit’s reported medicines / allergies")}</button><button className="btn dark" onClick={() => void save(rec)}>{_t("Save history")}</button></div>
      <div className="modal-actions"><input className="input" placeholder={_t("Add a dated note")} value={note} onChange={(e) => setNote(e.target.value)} /><button className="btn" disabled={!note.trim()} onClick={() => { void save({ ...rec, notes: [{ at: new Date().toISOString(), by: 'staff', text: note.trim() }, ...rec.notes] }); setNote('') }}>{_t("Add note")}</button></div>
      {rec.notes.map((n, i) => <p key={i} className="status"><b>{new Date(n.at).toLocaleDateString()}</b> — {n.text}</p>)}</>)}
    {msg && <p className="status ok" role="status">{msg}</p>}
    {visits.length > 0 && <details open><summary>{_t("Earlier visits")}</summary>{visits.map((v) => <p key={v.id} className="status"><b>{new Date(v.startedAt).toLocaleDateString()}</b> · {v.token} · {v.concern.slice(0, 70) || '—'}{v.answers.feeling_now ? ` · felt: ${v.answers.feeling_now}` : ''}{v.notes ? ` · notes: ${v.notes.slice(0, 60)}` : ''}</p>)}</details>}</div>)
}

function AiPanel({ sel, onUse }: { sel: Session; onUse: (t: string) => void }) {
  const _t = useLocaleText();
  const [out, setOut] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const tok = sessionStorage.getItem('nidan-staff-token') ?? ''
  const consented = sel.consent === true && sel.aiProcessing === true && sel.consentLog?.aiProcessing === true
  const run = async (task: 'summarize' | 'translate') => { setBusy(true); setErr(''); setOut(''); try { const r = await askLocalAI(sel, task, tok); setOut(`${r.text}\n\n— drafted by local model “${r.model}”. Unverified; not a diagnosis.`) } catch (e) { setErr((e as Error).message) } setBusy(false) }
  return (<div className="panel slim"><h3>{_t("Hospital-local AI (optional)")}</h3>
    <p className="status">{_t("Uses only this visit after the patient separately opts in. The app removes obvious name, phone and ID patterns, but automatic de-identification is imperfect and free text can contain identifiers. The model must run on a hospital-approved local network. Output is an unverified draft, never saved automatically, and must be checked by a clinician.")}</p>
    {!consented ? <p className="note-box warm" role="status">{_t("No separate patient opt-in for AI processing is recorded for this visit. No AI request will be made. The patient can continue care without AI.")}</p> : !hubOn() ? <p className="note-box warm">{_t("Local AI is off: set VITE_API_BASE to your hospital hub and configure its local model.")}</p> : !tok ? <p className="note-box warm">{_t("Enter the staff token in the Alerts tab (relay server box) first.")}</p> : (<div className="modal-actions"><button className="btn" disabled={busy} onClick={() => void run('summarize')}>{_t("Draft summary")}</button><button className="btn" disabled={busy} onClick={() => void run('translate')}>{_t("Translate patient’s words to English")}</button></div>)}
    {busy && <p className="status">{_t("Asking the local model…")}</p>}{err && <p className="form-error">{err}</p>}{out && <><pre className="sum">{out}</pre><button className="btn small" onClick={() => onUse(out.split('\n\n—')[0])}>{_t("Copy into notes")}</button></>}</div>)
}
function DataTab() {
  const _t = useLocaleText();
  const [all, setAll] = useState<Session[]>([]), [msg, setMsg] = useState('')
  useEffect(() => { void listSaved().then(setAll) }, [])
  const consented = all.filter((s) => s.consentLog?.research === true).length
  return (<section className="panel"><h2>{_t("Data stays in the hospital")}</h2>
    <table className="tbl"><tbody><tr><td>{_t("Storage")}</td><td>{_t("Encrypted in this browser;")}{" "}{hubOn() ? _t("also mirrored as ciphertext to your hospital hub") : _t("no hub configured (single-device mode)")}{_t(". Hub copies are unreadable without the staff passphrase.")}</td></tr>
      <tr><td>{_t("Waiting to upload to hub")}</td><td>{pendingOutbox()}</td></tr><tr><td>{_t("Cloud services")}</td><td>{_t("None for data. (Browser voice recognition may use Google/Microsoft only if the patient allowed voice.)")}</td></tr></tbody></table>
    <h3>{_t("Improving the hospital’s own AI")}</h3><p className="status">{_t("Only visits where the patient ticked the separate, optional research consent are included (")}{consented} {_t("of")}{" "}{all.length}{_t("). Exports contain no name, phone, ID, token, notes or images; ages are banded and dates reduced to month. Automatic scrubbing is")}{" "}<b>{_t("not perfect")}</b>{_t(": free text can hide identifiers. Use only with your institution’s ethics / data-protection approval and keep the file inside the hospital network.")}</p>
    <button className="btn dark" disabled={!consented} onClick={() => { const rows = researchSet(all); download('nidan-deidentified.jsonl', 'application/x-ndjson', rows.map((r) => JSON.stringify(r)).join('\n')); void log('staff', 'export_research', String(rows.length)); setMsg(`Exported ${rows.length} de-identified records`) }}>{_t("Export de-identified set")}</button> {msg && <b role="status">{msg}</b>}</section>)
}
