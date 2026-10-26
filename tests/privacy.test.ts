import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isUnlocked, lock, lockoutSeconds, open, seal, setupVault, unlock, vaultReady } from '../src/lib/vault'
import { auditIdle, log, readAudit, verifyAudit } from '../src/lib/audit'
import { listSaved, purgeOlderThan, removeSaved, saveSession } from '../src/lib/store'
import { acknowledge, dropPatientData, flushQueued, identity, loadAlerts, markLeft, raiseAlert } from '../src/lib/alerts'
import { mBegin, mEnd, mStep, mVoice, readMetrics, summarise } from '../src/lib/metrics'
import { newSession } from '../src/model'
const F = (id: string, tier: 'urgent' | 'review' = 'urgent') => ({ id, label: id, tier, evidence: 'x' })
beforeEach(async () => { await auditIdle(); localStorage.clear(); lock(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('vault: no default PIN, real encryption', () => {
  it('is not set up by default and rejects weak passphrases', async () => { expect(vaultReady()).toBe(false); await expect(setupVault('short')).rejects.toThrow() })
  it('kiosk can seal without being able to open; only the passphrase unlocks', async () => {
    await setupVault('correct horse battery'); const blob = await seal({ name: 'Anjali' }); lock()
    expect(JSON.stringify(blob)).not.toContain('Anjali'); await expect(open(blob)).rejects.toThrow('locked')
    await expect(unlock('wrong passphrase!')).rejects.toThrow('Wrong'); expect(isUnlocked()).toBe(false)
    await unlock('correct horse battery'); expect(await open<{ name: string }>(blob)).toEqual({ name: 'Anjali' })
  })
  it('locks out after repeated wrong attempts', async () => { await setupVault('correct horse battery'); lock(); for (let i = 0; i < 5; i++) await unlock('nope nope nope').catch(() => {}); expect(lockoutSeconds()).toBeGreaterThan(0); await expect(unlock('correct horse battery')).rejects.toThrow(/Too many/) })
})
describe('saved sessions are encrypted; patient and retention deletion work', () => {
  it('stores ciphertext only and lists after unlock', async () => {
    await setupVault('correct horse battery'); const s = { ...newSession(), profile: { ...newSession().profile, name: 'Sunita Deshmukh' } }
    expect(await saveSession(s)).toBe(true); expect(localStorage.getItem('nidan-saved-v3')).not.toContain('Sunita'); expect((await listSaved())[0].profile.name).toBe('Sunita Deshmukh')
    removeSaved(s.id, 'kiosk'); expect(await listSaved()).toHaveLength(0)
  })
  it('does not save at all (memory only) when staff setup is missing', async () => { expect(await saveSession(newSession())).toBe(false); expect(localStorage.getItem('nidan-saved-v3')).toBeNull() })
  it('retention purge removes old records', async () => {
    await setupVault('correct horse battery'); await saveSession(newSession())
    const l = JSON.parse(localStorage.getItem('nidan-saved-v3')!); l[0].at = new Date(Date.now() - 40 * 864e5).toISOString(); localStorage.setItem('nidan-saved-v3', JSON.stringify(l))
    expect(purgeOlderThan(30)).toBe(1); expect(JSON.parse(localStorage.getItem('nidan-saved-v3')!)).toHaveLength(0)
  })
})
describe('audit trail is hash-chained and detects tampering', () => {
  it('verifies, then fails after an edit', async () => {
    await log('kiosk', 'a', '1'); await log('staff', 'b', '2'); await log('staff', 'c', '3'); expect(readAudit()).toHaveLength(3); expect((await verifyAudit()).ok).toBe(true)
    const l = readAudit(); l[1].action = 'tampered'; localStorage.setItem('nidan-audit-v1', JSON.stringify(l)); expect(await verifyAudit()).toEqual({ ok: false, badAt: 2 })
  })
  it('contains no patient content', async () => { await setupVault('correct horse battery'); const s = { ...newSession(), profile: { ...newSession().profile, name: 'Zed Person' } }; await saveSession(s); expect(JSON.stringify(readAudit())).not.toContain('Zed') })
})
describe('alerts: urgent only, identity-free envelope, never lost', () => {
  it('review-only findings raise nothing', async () => { expect(await raiseAlert({ sessionId: 's', token: 'T-001', name: 'A', age: '30', ageUnit: 'years', findings: [F('confusion', 'review')] })).toBeNull() })
  it('envelope has token + flags but no name; identity is available to staff', async () => {
    const a = await raiseAlert({ sessionId: 's1', token: 'U-001', name: 'Anjali Patil', age: '42', ageUnit: 'years', findings: [F('chest_pain')] })
    expect(JSON.stringify(loadAlerts())).not.toContain('Anjali'); expect((await identity(a!))?.name).toBe('Anjali Patil'); expect(a!.ageBand).toBe('adult')
  })
  it('sealed identity survives a reload only for staff', async () => {
    await setupVault('correct horse battery'); const a = await raiseAlert({ sessionId: 's1', token: 'U-001', name: 'Anjali Patil', age: '42', ageUnit: 'years', findings: [F('chest_pain')] })
    expect(localStorage.getItem('nidan-alerts-v2')).not.toContain('Anjali'); expect(a!.sealed).toBeTruthy()
  })
  it('webhook gets token + flags only; failure keeps the alert queued; retry delivers', async () => {
    vi.stubEnv('VITE_ALERT_WEBHOOK', 'https://hook.test/x'); const fx = vi.fn().mockRejectedValue(new Error('offline')); vi.stubGlobal('fetch', fx)
    const a = await raiseAlert({ sessionId: 's1', token: 'U-002', name: 'Secret Name', age: '5', ageUnit: 'years', findings: [F('breathing')] })
    expect(a!.delivery).toBe('queued'); expect(loadAlerts()).toHaveLength(1); expect(fx.mock.calls[0][1].body).not.toContain('Secret'); expect(fx.mock.calls[0][1].body).toContain('U-002')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })); await flushQueued(); expect(loadAlerts()[0].delivery).toBe('sent')
  })
  it('de-duplicates, escalates, acknowledges, flags “left”, and patient deletion keeps the emergency', async () => {
    const r = (f: ReturnType<typeof F>[], id = 's1') => raiseAlert({ sessionId: id, token: 'U-003', name: 'N', age: '30', ageUnit: 'years', findings: f })
    await r([F('chest_pain')]); await r([F('chest_pain')]); expect(loadAlerts()).toHaveLength(1); await r([F('chest_pain'), F('breathing')]); expect(loadAlerts()[0].flags).toHaveLength(2)
    await r([F('seizure')], 's2'); acknowledge(loadAlerts().find((a) => a.sessionId === 's1')!.id); markLeft('s1'); markLeft('s2')
    expect(Object.fromEntries(loadAlerts().map((a) => [a.sessionId, a.status]))).toEqual({ s1: 'ack', s2: 'left' })
    dropPatientData('s2'); const s2 = loadAlerts().find((a) => a.sessionId === 's2')!; expect(await identity(s2)).toBeNull(); expect(s2.flags.length).toBe(1)
  })
})
describe('pilot metrics', () => {
  it('records timing and voice success without any patient content', () => {
    mBegin('m1', 'welcome'); mStep('patient'); mVoice(true); mVoice(false); mEnd({ lang: 'mr-IN', completed: true, urgent: false, assisted: false, express: false })
    const m = readMetrics(); expect(m).toHaveLength(1); expect(summarise(m).voiceSuccess).toBe(0.5); expect(JSON.stringify(m)).not.toMatch(/name|answer/i)
  })
})
