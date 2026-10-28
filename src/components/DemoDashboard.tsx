import { useEffect, useMemo, useState } from 'react'
import { PrototypeNotice, useLocaleText } from './LocaleProvider'

type Status = 'Awaiting review' | 'In consultation' | 'Reviewed'
type Priority = 'Urgent' | 'Review' | 'Routine'

type DemoPatient = {
  id: string
  token: string
  name: string
  age: number
  sex: string
  language: string
  concern: string
  department: string
  priority: Priority
  status: Status
  arrived: string
  attendedBy: string
  summary: string
  findings: string[]
  notes: string
  nextStep: string
  lastUpdated: string
}

const initialPatients: DemoPatient[] = [
  { id: 'p1', token: 'U-1042', name: 'Anjali Patil', age: 42, sex: 'Female', language: 'मराठी', concern: 'Chest discomfort and breathlessness', department: 'General Medicine', priority: 'Urgent', status: 'In consultation', arrived: '09:14', attendedBy: 'Dr. Meera Shah', summary: 'Patient reports central chest discomfort beginning this morning with shortness of breath on walking. Red-flag rule matched; clinician review is in progress.', findings: ['Chest discomfort', 'Breathlessness on exertion', 'Started today'], notes: 'Vitals to be confirmed. Keep patient in monitored area while assessment continues.', nextStep: 'Complete clinician assessment and record vitals.', lastUpdated: '2 min ago' },
  { id: 'p2', token: 'NID-3187', name: 'Rohan Kulkarni', age: 28, sex: 'Male', language: 'हिन्दी', concern: 'Fever and body ache for two days', department: 'Family Medicine', priority: 'Review', status: 'Awaiting review', arrived: '09:21', attendedBy: 'Unassigned', summary: 'Patient-reported fever with generalized body ache. No urgent rule flag in the kiosk intake.', findings: ['Fever · 2 days', 'Body ache', 'No urgent flag'], notes: 'Review medication history and temperature before disposition.', nextStep: 'Assign clinician and confirm current medicines.', lastUpdated: '5 min ago' },
  { id: 'p3', token: 'NID-3186', name: 'Saira Khan', age: 35, sex: 'Female', language: 'English', concern: 'Recurring migraine and nausea', department: 'Outpatient Care', priority: 'Routine', status: 'Reviewed', arrived: '08:47', attendedBy: 'Dr. Arjun Rao', summary: 'Recurring headache pattern documented with patient-reported nausea. Doctor reviewed the intake and added follow-up guidance.', findings: ['Recurring migraine', 'Nausea', 'No safety alert'], notes: 'Discussed hydration, trigger log and planned outpatient follow-up.', nextStep: 'Follow-up recommended within seven days.', lastUpdated: '18 min ago' },
  { id: 'p4', token: 'NID-3185', name: 'Vikram Joshi', age: 61, sex: 'Male', language: 'मराठी', concern: 'Knee pain affecting mobility', department: 'Orthopaedics', priority: 'Review', status: 'Awaiting review', arrived: '09:28', attendedBy: 'Unassigned', summary: 'Patient reports worsening knee pain and difficulty climbing stairs. Uploaded report is waiting for clinician confirmation.', findings: ['Reduced mobility', 'Knee pain', 'Report uploaded'], notes: 'Open the original report before making a clinical decision.', nextStep: 'Review uploaded report and assess mobility.', lastUpdated: '1 min ago' },
  { id: 'p5', token: 'NID-3184', name: 'Neha Deshmukh', age: 19, sex: 'Female', language: 'English', concern: 'Seasonal allergy symptoms', department: 'Family Medicine', priority: 'Routine', status: 'Reviewed', arrived: '08:31', attendedBy: 'Dr. Meera Shah', summary: 'Patient-reported sneezing and itchy eyes consistent with a seasonal concern. Intake reviewed and closed by the doctor.', findings: ['Sneezing', 'Itchy eyes', 'No urgent flag'], notes: 'Patient advised to return if breathing difficulty develops.', nextStep: 'Routine advice provided.', lastUpdated: '34 min ago' },
]

const priorityClass = (p: Priority) => p === 'Urgent' ? 'urgent' : p === 'Review' ? 'review' : 'routine'
const DASHBOARD_HANDOFF_KEY = 'nidan.dashboard.handoffs'
const readHandoffs = (): DemoPatient[] => { try { return JSON.parse(localStorage.getItem(DASHBOARD_HANDOFF_KEY) ?? '[]') as DemoPatient[] } catch { return [] } }

export default function DemoDashboard() {
  const _t = useLocaleText()
  const [patients, setPatients] = useState<DemoPatient[]>(() => [...initialPatients, ...readHandoffs()])
  const [selectedId, setSelectedId] = useState('p1')
  const [filter, setFilter] = useState<'All' | Priority>('All')
  const [query, setQuery] = useState('')
  const [refreshed, setRefreshed] = useState('just now')
  const selected = patients.find((p) => p.id === selectedId) ?? patients[0]
  const shown = useMemo(() => patients.filter((p) => (filter === 'All' || p.priority === filter) && `${p.name} ${p.token} ${p.concern} ${p.department}`.toLowerCase().includes(query.toLowerCase())), [filter, patients, query])
  const counts = { total: patients.length, urgent: patients.filter((p) => p.priority === 'Urgent').length, waiting: patients.filter((p) => p.status === 'Awaiting review').length, reviewed: patients.filter((p) => p.status === 'Reviewed').length }
  const markReviewed = () => setPatients((current) => current.map((p) => p.id === selected.id ? { ...p, status: 'Reviewed', attendedBy: 'Dr. Meera Shah', lastUpdated: 'just now' } : p))
  useEffect(() => { const refresh = () => setPatients([...initialPatients, ...readHandoffs()]); window.addEventListener('nidan-dashboard-update', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('nidan-dashboard-update', refresh); window.removeEventListener('storage', refresh) } }, [])

  return <div className="dashboard-page"><PrototypeNotice /><header className="dashboard-topbar"><a className="dashboard-brand" href="#/"><span className="dashboard-mark">N</span><span><b>NIDAN<span className="dashboard-brand-dot">+</span></b><small>CLINICAL OPERATIONS</small></span></a><div className="dashboard-top-actions"><span className="dashboard-live"><i /> LIVE DEMO · FICTIONAL DATA</span><a className="btn" href="#/">← Kiosk</a><a className="btn dark" href="#/staff">Staff console</a></div></header><main className="dashboard-main">
    <section className="dashboard-hero"><div><span className="dashboard-eyebrow">PATIENT-FIRST CARE · COMMAND CENTER</span><h1>Good morning, care team.</h1><p>One calm view of today’s intake queue, clinician activity and patient-reported context.</p></div><div className="dashboard-date"><strong>Saturday, 24 October</strong><span>Last synced {refreshed}</span><button className="btn small" onClick={() => setRefreshed('just now')}>↻ Refresh board</button></div></section>
    <section className="dashboard-stats" aria-label="Dashboard overview"><div className="dashboard-stat"><span>Total intakes</span><strong>{counts.total}</strong><small>Today · all departments</small></div><div className="dashboard-stat stat-alert"><span>Urgent attention</span><strong>{counts.urgent}</strong><small>Priority queue</small></div><div className="dashboard-stat stat-wait"><span>Awaiting review</span><strong>{counts.waiting}</strong><small>Needs assignment</small></div><div className="dashboard-stat stat-good"><span>Doctor reviewed</span><strong>{counts.reviewed}</strong><small>Completed today</small></div></section>
    <section className="dashboard-grid"><div className="dashboard-queue panel"><div className="dashboard-section-head"><div><span className="dashboard-eyebrow">LIVE INTAKE QUEUE</span><h2>Patient board</h2></div><span className="dashboard-count">{shown.length} cases</span></div><div className="dashboard-controls"><input className="input" placeholder="Search patient, token or concern" value={query} onChange={(e) => setQuery(e.target.value)} /> <div className="dashboard-filters">{(['All', 'Urgent', 'Review', 'Routine'] as const).map((f) => <button key={f} className={'btn small' + (filter === f ? ' dark' : '')} onClick={() => setFilter(f)}>{f}</button>)}</div></div><div className="dashboard-case-list">{shown.map((patient) => <button key={patient.id} className={'dashboard-case ' + (patient.id === selected.id ? 'selected ' : '') + priorityClass(patient.priority)} onClick={() => setSelectedId(patient.id)}><span className="dashboard-case-avatar">{patient.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</span><span className="dashboard-case-copy"><span className="dashboard-case-line"><strong>{patient.name}</strong><em className={priorityClass(patient.priority)}>{patient.priority}</em></span><span>{patient.concern}</span><small>{patient.token} · {patient.department} · {patient.arrived}</small></span><span className={'dashboard-status ' + patient.status.toLowerCase().replace(' ', '-')}>{patient.status}</span></button>)}{!shown.length && <p className="status">No demo cases match this filter.</p>}</div></div>
      <div className="dashboard-detail panel"><div className="dashboard-detail-head"><div><span className="dashboard-eyebrow">PATIENT DETAIL · {selected.token}</span><h2>{selected.name}</h2><p>{selected.age} years · {selected.sex} · Preferred language: {selected.language}</p></div><span className={'dashboard-priority ' + priorityClass(selected.priority)}>{selected.priority} priority</span></div><div className="dashboard-detail-meta"><span>Arrived <b>{selected.arrived}</b></span><span>Department <b>{selected.department}</b></span><span>Attended by <b>{selected.attendedBy}</b></span></div><section className="dashboard-summary-card"><div className="dashboard-summary-icon">✦</div><div><span className="dashboard-eyebrow">DOCTOR-ATTENDED SUMMARY</span><p>{selected.summary}</p></div></section><div className="dashboard-two-col"><section><h3>Intake findings</h3><ul className="dashboard-findings">{selected.findings.map((finding) => <li key={finding}><span>✓</span>{finding}</li>)}</ul></section><section><h3>Next step</h3><p className="dashboard-next-step">{selected.nextStep}</p></section></div><section className="dashboard-note"><span className="dashboard-eyebrow">CLINICIAN NOTE</span><p>{selected.notes}</p></section><div className="dashboard-actions"><button className="btn" onClick={() => window.print()}>Print summary</button><button className="btn dark" onClick={markReviewed}>{selected.status === 'Reviewed' ? 'Reviewed ✓' : 'Mark as reviewed'}</button></div></div></section>
    <section className="dashboard-bottom"><div className="panel dashboard-activity"><div className="dashboard-section-head"><div><span className="dashboard-eyebrow">CARE TEAM ACTIVITY</span><h2>Recent updates</h2></div><span className="dashboard-live"><i /> Live</span></div><div className="dashboard-timeline"><div><span className="timeline-dot blue" /><p><b>Dr. Meera Shah</b> opened urgent case <strong>U-1042</strong><small>2 minutes ago · General Medicine</small></p></div><div><span className="timeline-dot green" /><p><b>Dr. Arjun Rao</b> completed review for <strong>NID-3187</strong><small>18 minutes ago · Outpatient Care</small></p></div><div><span className="timeline-dot amber" /><p><b>Report uploaded</b> for <strong>NID-3185</strong><small>31 minutes ago · Waiting for confirmation</small></p></div></div></div><div className="panel dashboard-departments"><span className="dashboard-eyebrow">DEPARTMENT LOAD</span><h2>Today at a glance</h2>{[['General Medicine', 68], ['Family Medicine', 44], ['Outpatient Care', 31]].map(([name, value]) => <div className="dashboard-bar-row" key={String(name)}><span>{name}</span><b>{value}%</b><i><em style={{ width: `${value}%` }} /></i></div>)}<p className="status">Demo metrics update as the queue changes.</p></div></section>
  </main></div>
}
