import { useLocale, useLocaleText } from './LocaleProvider'
import { useMemo, useState } from 'react'
import type { Assessment, CareOrganization, ClinicalReview, TriageCase, User } from './portal-types'
import { clinicalText } from '../i18n'
import { languageByCode } from '../data/languages'
import { symptomModules } from '../data/clinical'

const isUrgent = (item: Pick<Assessment, 'safetyFindings'>) => (item.safetyFindings ?? []).some((finding) => finding.tier === 'urgent')
const dateLabel = (value: string, language: string) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const DASHBOARD_HANDOFF_KEY = 'nidan.dashboard.handoffs'
function addToDashboard(item: TriageCase) {
  const handoff = { id: `handoff-${item.id}`, token: item.queueToken ?? `NID-${item.id.slice(0, 6).toUpperCase()}`, name: item.patient.fullName, age: item.patient.ageYears ?? 0, sex: item.patient.sex ?? 'Not recorded', language: item.patient.preferredLanguage, concern: item.concern || 'Emergency intake requiring staff review', department: item.organization?.name ?? 'Triage desk', priority: isUrgent(item) ? 'Urgent' : 'Review', status: 'Awaiting review', arrived: new Date(item.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), attendedBy: 'Staff triage', summary: 'Patient intake was reviewed by staff and added to the clinical dashboard for immediate care-team follow-up.', findings: (item.safetyFindings ?? []).slice(0, 3).map((finding) => finding.label), notes: item.triageNotes || 'Staff handoff created. Clinician review is required.', nextStep: 'Open the case and complete clinician assessment.', lastUpdated: 'just now' }
  try {
    const current = JSON.parse(localStorage.getItem(DASHBOARD_HANDOFF_KEY) ?? '[]') as typeof handoff[]
    localStorage.setItem(DASHBOARD_HANDOFF_KEY, JSON.stringify([...current.filter((entry) => entry.id !== handoff.id), handoff].slice(-25)))
    window.dispatchEvent(new Event('nidan-dashboard-update'))
  } catch { /* demo handoff remains visible in the staff session */ }
}
export const readable = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').trim().toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())

export function symptomLabel(key: string | null | undefined, language: string, t: (source: string) => string) {
  const module = symptomModules.find((item) => item.key === key)
  return module ? clinicalText(language, `symptom:${module.key}:label`, module.label) : t('Symptom intake')
}

export function AnswerList({ answers, symptomKey }: { answers?: Record<string, unknown>; symptomKey?: string | null }) {
  const _t = useLocaleText()
  const { language } = useLocale()
  const module = symptomModules.find((item) => item.key === symptomKey)
  const entries = Object.entries(answers ?? {})
  if (!entries.length) return <p className="workspace-helper">{_t('No answers recorded.')}</p>
  return <dl className="workspace-answers">{entries.map(([id, raw]) => {
    const question = module?.questions.find((item) => item.id === id)
    const label = question ? clinicalText(language, `question:${question.id}:label`, question.label) : _t(readable(id))
    const answer = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const optionIndex = question?.options?.indexOf(answer) ?? -1
    const value = question && optionIndex >= 0 ? clinicalText(language, `question:${question.id}:option:${optionIndex}`, answer) : answer === 'Yes' || answer === 'No' ? _t(answer) : answer
    return <div key={id}><dt>{label}</dt><dd>{value || _t('Not provided')}</dd></div>
  })}</dl>
}

function Metric({ value, label, tone = '' }: { value: number | string; label: string; tone?: string }) {
  const _t = useLocaleText();
  return <div className={`workspace-metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>
}

function FilterBar<T extends string>({ value, options, onChange }: { value: T; options: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
  const _t = useLocaleText();
  return <div className="workspace-filters" role="group" aria-label={_t("Filter cases")}>
    {options.map((option) => <button key={option.id} type="button" className={value === option.id ? 'workspace-filter is-active' : 'workspace-filter'} aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button>)}
  </div>
}

export interface DoctorWorkspaceProps {
  cases: Assessment[]
  organization: { id: string; name: string; kind: string } | null
  user: User | null
  selected: Assessment | null
  notes: string
  setNotes: (value: string) => void
  clinicalReview: ClinicalReview | null
  busy: boolean
  fail: string
  msg: string
  onSelect: (item: Assessment) => void
  onClaim: (item: Assessment) => void
  onLookup: (token: string) => void
  onGenerateReview: () => void
  onSaveReview: () => void
  onRefresh: () => void
}

export function DoctorWorkspace(props: DoctorWorkspaceProps) {
  const _t = useLocaleText();
  const { language } = useLocale()
  const { cases, organization, user, selected, notes, setNotes, clinicalReview, busy, fail, msg, onSelect, onClaim, onLookup, onGenerateReview, onSaveReview, onRefresh } = props
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'WAITING' | 'URGENT'>('ALL')
  const [token, setToken] = useState('')
  const urgent = cases.filter(isUrgent).length
  const waiting = cases.filter((item) => item.status === 'SUBMITTED' && item.assignedDoctorId !== user?.id).length
  const filtered = useMemo(() => cases
    .filter((item) => `${item.concern ?? ''} ${item.patient?.fullName ?? ''} ${item.symptomKey ?? ''} ${item.status} ${item.queueToken ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => filter === 'ALL' || (filter === 'URGENT' ? isUrgent(item) : item.status === 'SUBMITTED' && item.assignedDoctorId !== user?.id))
    .sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a))), [cases, filter, query, user?.id])

  return <div className="role-workspace doctor-workspace">
    <section className="role-hero doctor-hero-new">
      <div className="role-hero-copy"><span className="role-eyebrow"><span className="role-eyebrow-dot" /> {_t("DOCTOR · CLINICAL WORKSPACE")}</span>
        <h1>{_t("Your review desk, at a glance.")}</h1>
        <p>{_t("Review the patient’s account of their visit, check the handoff, and record your clinical review. NIDAN supports information review; it does not diagnose or prescribe.")}</p>
      </div>
      <div className="role-hero-context"><span>{_t("ORGANIZATION")}</span><strong>{organization?.name ?? _t('No organization assigned')}</strong><small>{organization ? `${_t(readable(organization.kind))} · ${_t('organization-scoped queue')}` : _t("Ask an administrator to assign your organization before cases can be routed.")}</small><button type="button" className="role-refresh" onClick={onRefresh} disabled={busy}>↻ <span>{_t("Refresh cases")}</span></button></div>
    </section>

    <section className="workspace-metrics" aria-label={_t("Doctor case overview")}>
      <Metric value={cases.length} label={_t('Cases in your queue')} />
      <Metric value={waiting} label={_t('Waiting for review')} tone="metric-warm" />
      <Metric value={urgent} label={_t('Urgent rule flags')} tone={urgent ? 'metric-alert' : ''} />
      <Metric value={cases.filter((item) => item.status === 'REVIEWED').length} label={_t('Reviewed')} tone="metric-calm" />
    </section>

    <div className="role-workspace-layout doctor-layout">
      <aside className="workspace-queue panel" aria-label={_t("Doctor case queue")}>
        <div className="workspace-panel-heading"><div><span className="workspace-overline">{_t("YOUR ORGANIZATION")}</span><h2>{_t("Case queue")}</h2></div><span className="workspace-count">{filtered.length}</span></div>
        <p className="workspace-helper">{_t("Only cases routed to your organization are shown. Unassigned cases reveal limited details until claimed.")}</p>
        <form className="workspace-lookup" onSubmit={(event) => { event.preventDefault(); onLookup(token) }}>
          <label htmlFor="doctor-case-token">{_t("Find a case by patient token")}</label><div><input id="doctor-case-token" className="input" placeholder={_t("NIDAN-AB12CD34")} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" spellCheck={false} /><button className="btn dark" type="submit" disabled={busy || !token.trim()}>{_t("Find")}</button></div>
        </form>
        <label className="workspace-search-label" htmlFor="doctor-case-search">{_t("Search queue")}</label><input id="doctor-case-search" className="input workspace-search" placeholder={_t("Name, concern or token")} value={query} onChange={(event) => setQuery(event.target.value)} />
        <FilterBar value={filter} onChange={setFilter} options={[{ id: 'ALL', label: _t('All') }, { id: 'WAITING', label: _t('Waiting') }, { id: 'URGENT', label: _t('Urgent') }]} />
        <div className="workspace-case-list">
          {filtered.map((item) => <button type="button" key={item.id} aria-pressed={selected?.id === item.id} className={`workspace-case-item ${selected?.id === item.id ? 'is-selected' : ''} ${isUrgent(item) ? 'is-urgent' : ''}`} onClick={() => onSelect(item)}>
            <span className="case-item-top"><strong>{item.patient?.fullName ?? `Case ${item.id.slice(0, 8)}`}</strong><span className={isUrgent(item) ? 'case-priority priority-urgent' : 'case-priority'}>{isUrgent(item) ? _t("Urgent flag") : _t("Routine")}</span></span>
            <span className="case-item-concern">{symptomLabel(item.symptomKey, language, _t)}{item.concern ? ` · ${item.concern}` : ''}</span>
            <span className="case-item-bottom"><span>{item.queueToken ?? _t(readable(item.status))}</span><time dateTime={item.submittedAt}>{dateLabel(item.submittedAt, language)}</time></span>
          </button>)}
          {filtered.length === 0 && <div className="workspace-empty-queue"><strong>{_t("No matching cases")}</strong><span>{_t("Try another search or queue filter.")}</span></div>}
        </div>
      </aside>

      <section className="workspace-case-panel panel" aria-label={_t("Selected case review")}>
        {!selected ? <div className="workspace-empty"><span className="empty-mark">N</span><span className="workspace-overline">{_t("CLINICIAN REVIEW")}</span><h2>{_t("Select a case to begin")}</h2><p>{_t("Choose an authorized case from your organization’s queue or look it up by the patient token.")}</p>{!organization && <p className="note-box warn"><b>{_t("Organization required.")}</b> {_t("Ask an administrator to assign your doctor account before cases can be routed.")}</p>}</div> : <>
          <div className="case-detail-head"><div><span className="workspace-overline">{_t("PATIENT VISIT ·")} {languageByCode(selected.language).nativeName} ({languageByCode(selected.language).name})</span><h2>{selected.patient?.fullName ?? _t('Unassigned case')}</h2><p>{selected.queueToken ?? `${_t('Case')} ${selected.id.slice(0, 8)}`} {_t("· Submitted")}{" "}{dateLabel(selected.submittedAt, language)}</p></div><div className="case-head-badges"><span className="case-state-badge">{_t(readable(selected.status))}</span>{isUrgent(selected) && <span className="case-state-badge urgent-badge">{_t("Urgent rule flag")}</span>}</div></div>
          <div className="case-meta-strip"><span><small>{_t("INTAKE STATUS")}</small><b>{_t(readable(selected.status))}</b></span><span><small>{_t("STAFF TRIAGE")}</small><b>{_t(readable(selected.triageStatus ?? 'PENDING'))}</b></span><span><small>{_t("CONSULTATION")}</small><b>{_t(readable(selected.consultationType))}</b></span></div>
          {selected.triageNotes && <div className="handoff-note"><span className="workspace-overline">{_t("STAFF HANDOFF")}</span><p>{selected.triageNotes}</p>{selected.triagedAt && <small>{_t("Updated")}{" "}{dateLabel(selected.triagedAt, language)}</small>}</div>}
          {selected.assignedDoctorId !== user?.id ? <div className="claim-card"><div><strong>{_t("This case has limited visibility.")}</strong><p>{_t("Claim it to review the patient’s complete authorized record.")}</p></div><button className="btn dark" disabled={busy} onClick={() => onClaim(selected)}>{_t("Claim case")}</button></div> : <>
            <section className="clinical-section"><div className="section-title-row"><div><span className="workspace-overline">{_t("PATIENT-REPORTED")}</span><h3>{_t("Visit concern")}</h3></div><span className="case-state-badge">{selected.symptomKey ? symptomLabel(selected.symptomKey, language, _t) : _t("General intake")}</span></div><p className="visit-concern">{selected.concern || _t('No written concern supplied.')}</p></section>
            <section className="clinical-section"><div className="section-title-row"><div><span className="workspace-overline">{_t("REVIEW CONTEXT")}</span><h3>{_t("Safety findings")}</h3></div><span className="case-state-badge">{_t("Draft rules")}</span></div>
              {(selected.safetyFindings ?? []).length ? <div className="finding-list">{selected.safetyFindings!.map((finding) => <article key={finding.id} className={finding.tier === 'urgent' ? 'finding-card finding-urgent' : 'finding-card'}><strong>{_t(readable(finding.tier))} · {_t(finding.label)}</strong><span>{_t("Matched patient wording: “")}{finding.evidence}”</span></article>)}</div> : <p className="workspace-helper">{_t("No configured rule matched. Absence of a rule match does not rule out an emergency.")}</p>}
            </section>
            {selected.patient?.medicalHistory && <details className="workspace-disclosure"><summary>{_t("Patient-reported medical history")}</summary><div className="history-list">{Object.entries(selected.patient.medicalHistory).filter(([, value]) => value).map(([key, value]) => <p key={key}><b>{_t(readable(key))}</b><span>{value}</span></p>)}</div></details>}
            <details className="workspace-disclosure"><summary>{_t("Intake answers and report evidence")}</summary><div className="answer-block"><h4>{_t("Patient answers")}</h4><AnswerList answers={selected.answers} symptomKey={selected.symptomKey} /></div><div className="answer-block"><h4>{_t("Uploaded documents")}</h4>{selected.documents?.length ? selected.documents.map((document) => <article className="document-row" key={document.id}><div><strong>{document.originalName}</strong><span>{_t("File status:")}{" "}{_t(readable(document.status))} {_t("· OCR source:")}{" "}{_t(readable(document.ocrMethod ?? 'unknown'))}{document.ocrConfidence != null ? ` · ${Math.round(document.ocrConfidence * 100)}% ${_t('confidence')}` : ''}</span>{document.ocrText && <><p className={document.confirmedAt ? 'ocr-verification is-confirmed' : 'ocr-verification is-unverified'}><b>{document.confirmedAt ? _t("Patient-confirmed OCR text") : _t("Unverified OCR preview")}</b>{!document.confirmedAt && ` — ${_t('compare with the original before use.')}`}</p><pre className="pre">{document.ocrText}</pre></>}</div><a href={`/api/documents/${document.id}/file`} className="btn small">{_t("Open original")}</a></article>) : <p className="workspace-helper">{_t("No documents attached to this case.")}</p>}</div></details>
            <section className="ai-review-card"><div className="section-title-row"><div><span className="workspace-overline">{_t("OPTIONAL ASSISTANCE")}</span><h3>{_t("Structured review draft")}</h3></div><span className="case-state-badge draft-badge">{_t("Verify before use")}</span></div><p>{_t("Any AI or rule-based output is informational, non-diagnostic, and must be checked against the original patient information.")}</p><button type="button" className="btn dark" disabled={busy} onClick={onGenerateReview}>{_t("Generate review draft")}</button>
              {clinicalReview && <div className="ai-review-output"><p><b>{_t(clinicalReview.triage.label)}</b> · {clinicalReview.method === 'gemini' ? _t("AI-generated draft") : _t("Rule-based draft")} · {_t(clinicalReview.primarySymptom)}</p><p>{clinicalReview.translatedSummary}</p><h4>{_t("SOAP draft")}</h4><p><b>{_t("Subjective:")}</b> {clinicalReview.soap.subjective}</p><p><b>{_t("Objective:")}</b> {clinicalReview.soap.objective}</p><p><b>{_t("Assessment:")}</b> {clinicalReview.soap.assessment}</p><p><b>{_t("Plan:")}</b> {clinicalReview.soap.plan}</p>{clinicalReview.missingInformation.length > 0 && <p><b>{_t("Information to clarify:")}</b> {clinicalReview.missingInformation.map((item) => _t(item)).join('; ')}</p>}</div>}
            </section>
            <section className="clinician-note-card"><div><span className="workspace-overline">{_t("DOCTOR-ENTERED")}</span><h3>{_t("Clinical review notes")}</h3></div><label htmlFor="doctor-review-notes">{_t("Your notes")}<textarea id="doctor-review-notes" className="input" rows={5} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={_t("Record your review for this case")} /></label><div className="review-action-row"><button type="button" className="btn" onClick={() => window.print()}>{_t("Print case summary")}</button><button type="button" className="btn dark" disabled={busy} onClick={onSaveReview}>{_t("Save review")}</button></div></section>
          </>}
        </>}
      </section>
    </div>
    {fail && <p className="form-error" role="alert">{_t(fail)}</p>}{msg && <p className="note-box ok" role="status">{_t(msg)}</p>}
  </div>
}

export interface StaffWorkspaceProps {
  cases: TriageCase[]
  organizations: CareOrganization[]
  selected: TriageCase | null
  notes: string
  setNotes: (value: string) => void
  organizationId: string
  setOrganizationId: (value: string) => void
  busy: boolean
  fail: string
  msg: string
  onSelect: (item: TriageCase) => void
  onUpdate: (action: 'TRIAGE' | 'REFER') => void
  onRefresh: () => void
}

export function StaffWorkspace(props: StaffWorkspaceProps) {
  const _t = useLocaleText();
  const { language } = useLocale()
  const { cases, organizations, selected, notes, setNotes, organizationId, setOrganizationId, busy, fail, msg, onSelect, onUpdate, onRefresh } = props
  const [query, setQuery] = useState('')
  const [dashboardMsg, setDashboardMsg] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'TRIAGED' | 'REFERRED'>('ALL')
  const urgent = cases.filter(isUrgent).length
  const pending = cases.filter((item) => (item.triageStatus ?? 'PENDING') === 'PENDING').length
  const filtered = useMemo(() => cases
    .filter((item) => `${item.patient.fullName} ${item.concern ?? ''} ${item.symptomKey ?? ''} ${item.status} ${item.triageStatus ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .filter((item) => filter === 'ALL' || (item.triageStatus ?? 'PENDING') === filter)
    .sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a))), [cases, filter, query])

  return <div className="role-workspace staff-workspace">
    <section className="role-hero staff-hero-new">
      <div className="role-hero-copy"><span className="role-eyebrow"><span className="role-eyebrow-dot" /> {_t("STAFF · TRIAGE OPERATIONS")}</span>
        <h1>{_t("Review first. Route with clarity.")}</h1>
        <p>{_t("Scan new intakes, record a concise handoff, and direct each case to the right care organization. Urgency flags are server-derived draft rules—not a diagnosis.")}</p>
      </div>
      <div className="role-hero-context"><span>{_t("TRIAGE DESK")}</span><strong>{pending} {_t("awaiting triage")}</strong><small>{urgent} {_t("active case")}{urgent === 1 ? '' : 's'} {_t("with urgent rule flags")}</small><button type="button" className="role-refresh" onClick={onRefresh} disabled={busy}>↻ <span>{_t("Refresh queue")}</span></button></div>
    </section>

    <section className="workspace-metrics staff-metrics" aria-label={_t("Staff triage overview")}>
      <Metric value={cases.length} label={_t('Cases visible')} />
      <Metric value={pending} label={_t('Awaiting triage')} tone="metric-warm" />
      <Metric value={urgent} label={_t('Urgent rule flags')} tone={urgent ? 'metric-alert' : ''} />
      <Metric value={cases.filter((item) => item.triageStatus === 'REFERRED').length} label={_t('Referred')} tone="metric-calm" />
    </section>

    <div className="role-workspace-layout staff-layout">
      <aside className="workspace-queue panel" aria-label={_t("Staff triage queue")}>
        <div className="workspace-panel-heading"><div><span className="workspace-overline">{_t("INTAKE OPERATIONS")}</span><h2>{_t("Review queue")}</h2></div><span className="workspace-count">{filtered.length}</span></div>
        <p className="workspace-helper">{_t("Urgent flags sort to the top. Staff review uses the triage summary and does not expose report-file blobs.")}</p>
        <label className="workspace-search-label" htmlFor="staff-case-search">{_t("Find a patient or intake")}</label><input id="staff-case-search" className="input workspace-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={_t("Name, symptom or status")} />
        <FilterBar value={filter} onChange={setFilter} options={[{ id: 'ALL', label: _t('All cases') }, { id: 'PENDING', label: _t('Pending') }, { id: 'TRIAGED', label: _t('Triaged') }, { id: 'REFERRED', label: _t('Referred') }]} />
        <div className="workspace-case-list">
          {filtered.map((item) => <button type="button" key={item.id} aria-pressed={selected?.id === item.id} className={`workspace-case-item ${selected?.id === item.id ? 'is-selected' : ''} ${isUrgent(item) ? 'is-urgent' : ''}`} onClick={() => onSelect(item)}>
            <span className="case-item-top"><strong>{item.patient.fullName}</strong><span className={isUrgent(item) ? 'case-priority priority-urgent' : 'case-priority'}>{isUrgent(item) ? _t("Urgent") : _t(readable(item.triageStatus ?? 'PENDING'))}</span></span>
            <span className="case-item-concern">{symptomLabel(item.symptomKey, language, _t)} · {item.concern || _t('No written concern')}</span>
            <span className="case-item-bottom"><span>{item.queueToken ?? _t('No token')} · {item.organization?.name ?? _t('Not routed')}</span><time dateTime={item.submittedAt}>{dateLabel(item.submittedAt, language)}</time></span>
          </button>)}
          {filtered.length === 0 && <div className="workspace-empty-queue"><strong>{_t("No matching intakes")}</strong><span>{_t("Try a different search or review filter.")}</span></div>}
        </div>
      </aside>

      <section className="workspace-case-panel panel staff-review-panel" aria-label={_t("Staff case review")}>
        {!selected ? <div className="workspace-empty"><span className="empty-mark staff-mark">S</span><span className="workspace-overline">{_t("TRIAGE REVIEW")}</span><h2>{_t("Select an intake")}</h2><p>{_t("Choose a case to review its patient-reported concern, server-derived flags, triage notes and routing status.")}</p></div> : <>
          <div className="case-detail-head"><div><span className="workspace-overline">{_t("STAFF REVIEW ·")} {languageByCode(selected.patient.preferredLanguage).nativeName} ({languageByCode(selected.patient.preferredLanguage).name})</span><h2>{selected.patient.fullName}</h2><p>{selected.queueToken ?? `${_t('Case')} ${selected.id.slice(0, 8)}`} · {selected.patient.ageYears == null ? _t("Age not recorded") : `${selected.patient.ageYears} ${_t('years')}`} · {dateLabel(selected.submittedAt, language)}</p></div><div className="case-head-badges"><span className="case-state-badge">{_t(readable(selected.triageStatus ?? 'PENDING'))}</span>{isUrgent(selected) && <span className="case-state-badge urgent-badge">{_t("Urgent rule flag")}</span>}</div></div>
          <section className="staff-intake-summary"><span className="workspace-overline">{_t("PATIENT-REPORTED SUMMARY")}</span><h3>{symptomLabel(selected.symptomKey, language, _t)}</h3><p>{selected.concern || _t('No written concern supplied.')}</p><div className="summary-meta"><span>{_t("Visit status")}{" "}<b>{_t(readable(selected.status))}</b></span><span>{_t("Care organization")}{" "}<b>{selected.organization?.name ?? _t('Not routed')}</b></span></div></section>
          <section className="clinical-section"><div className="section-title-row"><div><span className="workspace-overline">{_t("SERVER-DERIVED FLAGS")}</span><h3>{_t("Urgency review")}</h3></div><span className="case-state-badge">{_t("Draft rules")}</span></div>{(selected.safetyFindings ?? []).length ? <div className="finding-list">{selected.safetyFindings!.map((finding) => <article key={finding.id} className={finding.tier === 'urgent' ? 'finding-card finding-urgent' : 'finding-card'}><strong>{_t(readable(finding.tier))} · {_t(finding.label)}</strong><span>{_t("Evidence from patient response: “")}{finding.evidence}”</span></article>)}</div> : <p className="workspace-helper">{_t("No configured rule matched. A missing flag does not rule out an emergency.")}</p>}</section>
          <details className="workspace-disclosure"><summary>{_t("Intake answers for triage")}</summary><AnswerList answers={selected.answers} symptomKey={selected.symptomKey} /></details>
          <section className="triage-action-card"><div><span className="workspace-overline">{_t("STAFF HANDOFF")}</span><h3>{_t("Notes and routing")}</h3><p>{_t("Record a brief operational handoff. The doctor receives the note with the case.")}</p></div>
            <label htmlFor="staff-triage-notes">{_t("Triage note")}<textarea id="staff-triage-notes" className="input" rows={4} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={_t("Add context for the care team")} /></label>
            <button type="button" className="btn dark" disabled={busy} onClick={() => onUpdate('TRIAGE')}>{selected.triageStatus === 'TRIAGED' ? _t("Save triage note") : _t("Mark triaged")}</button>
            <button type="button" className="btn dashboard-handoff-button" disabled={busy} onClick={() => { addToDashboard(selected); setDashboardMsg(_t('Added to the clinical dashboard for immediate doctor review.')) }}>{_t("Add to clinical dashboard")}</button>
            {dashboardMsg && <p className="note-box ok" role="status">{dashboardMsg}</p>}
            <label htmlFor="staff-referral-organization">{_t("Refer case to a doctor organization")}<select id="staff-referral-organization" className="input" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">{_t("Choose organization")}</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.kind}</option>)}</select></label>
            <button type="button" className="btn staff-referral-button" disabled={busy || !organizationId || Boolean(selected.assignedDoctorId)} onClick={() => onUpdate('REFER')}>{selected.triageStatus === 'REFERRED' ? _t("Update referral") : _t("Refer to doctor queue")}</button>
            {selected.assignedDoctorId && <p className="assigned-lock">{_t("This case is already claimed by a clinician and cannot be rerouted.")}</p>}
          </section>
          {selected.triagedAt && <p className="workspace-helper">{_t("Last triaged")}{" "}{dateLabel(selected.triagedAt, language)}.</p>}
        </>}
      </section>
    </div>
    {fail && <p className="form-error" role="alert">{_t(fail)}</p>}{msg && <p className="note-box ok" role="status">{_t(msg)}</p>}
  </div>
}
