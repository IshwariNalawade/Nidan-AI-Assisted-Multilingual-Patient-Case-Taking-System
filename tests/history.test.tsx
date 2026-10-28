import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import locales from '../src/locales.json'
import App from '../src/App'
import { dict, makeUi, uiTier } from '../src/i18n'
import { newSession, type Session } from '../src/model'
import { patientKey } from '../src/lib/pid'
import { emptyRecord, getRecord, mergeVisit, saveRecord } from '../src/lib/patients'
import { deidentified, researchSet, scrubText } from '../src/lib/localai'
import { flushOutbox, pendingOutbox, pushBlob, dropBlob } from '../src/lib/sync'
import { assessSession, questionQueue } from '../src/lib/report'
import { lock, setupVault, unlock } from '../src/lib/vault'
import { saveSession } from '../src/lib/store'
import { auditIdle } from '../src/lib/audit'

const LOC = locales as Record<string, Record<string, string>>
const SCRIPT: Record<string, RegExp> = { bn: /[\u0980-\u09FF]/, as: /[\u0980-\u09FF]/, ta: /[\u0B80-\u0BFF]/, te: /[\u0C00-\u0C7F]/, gu: /[\u0A80-\u0AFF]/, kn: /[\u0C80-\u0CFF]/, ml: /[\u0D00-\u0D7F]/, pa: /[\u0A00-\u0A7F]/, or: /[\u0B00-\u0B7F]/, ur: /[\u0600-\u06FF]/, ne: /[\u0900-\u097F]/ }
afterEach(() => { cleanup(); window.location.hash = ''; vi.unstubAllEnvs(); vi.unstubAllGlobals() })
beforeEach(async () => { await auditIdle(); lock() })
const base = (p: Partial<Session> = {}): Session => ({ ...newSession(), lang: 'en-IN', voiceOptIn: 'yes', ...p, profile: { ...newSession().profile, name: 'Ramesh Kale', age: '58', sex: 'male', phone: '9876543210', abha: 'ABHA-DEMO-DEMO-042', type: 'new', ...(p.profile ?? {}) } })

describe('languages: translated UI plus honestly labelled proxy/draft coverage', () => {
  it('has at least the 85 core keys for every language, each in the right script, placeholders intact', () => {
    for (const [l, d] of Object.entries(LOC)) { expect(Object.keys(d).length, l).toBeGreaterThanOrEqual(85); for (const [k, v] of Object.entries(d)) { expect(v.trim(), `${l}.${k}`).not.toBe(''); expect(SCRIPT[l].test(v), `${l}.${k} script`).toBe(true) } expect(d.emBody).toContain('{x}') }
  })
  it('every translated key has an English source', () => { for (const k of Object.keys(LOC.bn)) expect(dict[k], k).toBeTruthy() })
  it('tiers: only reviewed languages are full; draft locales and related-language proxies are draft', () => { expect(uiTier('mr-IN')).toBe('draft'); expect(uiTier('ta-IN')).toBe('draft'); expect(uiTier('ks-IN')).toBe('draft'); expect(uiTier('sat-IN')).toBe('draft') })
  it('makeUi uses the translated value for a covered key and falls back only when absent', () => { const ui = makeUi('ta-IN'); expect(ui('next')).toBe('அடுத்து'); expect(ui('stepOf', { a: 1, b: 16 })).toBe('16-இல் 1') })
  it('Urdu renders right-to-left with translated buttons', () => { localStorage.clear(); render(<App initial={{ lang: 'ur-IN', step: 'consent', voiceOptIn: 'yes' }} />); expect(document.documentElement.dir).toBe('rtl'); expect(screen.getByText('آگے')).toBeTruthy() })
})

describe('returning patient: “how are you feeling now?”, only what changed', () => {
  it('asks how they feel, and the queue is the short one', () => {
    const s = base({ step: 'concern', profile: { type: 'returning' } as Session['profile'], symptom: 'fever' }); const q = questionQueue(s, makeUi('en-IN')).map((x) => x.id)
    expect(q[0]).toBe('changed'); expect(q).not.toContain('hist_prev'); expect(q.length).toBeLessThan(questionQueue({ ...s, profile: { ...s.profile, type: 'new' } }, makeUi('en-IN')).length)
    render(<App initial={s} />); expect(screen.getAllByText('How are you feeling now?').length).toBeGreaterThan(0); fireEvent.click(screen.getByRole('radio', { name: 'Worse' }))
    expect(screen.getByRole('radio', { name: 'Worse' }).getAttribute('aria-checked')).toBe('true')
  })
  it('“Worse” goes to staff as a review item (not a false emergency)', () => { const r = assessSession(base({ answers: { feeling_now: 'Worse' } })); expect(r.review.map((f) => f.id)).toContain('feeling_worse'); expect(r.urgent).toEqual([]) })
  it('Next is blocked until they say how they feel', async () => { render(<App initial={base({ step: 'concern', profile: { type: 'returning' } as Session['profile'] })} />); fireEvent.click(screen.getByRole('button', { name: /^Next/ })); expect((await screen.findAllByText(/choose an option/i)).length).toBeGreaterThan(0) })
})

describe('patient key + staff-owned history', () => {
  it('same phone → same key, different phone → different key, key does not contain the number', async () => {
    const a = await patientKey('98765 43210'), b = await patientKey('9876543210'), c = await patientKey('9876543211'); expect(a).toBe(b); expect(a).not.toBe(c); expect(a).not.toContain('9876'); expect(await patientKey('', '')).toBe('')
  })
  it('master history is encrypted, survives lock/unlock, and merge de-duplicates', async () => {
    await setupVault('correct horse battery'); const pid = await patientKey('9876543210'); await saveRecord({ ...emptyRecord(pid, 'Ramesh Kale', '9876543210'), chronic: 'Type 2 diabetes', meds: 'Metformin 500' })
    expect(localStorage.getItem('nidan-patients-v1')).not.toContain('Ramesh'); lock(); expect(await getRecord(pid)).toBeNull(); await unlock('correct horse battery')
    const r = (await getRecord(pid))!; expect(r.chronic).toBe('Type 2 diabetes'); const m = mergeVisit(mergeVisit(r, { meds: 'Atorvastatin 10' }), { meds: 'atorvastatin 10', allergy: 'Penicillin' }); expect(m.meds).toBe('Metformin 500; Atorvastatin 10'); expect(m.allergies).toBe('Penicillin')
  })
  it('staff board shows earlier visits of the same patient and saves history', async () => {
    await setupVault('correct horse battery'); const pid = await patientKey('9876543210')
    await saveSession({ ...base({ id: 'v1', startedAt: '2026-09-01T10:00:00Z', concern: 'cough last month', token: 'T-001' }), pid }); await saveSession({ ...base({ id: 'v2', startedAt: '2026-10-10T10:00:00Z', concern: 'fever now', token: 'T-002' }), pid })
    lock(); window.location.hash = '#/staff'; render(<App />); fireEvent.change(screen.getByPlaceholderText('Passphrase'), { target: { value: 'correct horse battery' } }); fireEvent.click(screen.getByText('Sign in'))
    fireEvent.click(await screen.findByRole('tab', { name: 'Doctor dashboard' })); fireEvent.click((await screen.findAllByText('fever now', { exact: false }))[0].closest('button')!)
    expect(await screen.findByText(/1 earlier visit/)).toBeTruthy(); expect((await screen.findAllByText(/cough last month/)).length).toBeGreaterThan(0)
    fireEvent.change(await screen.findByLabelText('Long-term conditions'), { target: { value: 'Hypertension' } }); fireEvent.click(screen.getByText('Save history')); expect(await screen.findByText(/History saved \(encrypted\)/)).toBeTruthy()
  })
})

describe('hospital-local AI + research use: privacy by construction', () => {
  it('de-identified text has the patient’s words but not name, phone, ABHA id, token', () => {
    const s = base({ concern: 'Ramesh Kale has fever, call 98765 43210', token: 'T-009', answers: { hist_meds: 'Ramesh takes Metformin' } }); const t = deidentified(s)
    for (const bad of ['Ramesh', 'Kale', '98765', 'ABHA', 'T-009']) expect(t).not.toContain(bad); expect(t).toMatch(/fever/); expect(t).toMatch(/Metformin/)
  })
  it('scrubText removes phones, Aadhaar-like ids, e-mail', () => expect(scrubText('call +91 98765 43210 or a@b.in, id 1234 5678 9012')).toBe('call [PHONE] or [EMAIL], id [ID]'))
  it('research export includes ONLY patients who ticked the separate consent, with no identifiers', () => {
    const yes = base({ id: 'a', concern: 'Ramesh has cough', consentLog: { at: '', version: 'v', lang: 'en-IN', by: 'self', textHash: '', voice: 'yes', research: true } }), no = base({ id: 'b', concern: 'private', consentLog: { at: '', version: 'v', lang: 'en-IN', by: 'self', textHash: '', voice: 'yes', research: false } })
    const rows = researchSet([yes, no]); expect(rows).toHaveLength(1); const j = JSON.stringify(rows); for (const bad of ['Ramesh', '9876543210', 'ABHA', 'private', '"a"']) expect(j).not.toContain(bad); expect(rows[0].month).toBe(yes.startedAt.slice(0, 7))
  })
  it('hub push queues when offline and retries; deletion removes it', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://hub.local:8787'); const fx = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fx)
    const blob = { e: {} as JsonWebKey, i: 'x', c: 'CIPHER' }; expect(await pushBlob('sessions', { id: 's1', at: 'now', blob })).toBe(false); expect(pendingOutbox()).toBe(1); expect(fx.mock.calls[0][0]).toContain('/api/blobs/sessions/s1'); expect(fx.mock.calls[0][1].body).not.toMatch(/Ramesh/)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })); await flushOutbox(); expect(pendingOutbox()).toBe(0); await dropBlob('sessions', 's1'); expect(pendingOutbox()).toBe(0)
  })
})
