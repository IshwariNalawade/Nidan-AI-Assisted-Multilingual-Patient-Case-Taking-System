import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app.js'
import { bhashiniLanguage } from './bhashini.js'
import { deriveSafetyFindings } from './clinical-safety.js'
import { cspConnectSources, parseCspConnectOrigins } from './csp.js'
import { requireRole } from './security.js'
import { UserRole } from '@prisma/client'

const app = createApp()

describe('NIDAN REST API guardrails', () => {
  it('returns a health response without database access', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ ok: true, service: 'nidan-api' })
    expect(response.headers['x-frame-options']).toBeUndefined()
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'self' https://*.manus.computer")
  })

  it('allows credentialed requests only from configured frontend origins', async () => {
    const response = await request(app).get('/api/health').set('Origin', 'http://localhost:3000')
    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    const preflight = await request(app).options('/api/auth/login').set('Origin', 'http://localhost:3000')
    expect(preflight.status).toBe(204)
    expect(preflight.headers['access-control-allow-methods']).toContain('POST')
  })

  it('requires a session for patient data', async () => {
    const response = await request(app).get('/api/patient/profile')
    expect(response.status).toBe(401)
  })

  it('requires a session for incomplete patient drafts', async () => {
    const response = await request(app).get('/api/patient/assessments/drafts')
    expect(response.status).toBe(401)
  })

  it('requires a session for doctor cases', async () => {
    const response = await request(app).get('/api/doctor/cases')
    expect(response.status).toBe(401)
  })

  it('requires a session for the staff triage queue and does not allow staff self-registration', async () => {
    const response = await request(app).get('/api/staff/cases')
    expect(response.status).toBe(401)
    const signup = await request(app).post('/api/auth/register').set('Origin', 'http://localhost:3000').send({ name: 'Demo Staff', email: 'nidan-test-staff-signup@example.test', password: 'not-a-real-password-123', role: 'STAFF' })
    expect(signup.status).toBe(400)
  })

  it('forbids a signed-in patient from using the STAFF role guard', () => {
    const middleware = requireRole(UserRole.STAFF)
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    middleware({ authUser: { id: 'fictional-patient', email: 'patient@example.test', role: UserRole.PATIENT, organizationId: null, organization: null, patientProfile: null } } as never, response as never, next)
    expect(response.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects invalid sign-up data before touching the database', async () => {
    const response = await request(app).post('/api/auth/register').set('Origin', 'http://localhost:3000').send({ name: 'x', email: 'not-an-email', password: 'short' })
    expect(response.status).toBe(400)
  })

  it('rejects state-changing requests from unapproved origins', async () => {
    const response = await request(app).post('/api/auth/register').set('Origin', 'https://attacker.example').send({})
    expect(response.status).toBe(403)
  })

  it('accepts only the HTTPS same-origin host forwarded by the production proxy', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const sameOrigin = await request(app).post('/api/auth/register').set('Origin', 'https://nidan-demo.example').set('Sec-Fetch-Site', 'same-origin').set('X-Forwarded-Host', 'nidan-demo.example').set('X-Forwarded-Proto', 'https').send({ name: 'x', email: 'invalid', password: 'short' })
      expect(sameOrigin.status).toBe(400)
      const crossOrigin = await request(app).post('/api/auth/register').set('Origin', 'https://attacker.example').set('Sec-Fetch-Site', 'same-site').set('X-Forwarded-Host', 'nidan-demo.example').set('X-Forwarded-Proto', 'https').send({})
      expect(crossOrigin.status).toBe(403)
    } finally { vi.unstubAllEnvs() }
  })
})

describe('production browser connection allowlist', () => {
  it('accepts only exact HTTPS origins and keeps same-origin as the default', () => {
    const origins = parseCspConnectOrigins('https://relay.hospital.example, https://fhir.hospital.example,https://relay.hospital.example')
    expect(origins).toEqual(['https://relay.hospital.example', 'https://fhir.hospital.example'])
    expect(cspConnectSources(origins)).toEqual(["'self'", 'https://relay.hospital.example', 'https://fhir.hospital.example'])
    expect(() => parseCspConnectOrigins('http://relay.hospital.example')).toThrow(/HTTPS origins/)
    expect(() => parseCspConnectOrigins('https://relay.hospital.example/api')).toThrow(/without paths/)
  })
})

describe('server-derived red-flag findings', () => {
  it('uses the actual answered yes/no question, honors negation and applies the infant context', () => {
    const chest = deriveSafetyFindings({ concern: 'Routine follow-up', answers: { chest_current: 'Yes' }, symptomKey: 'chest', ageYears: 40 })
    expect(chest.some((finding) => finding.id === 'chest_pain' && finding.tier === 'urgent')).toBe(true)
    const negated = deriveSafetyFindings({ concern: 'No chest pain, only mild tiredness', answers: {}, symptomKey: 'chest', ageYears: 40 })
    expect(negated.some((finding) => finding.id === 'chest_pain')).toBe(false)
    const infant = deriveSafetyFindings({ concern: 'Fever since this morning', answers: {}, symptomKey: 'fever', ageYears: 0 })
    expect(infant.some((finding) => finding.id === 'infant_fever' && finding.tier === 'urgent')).toBe(true)
  })

  it.each(['sugar_wellbeing', 'pressure_urgent', 'eye_vision', 'ent_swallow', 'dental_urgent', 'allergy_urgent', 'menstrual_urgent', 'injury_warning'])(
    'turns an affirmative %s answer into a server-derived urgent triage finding and ignores an explicit no',
    (questionId) => {
      const yes = deriveSafetyFindings({ concern: 'Patient-reported concern', answers: { [questionId]: 'Yes' }, symptomKey: '', ageYears: 35 })
      const no = deriveSafetyFindings({ concern: 'Patient-reported concern', answers: { [questionId]: 'No' }, symptomKey: '', ageYears: 35 })
      expect(yes.some((finding) => finding.id === questionId && finding.tier === 'urgent')).toBe(true)
      expect(no.some((finding) => finding.id === questionId)).toBe(false)
    },
  )
})

describe('optional Bhashini adapter', () => {
  it('normalizes NIDAN locale tags to Bhashini ISO-639 codes', () => {
    expect(bhashiniLanguage('hi-IN')).toBe('hi')
    expect(bhashiniLanguage('mr-IN')).toBe('mr')
  })

  it('fails clearly and keeps the provider disabled without credentials', async () => {
    const response = await request(app).post('/api/bhashini/tts').set('Origin', 'http://localhost:3000').send({ text: 'Hello', language: 'en-IN' })
    expect(response.status).toBe(503)
    expect(response.body.error).toMatch(/browser read-aloud fallback remains available/i)
  })
})
