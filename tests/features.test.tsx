import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { heard } from './setup'
import { loadAlerts } from '../src/lib/alerts'
import { lock, setupVault } from '../src/lib/vault'
import { listSaved } from '../src/lib/store'
import { auditIdle, readAudit } from '../src/lib/audit'
import { axe } from './axe'

afterEach(() => { cleanup(); window.location.hash = '' })
beforeEach(async () => { await auditIdle(); lock() })
const K = (p: object = {}) => render(<App initial={{ lang: 'en-IN', voiceOptIn: 'yes', ...p }} />)
const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Save registration)/ }))

describe('privacy: voice only after the patient is told where audio goes', () => {
  it('asks first, declining keeps the mic off', async () => {
    K({ step: 'patient', voiceOptIn: '' })
    fireEvent.click(document.getElementById('f-name')!.closest('.vfield')!.querySelector('.mic-btn') as HTMLElement)
    expect(await screen.findByText(/Google for Chrome, Microsoft for Edge/)).toBeTruthy()
    fireEvent.click(screen.getByText('Typing only')); expect(screen.queryByText(/I heard:/)).toBeNull()
    fireEvent.click(document.getElementById('f-name')!.closest('.vfield')!.querySelector('.mic-btn') as HTMLElement); expect(await screen.findByText('Allow voice')).toBeTruthy()
  })
})
describe('separate AI-processing consent', () => {
  it('defaults to off and does not block care when declined', async () => {
    K({ step: 'consent', consent: true, aiProcessing: false })
    const choice = screen.getByRole('checkbox', { name: /Optional: I agree to let this hospital/i })
    expect((choice as HTMLInputElement).checked).toBe(false)
    next()
    expect(await screen.findByRole('heading', { level: 1, name: /consultation/i })).toBeTruthy()
  })
})
describe('child / proxy / pregnancy / guardian', () => {
  it('requires the relation when answering for someone else, and months for infants', async () => {
    K({ step: 'patient' }); fireEvent.click(screen.getByRole('radio', { name: /New patient/ })); fireEvent.click(screen.getByText('I am answering for my child'))
    fireEvent.change(document.getElementById('f-name')!, { target: { value: 'Baby Rao' } }); fireEvent.change(document.getElementById('f-age')!, { target: { value: '40' } }); fireEvent.click(screen.getByRole('button', { name: 'months' }))
    fireEvent.click(screen.getByRole('button', { name: 'Male' })); next(); expect((await screen.findAllByText(/relation to the patient/i)).length).toBeGreaterThan(1)
    fireEvent.change(document.getElementById('f-rel')!, { target: { value: 'mother' } }); next(); expect((await screen.findAllByText(/months between 0 and 35/)).length).toBeGreaterThan(0)
  })
  it('guardian confirmation is required for a minor', () => {
    K({ step: 'consent', profile: { name: 'Kid', age: '9', ageUnit: 'years', sex: 'male', phone: '', abha: '', type: 'new', forWho: 'child', relation: 'father', pregnant: '' } })
    fireEvent.click(screen.getByLabelText(/I understand and agree/)); next(); expect(screen.getByText(/confirm you are the guardian/i)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/parent \/ legal guardian/)); next(); expect(screen.getByRole('heading', { level: 1, name: /consultation/i })).toBeTruthy()
  })
})
describe('red flag → alert → patient sees status; negation does not alarm', () => {
  it('“no chest pain” raises nothing', () => { K({ step: 'concern', concern: 'no chest pain, just mild fever' }); expect(loadAlerts()).toHaveLength(0); expect(document.querySelector('.emergency')).toBeNull() })
  it('“seene mein dard” raises a token-based alert without the name, and the patient is told what happened', async () => {
    K({ step: 'concern', concern: 'seene mein dard ho raha hai', profile: { name: 'Ramesh Kale', age: '58', ageUnit: 'years', sex: 'male', phone: '', abha: '', type: 'new', forWho: 'self', relation: '', pregnant: '' } })
    await waitFor(() => expect(loadAlerts()).toHaveLength(1))
    const a = loadAlerts()[0]; expect(a.token).toMatch(/^U-\d+/); expect(JSON.stringify(a)).not.toContain('Ramesh'); expect(a.flags[0].id).toBe('chest_pain')
    expect(await screen.findByText(/alert is on the staff screen/i)).toBeTruthy(); expect(readAudit().length).toBeGreaterThan(0)
  })
  it('infant fever is urgent; the same words for an adult are not', async () => {
    K({ step: 'concern', concern: 'fever since last night', profile: { name: 'B', age: '5', ageUnit: 'months', sex: 'female', phone: '', abha: '', type: 'new', forWho: 'child', relation: 'mother', pregnant: '' } })
    await waitFor(() => expect(loadAlerts().some((a) => a.flags.some((f) => f.id === 'infant_fever'))).toBe(true))
  })
})
describe('staff area: no default PIN, encrypted hand-over, audit', () => {
  it('forces setup, then shows alerts after sign-in; kiosk data is saved sealed', async () => {
    window.location.hash = '#/staff'; render(<App />)
    expect(await screen.findByText(/no default PIN/i)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Passphrase'), { target: { value: 'correct horse battery' } }); fireEvent.change(screen.getByPlaceholderText('Repeat passphrase'), { target: { value: 'correct horse battery' } }); fireEvent.click(screen.getByText('Create'))
    expect(await screen.findByText(/DRAFT clinical content/)).toBeTruthy(); expect(screen.getByText('No open urgent alerts.')).toBeTruthy()
  })
  it('hand-over after setup is encrypted and listed only after unlock', async () => {
    await setupVault('correct horse battery'); lock(); window.location.hash = ''
    K({ step: 'summary', concern: 'mild cough', profile: { name: 'Meera Joshi', age: '30', ageUnit: 'years', sex: 'female', phone: '', abha: '', type: 'new', forWho: 'self', relation: '', pregnant: 'no' } })
    next(); await waitFor(() => expect(localStorage.getItem('nidan-saved-v3')).toBeTruthy())
    expect(localStorage.getItem('nidan-saved-v3')).not.toContain('Meera'); expect(await listSaved()).toHaveLength(0)   // locked: cannot read
    const { unlock } = await import('../src/lib/vault'); await unlock('correct horse battery'); expect((await listSaved())[0].profile.name).toBe('Meera Joshi')
    expect(screen.getAllByText(/handed to the care team/i).length).toBeGreaterThan(0)
  })
  it('patient can delete their data', async () => {
    await setupVault('correct horse battery'); lock()
    K({ step: 'review', profile: { name: 'Del Me', age: '30', ageUnit: 'years', sex: 'male', phone: '', abha: '', type: 'new', forWho: 'self', relation: '', pregnant: '' } })
    await waitFor(() => expect(localStorage.getItem('nidan-saved-v3')).toBeTruthy()); const { unlock } = await import('../src/lib/vault'); await unlock('correct horse battery'); expect(await listSaved()).toHaveLength(1)
    next(); fireEvent.click(await screen.findByText(/Delete my data now/))
    expect(await screen.findByText(/Your data was deleted/)).toBeTruthy(); expect(await listSaved()).toHaveLength(0); await auditIdle(); expect(readAudit().some((e) => e.action === 'session_deleted_by_patient')).toBe(true)
  })
})
describe('self-test and about pages render; accessibility (axe) has no serious violations', () => {
  it('self-test lists checks', async () => { window.location.hash = '#/selftest'; render(<App />); fireEvent.click(screen.getByText('Run checks')); expect(await screen.findByText(/Secure context/)).toBeTruthy() })
  it('about page states what is simulated', () => { window.location.hash = '#/about'; render(<App />); expect(screen.getByText(/not yet reviewed by a clinician/)).toBeTruthy() })
  for (const step of ['welcome', 'language', 'patient', 'consent', 'concern', 'questions', 'reports'] as const) {
    it(`axe: ${step}`, async () => { const { container } = K({ step, symptom: 'fever', concern: 'fever', consent: true }); const v = await axe(container); expect(v.map((x) => `${x.id}: ${x.help}`)).toEqual([]) })
  }
})
void heard; void within; void vi
