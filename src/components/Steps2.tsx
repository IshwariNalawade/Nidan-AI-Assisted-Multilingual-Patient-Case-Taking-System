import { useLocaleText } from './LocaleProvider'
import { useRef, useState } from 'react'
import { StepFrame, type SetFn, type StepProps } from './Frame'
import { ChoiceMic, VoiceInput, useVoice } from './Voice'
import Camera from './Camera'
import { AY_FIELDS } from '../data/ui-data'
import { assess } from '../lib/safety'
import { makeUi } from '../i18n'
import { assessSession, download, optionLabel, questionQueue, summarySections, summaryText } from '../lib/report'
import { ACCEPT, fileToDataUrl, findFields, readImage, readPdf, trimImage, validateFile, type OcrResult } from '../lib/ocr'
import { normDigits } from '../lib/parse'
import type { ReportDoc, Session } from '../model'

const EN = makeUi('en-IN'), MR = makeUi('mr-IN'), HI = makeUi('hi-IN')
const words = (key: string) => [...new Set([EN(key), MR(key), HI(key)].map((x) => x.toLowerCase()))]

export function AyHist({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  return (
    <StepFrame s={s} step="ayHist" title={ui('ayHistTitle')} desc={ui('ayHistDesc')} prompt={ui('v_ayHist')} nav={nav}>
      <div className="ay-grid">{AY_FIELDS.map((f, n) => (
        <div className="panel slim" key={f.k}>
          <h3>{ui(f.label)}</h3>
          <div className="chip-row">{f.opts.map((o) => <button key={o} className={'chip' + (s.ayHist[f.k] === o ? ' on' : '')} aria-pressed={s.ayHist[f.k] === o} onClick={() => set({ ayHist: { ...s.ayHist, [f.k]: o } })}>{ui('o_' + o)}</button>)}</div>
          <ChoiceMic primary={n === 0} choices={f.opts.map((o) => ({ value: o, words: words('o_' + o) }))} onPick={(o) => set({ ayHist: { ...s.ayHist, [f.k]: o } })} label={(o) => ui('o_' + o)} />
        </div>))}</div>
    </StepFrame>
  )
}

export function Questions({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui, lang } = useVoice()
  const queue = questionQueue(s, ui)
  const qi = Math.min(s.qi, queue.length - 1), q = queue[qi]
  const [skipped, setSkipped] = useState(false)
  const ans = s.answers[q.id] ?? ''
  const setAns = (x: string) => set((c) => ({ answers: { ...c.answers, [q.id]: x } }))
  const opts = q.type === 'yesno' ? ['Yes', 'No'] : q.options ?? []
  const lab = (o: string) => (q.type === 'yesno' ? ui(o === 'Yes' ? 'yes' : 'no') : q.optionLabels?.[q.options?.indexOf(o) ?? -1] ?? optionLabel(o, lang))
  const optWords = (o: string) => (q.type === 'yesno' ? words(o === 'Yes' ? 'yes' : 'no').concat(o === 'Yes' ? ['yes', 'yeah', 'हो', 'हां'] : ['no', 'nope', 'नाही', 'नहीं']) : [o.toLowerCase(), lab(o).toLowerCase()])
  const scale = Array.from({ length: 10 }, (_, k) => String(k + 1))
  const goPrev = () => { if (qi > 0) { set({ qi: qi - 1 }); return false } }
  const goNext = () => { setSkipped(false); if (qi < queue.length - 1) { set({ qi: qi + 1 }); return false } }
  return (
      <StepFrame s={s} step="questions" title={ui('qTitle')} desc={ui('qDesc')} prompt={q.label} nav={nav} hideBack={false}
      validate={() => (ans.trim() || skipped ? null : ui('required'))} onNext={goNext} onBack={goPrev} key={q.id}>
      <div className="qprog"><span className="mono tiny">{ui('qN', { a: qi + 1, b: queue.length })}</span><span className="bar"><i style={{ width: `${((qi + 1) / queue.length) * 100}%` }} /></span></div>
      <section className="qcard">
        <div className="qhead"><span className="badge warm mono">{String(qi + 1).padStart(2, '0')}</span><div><h2 className="qtitle">{q.label}</h2>{q.helper && <p className="desc small">{q.helper}</p>}</div></div>
        {q.type === 'text' && <VoiceInput id={`q-${q.id}`} prompt={q.label} value={ans} multiline rows={4} placeholder={q.placeholder ?? ui('ph')} onChange={setAns} autoPrimary />}
        {q.type === 'text' && <p className="status">{ui('stays')}</p>}
        {q.type === 'scale' && (<><div className="scale" role="radiogroup">{scale.map((n) => <button key={n} role="radio" aria-checked={ans === n} className={'chip num' + (ans === n ? ' on' : '')} onClick={() => setAns(n)}>{n}</button>)}</div>
          <ChoiceMic primary choices={scale.map((n, k) => ({ value: n, words: [n, ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][k]] }))} onPick={setAns} onMatched={() => window.setTimeout(goNext, 250)} label={(x) => x} /></>)}
        {(q.type === 'yesno' || q.type === 'choice') && (<><div className="chip-row">{opts.map((o) => <button key={o} className={'chip big' + (ans === o ? ' on' : '')} aria-pressed={ans === o} onClick={() => setAns(o)}>{lab(o)}</button>)}</div>
          <ChoiceMic primary choices={opts.map((o) => ({ value: o, words: optWords(o) }))} onPick={setAns} onMatched={() => window.setTimeout(goNext, 250)} label={lab} /></>)}
        <button className="link-btn" onClick={() => { setSkipped(true); set((c) => { const a = { ...c.answers }; delete a[q.id]; return { answers: a } }) }}>{ui('skipQ')}{skipped ? ' ✓' : ''}</button>
      </section>
      <p className="note-box">🎤 {ui('speakNat')}</p>
    </StepFrame>
  )
}

const rid = () => Math.random().toString(36).slice(2, 9)
export function Reports({ s, set, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui, lang } = useVoice()
  const fileRef = useRef<HTMLInputElement>(null)
  const [cam, setCam] = useState(false)
  const [trim, setTrim] = useState<{ src: string; name: string; original?: string } | null>(null)
  const [typed, setTyped] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [prog, setProg] = useState<Record<string, number>>({})
  const patch = (id: string, p: Partial<ReportDoc>) => set((c) => ({ docs: c.docs.map((d) => (d.id === id ? { ...d, ...p } : d)) }))
  const run = async (id: string, job: () => Promise<OcrResult>) => {
    try {
      const r = await job()
      if (!r.text.trim()) patch(id, { status: 'failed', error: 'No readable text was found. Retry the scan or type the text below.', method: r.method, thumb: r.thumb })
      else patch(id, { status: 'ready', text: r.text, method: r.method, confidence: r.confidence, langs: r.langs, ocrFallback: r.fallback, thumb: r.thumb })
    } catch (e) {
      patch(id, { status: 'failed', error: `OCR could not read this file (${e instanceof Error ? e.message : 'unknown error'}). Retry, choose a clearer image, or type the text below. Local English/Hindi/Marathi packs do not need a language download.` })
    }
  }
  const addImage = async (src: string, name: string, source: 'file' | 'scanner', originalImage?: string) => {
    const id = rid(); const thumb = await trimImage(src, { top: 0, right: 0, bottom: 0, left: 0 }, 160)
    set((c) => ({ docs: [...c.docs, { id, name, source, status: 'processing', text: '', thumb, image: src, originalImage: originalImage ?? src }] }))
    void run(id, () => readImage(src, lang, (p) => setProg((x) => ({ ...x, [id]: p }))).then((r) => ({ ...r, thumb })))
  }
  const onFiles = async (files: FileList | null) => {
    setErr('')
    for (const f of Array.from(files ?? [])) {
      if (!validateFile(f)) { setErr(`${f.name}: ${ui('fileErr')}`); continue }
      if (f.type === 'application/pdf') {
        const id = rid()
        const image = await fileToDataUrl(f)
        set((c) => ({ docs: [...c.docs, { id, name: f.name, source: 'file', status: 'processing', text: '', image }] }))
        void run(id, () => readPdf(f, lang, (p) => setProg((x) => ({ ...x, [id]: p }))))
      } else { const original = await fileToDataUrl(f); setTrim({ src: original, original, name: f.name }) }
    }
    if (fileRef.current) fileRef.current.value = ''
  }
  const addTyped = () => { if (!typed?.trim()) return; set((c) => ({ docs: [...c.docs, { id: rid(), name: 'Written report', source: 'typed', status: 'ready', method: 'typed', text: typed.trim() }] })); setTyped(null) }
  return (
    <StepFrame s={s} step="reports" title={ui('repTitle')} desc={ui('repDesc')} prompt={ui('v_rep')} nav={nav}>
      <div className="report-actions">
        <button className="btn dark big" onClick={() => setCam(true)}>📷 {ui('cam')}</button>
        <label className="btn big">📱 {ui('mobileCam')}<input type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={(e) => void onFiles(e.target.files)} /></label>
        <label className="btn big file-btn">⬆ {ui('upload')}<input ref={fileRef} type="file" multiple accept={ACCEPT.join(',') + ',.pdf,.jpg,.jpeg,.png'} hidden onChange={(e) => void onFiles(e.target.files)} /></label>
        <button className="btn big" onClick={() => setTyped('')}>✎ {ui('typed')}</button>
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
      <p className="note-box ok">🛡 {ui('repSafety')}</p>
      {typed !== null && (
        <div className="panel"><VoiceInput id="typed-report" prompt={ui('typedPh')} value={typed} onChange={setTyped} multiline rows={6} placeholder={ui('typedPh')} autoPrimary />
          <div className="modal-actions"><button className="btn" onClick={() => setTyped(null)}>{ui('cancel')}</button><button className="btn dark" onClick={addTyped}>{ui('saveDoc')}</button></div></div>
      )}
      {s.docs.map((d) => <DocCard key={d.id} d={d} s={s} set={set} progress={prog[d.id]} patch={patch} />)}
      {cam && <Camera onClose={() => setCam(false)} onUse={(u) => { setCam(false); void addImage(u, `Scan ${new Date().toLocaleTimeString()}.jpg`, 'scanner') }} />}
      {trim && <Camera initial={trim.src} onClose={() => setTrim(null)} onUse={(u) => { const { name, original } = trim; setTrim(null); void addImage(u, name, 'file', original) }} />}
    </StepFrame>
  )
}

function DocCard({ d, set, progress, patch }: { d: ReportDoc; s: Session; set: SetFn; progress?: number; patch: (id: string, p: Partial<ReportDoc>) => void }) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  const f = findFields(d.text), sig = assess([d.text], { ageYears: null, pregnant: '' }).urgent.map((x) => x.label)
  const box = (label: string, items: string[]) => <div className="fbox"><div className="mono tiny orange">{label}</div><p>{items.length ? items.join(' · ') : ui('notFound')}</p></div>
  return (
    <section className="doc-card">
      <header><span className="icon-circle">📄</span><b>{d.name}</b><span className="mono tiny">{d.source.toUpperCase()}</span>
        <span className={'chip-tag ' + (d.status === 'ready' ? 'ok' : d.status === 'failed' ? 'bad' : '')}>{ui('status_' + d.status)}{d.status === 'processing' && progress ? ` ${Math.round(progress * 100)}%` : ''}</span>
        <button className="link-btn" onClick={() => set((c) => ({ docs: c.docs.filter((x) => x.id !== d.id) }))}>{ui('remove')}</button></header>
      {d.thumb && <img className="thumb" src={d.thumb} alt="" />}
      {d.status === 'failed' && <p className="form-error">{d.error}</p>}
      {d.status !== 'processing' && (
        <>
          {d.ocrFallback && <p className="note-box warm" role="status">{ui('ocrFallback')}</p>}
          <div className="fields">{box(ui('f_med'), f.medicines)}{box(ui('f_dx'), f.diagnosis)}{box(ui('f_tests'), f.tests)}{box(ui('f_allergy'), f.allergies)}{box(ui('f_obs'), f.observations)}</div>
          <p className="status">{ui('ruleNote')}</p>
          {sig.length > 0 && <p className="note-box bad">🚨 {ui('signals')}: {sig.join(', ')}</p>}
          <label className="mono tiny" htmlFor={`t-${d.id}`}>{ui('extractedText')}{d.method ? ` · ${d.method}${d.confidence ? ` · ${Math.round(d.confidence)}%` : ''}${d.langs ? ' · ' + d.langs : ''}` : ''}</label>
          <textarea id={`t-${d.id}`} className="input" rows={5} value={d.text} onChange={(e) => patch(d.id, { text: e.target.value, ...(d.status === 'failed' && e.target.value.trim() ? { status: 'ready', method: 'typed', error: undefined } : {}) })} />
          {d.method === 'ocr' && <p className="status">{ui('ocrNote')}</p>}
          {d.method === 'ocr' && (d.confidence ?? 0) < 60 && <p className="note-box warm">⚠ {ui('handwriting')}</p>}
          {!d.patientConfirmed ? <div className="note-box warm"><p>{ui('unverified')} {_t("Machine-extracted text is not confirmed and is not used for AI drafts.")}</p><button className="btn small" onClick={() => patch(d.id, { patientConfirmed: true })}>{_t("I reviewed and corrected this text")}</button></div> : <p className="note-box ok">{_t("Patient-confirmed extraction; the original document is retained separately.")}</p>}
        </>
      )}
    </section>
  )
}

export function Safety({ s, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  const r = assessSession(s), tr = r.urgent.map((f) => f.label)
  return (
    <StepFrame s={s} step="safety" title={ui('safeTitle')} desc={ui('safeDesc')} prompt={tr.length ? ui('emTitle') + '. ' + ui('emBody', { x: tr.join(', ') }) : ui('safeNone')} nav={nav}>
      {r.urgent.length > 0 && <div className="emergency" role="alert"><h2>🚨 {ui('emTitle')}</h2><p>{ui('emBody', { x: tr.join(', ') })}</p><ul>{r.urgent.map((f) => <li key={f.id}><b>{f.label}</b> <span className="status">“{f.evidence}”{f.note ? ` — ${f.note}` : ''}</span></li>)}</ul><a className="btn dark big" href="tel:112">📞 112</a></div>}
      {r.review.length > 0 && <div className="note-box warm" role="status"><b>{ui('reviewTier')}:</b> {r.review.map((f) => f.label + (f.note ? ` (${f.note})` : '')).join('; ')}</div>}
      {!r.urgent.length && !r.review.length && <p className="note-box ok big">✔ {ui('safeNone')}</p>}
    </StepFrame>
  )
}

function SummaryView({ s }: { s: Session }) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  const queue = questionQueue(s, ui)
  const missing = [
    !s.profile.name.trim() && 'patient name',
    !s.profile.age.trim() && 'age',
    !s.profile.sex.trim() && 'sex',
    !s.concern.trim() && 'main concern',
    !s.symptom && 'closest symptom area',
    ...queue.filter((q) => !String(s.answers[q.id] ?? '').trim()).map((q) => q.label),
    ...s.docs.filter((d) => d.status === 'processing').map((d) => `${d.name} OCR processing`),
    ...s.docs.filter((d) => d.method === 'ocr' && !d.patientConfirmed).map((d) => `${d.name} text confirmation`),
  ]
  return (
    <div className="summary print-area">
      <h2 className="print-title">{_t("NIDAN —")}{" "}{ui('sumTitle')}</h2>
      <section className={missing.length ? 'note-box warm' : 'note-box ok'}><b>{missing.length ? _t("Information to review before consultation") : _t("No obvious intake fields are missing")}</b><p>{missing.length ? `${missing.length} item${missing.length === 1 ? '' : 's'} may need attention: ${missing.slice(0, 6).join('; ')}${missing.length > 6 ? '…' : ''}` : _t("This is a completeness check only; it does not assess medical urgency or diagnose a condition.")}</p>{missing.length > 6 && <details><summary>{_t("Show all completeness items")}</summary><ul>{missing.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul></details>}</section>
      {summarySections(s, ui).map((x) => <section key={x.title} className="sum-sec"><h3>{x.title}</h3>{x.lines.map((l, i) => <p key={i} className="pre">{l}</p>)}</section>)}
      <p className="status">{ui('disclaimer')}</p>
    </div>
  )
}
function Actions({ s, ui }: { s: Session; ui: ReturnType<typeof makeUi> }) { const _t = useLocaleText(); return (
  <div className="report-actions no-print">
    <button className="btn dark" onClick={() => window.print()}>🖨 {ui('print')}</button>
    <button className="btn" onClick={() => download(`nidan-${s.id}.txt`, 'text/plain', summaryText(s, ui))}>⬇ {ui('dlTxt')}</button>
    <button className="btn" onClick={() => download(`nidan-${s.id}.json`, 'application/json', JSON.stringify({ ...s, docs: s.docs.map((d) => ({ ...d, thumb: undefined })) }, null, 2))}>⬇ {ui('dlJson')}</button>
  </div>
); }
export function Summary({ s, nav }: StepProps) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  return <StepFrame s={s} step="summary" title={ui('sumTitle')} desc={ui('sumDesc')} nav={nav}><Actions s={s} ui={ui} /><SummaryView s={s} /></StepFrame>
}

export function Review({ s, nav, saved, backendHandoff = '' }: StepProps & { saved: 'saved' | 'unsaved' | 'pending'; backendHandoff?: string }) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  return (
    <StepFrame s={s} step="review" title={ui('revTitle')} desc={ui('revDesc')} prompt={ui('handoff')} nav={nav}>
      <div className="panel"><p className="lead">{saved === 'unsaved' ? ui('notSaved') : ui('handoff')}</p>
        {backendHandoff && <><p className={backendHandoff.startsWith('Authenticated intake saved') ? 'note-box ok' : 'note-box warm'} role="status">{backendHandoff}</p>{!backendHandoff.startsWith('Authenticated intake saved') && <a className="btn dark" href="#/account">{_t("Sign in to connect this intake to the patient and doctor portal")}</a>}</>}
        {s.token && <p className="token">{ui('token')}: <b>{s.token}</b></p>}
        {saved === 'unsaved' && <p className="form-error" role="alert">{ui('notSaved')}</p>}
        <a className="btn" href="#/staff" target="_blank" rel="noreferrer">{_t("🔒 Staff: open review")}</a></div>
    </StepFrame>
  )
}

export function Done({ s, nav, reset, onDelete }: StepProps & { reset: () => void; onDelete: () => void }) {
  const _t = useLocaleText();
  const { ui } = useVoice()
  const [gone, setGone] = useState(false)
  return (
    <StepFrame s={s} step="done" title={ui('doneTitle')} desc={ui('doneDesc')} prompt={ui('doneDesc')} nav={nav} hideNext hideBack>
      {s.token && <p className="token big">{ui('token')}: <b>{s.token}</b></p>}
      {gone ? <p className="note-box ok" role="status">{ui('delDone')}</p> : <><Actions s={s} ui={ui} /><div className="report-actions"><button className="btn" onClick={() => { onDelete(); setGone(true) }}>🗑 {ui('delData')}</button></div></>}
      <div className="report-actions"><button className="btn dark big" onClick={reset}>{ui('newCase')}</button></div>
    </StepFrame>
  )
}
export { normDigits }
