import { useEffect, useState } from 'react'
import { LocaleSelector, PrototypeNotice, useLocaleText } from './LocaleProvider'

type Role = 'patient' | 'doctor' | 'staff'

type Request = { role: Role; name: string; email: string; organization: string; credential: string; at: string }
const REQUEST_KEY = 'nidan.access.requests'

const readRequests = (): Request[] => {
  try { return JSON.parse(localStorage.getItem(REQUEST_KEY) ?? '[]') as Request[] } catch { return [] }
}

export default function AccessHub() {
  const _t = useLocaleText()
  const roleFromHash = (): Role => {
    const role = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('role')
    return role === 'doctor' || role === 'staff' || role === 'patient' ? role : 'patient'
  }
  const [role, setRole] = useState<Role>(roleFromHash)
  useEffect(() => { const sync = () => setRole(roleFromHash()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync) }, [])
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', organization: '', credential: '' })
  const roleCopy = {
    patient: { title: 'Patient account', eyebrow: 'PRIVATE PATIENT ACCESS', text: 'Create or sign in to a private patient account for saved intakes, reports and care information.', action: 'Continue to patient account', href: '#/account', fields: false },
    doctor: { title: 'Doctor registration', eyebrow: 'CLINICIAN ACCESS', text: 'Request a doctor account for organization-scoped clinical review. Doctor accounts are provisioned after verification.', action: 'Submit doctor registration request', href: '#/access?role=doctor', fields: true },
    staff: { title: 'Staff registration', eyebrow: 'TRIAGE STAFF ACCESS', text: 'Request staff access for emergency triage, patient handoff and routing to the doctor queue.', action: 'Submit staff registration request', href: '#/access?role=staff', fields: true },
  }[role]
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const next = [...readRequests(), { role, ...form, at: new Date().toISOString() }]
    localStorage.setItem(REQUEST_KEY, JSON.stringify(next.slice(-50)))
    setSubmitted(true)
  }
  return <div className="access-page"><PrototypeNotice /><header className="topbar access-top"><a className="brand" href="#/"><span className="logo" aria-hidden="true">N</span><span><b className="brand-name">{_t('NIDAN')}<i /></b><span className="mono tiny">{_t('ACCESS & REGISTRATION')}</span></span></a><div className="top-actions"><LocaleSelector /><a className="btn" href="#/">{_t('← Kiosk')}</a></div></header><main className="access-main"><section className="access-intro"><span className="badge green">{_t('ONE CLEAR ENTRY POINT')}</span><h1>{_t('Choose your NIDAN access')}</h1><p>{_t('Patients, doctors and triage staff use different secure paths. Select the role that matches you.')}</p></section><section className="access-cards" aria-label={_t('Registration options')}>
    {(['patient', 'doctor', 'staff'] as Role[]).map((item) => <button key={item} type="button" className={`access-card access-${item} ${role === item ? 'is-selected' : ''}`} onClick={() => { setRole(item); setSubmitted(false) }}><span className="access-icon">{item === 'patient' ? 'P' : item === 'doctor' ? 'D' : 'S'}</span><span className="access-overline">{_t(item === 'patient' ? 'PATIENT' : item === 'doctor' ? 'DOCTOR' : 'STAFF')}</span><strong>{_t(item === 'patient' ? 'Patient account' : item === 'doctor' ? 'Doctor registration' : 'Staff registration')}</strong><span>{_t(item === 'patient' ? 'Private care information and saved intakes.' : item === 'doctor' ? 'Clinical review and doctor queue access.' : 'Emergency triage and patient routing access.')}</span></button>)}
  </section><section className="access-form panel"><div className="access-form-heading"><span className="access-overline">{_t(roleCopy.eyebrow)}</span><h2>{_t(roleCopy.title)}</h2><p>{_t(roleCopy.text)}</p></div>{role === 'patient' ? <div className="access-actions"><a className="btn dark big" href="#/account">{_t('Create or sign in as patient')}</a><a className="btn" href="#/">{_t('Continue without an account')}</a></div> : submitted ? <div className="note-box ok"><strong>{_t('Registration request recorded')}</strong><p>{_t('This demo keeps doctor and staff registration separate from patient signup. An administrator must verify and provision the account before sign-in.')}</p><a className="btn" href="#/account">{_t('Go to secure sign in')}</a></div> : <form className="access-registration-form" onSubmit={submit}><label>{_t('Full name')}<input className="input" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>{_t('Work email')}<input className="input" type="email" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><label>{_t('Hospital / organization')}<input className="input" required maxLength={160} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></label><label>{_t(role === 'doctor' ? 'Medical registration / staff ID' : 'Staff ID / department')}<input className="input" required maxLength={120} value={form.credential} onChange={(e) => setForm({ ...form, credential: e.target.value })} /></label><button className="btn dark big" type="submit">{_t(roleCopy.action)}</button></form>}</section><section className="access-emergency"><strong>{_t('Emergency patient handoff')}</strong><span>{_t('A patient does not need an account during an emergency. Staff can use the separate staff access path to review, triage and add the case to the clinical dashboard.')}</span><a className="btn" href="#/staff-portal">{_t('Sign in as staff')}</a></section></main></div>
}
