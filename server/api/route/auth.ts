import { Router } from 'express'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { env } from '../config.js'
import { prisma } from '../db.js'
import { clearSessionCookie, cookieOptions, createSessionToken, hashSessionToken, requireAuth, setSessionCookie } from '../security.js'
import { removeDocumentObject } from '../storage.js'
import { asyncRoute, audit } from '../utils.js'

const router = Router()
const failures = new Map<string, { count: number; until: number }>()
const clientKey = (req: Parameters<Parameters<typeof router.post>[1]>[0], email: string) => `${req.ip}:${email.toLowerCase()}`
const locked = (key: string) => (failures.get(key)?.until ?? 0) > Date.now()
const recordFailure = (key: string) => {
  const previous = failures.get(key), count = (previous?.count ?? 0) + 1
  if (count >= env.LOGIN_LOCKOUT_THRESHOLD) failures.set(key, { count: 0, until: Date.now() + env.LOGIN_LOCKOUT_MINUTES * 60_000 })
  else failures.set(key, { count, until: 0 })
}
const clearFailures = (key: string) => failures.delete(key)
const registerSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(128), language: z.string().max(20).default('en-IN') }).strict()
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) })
const publicUser = (user: { id: string; email: string; role: UserRole; organizationId: string | null; organization: { id: string; name: string; kind: string } | null; patientProfile: unknown }) => ({ id: user.id, email: user.email, role: user.role, organizationId: user.organizationId, organization: user.organization, patientProfile: user.patientProfile })

async function issueSession(userId: string, res: Parameters<typeof setSessionCookie>[0]) {
  const token = createSessionToken(), expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000)
  await prisma.userSession.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt } })
  setSessionCookie(res, token)
}

router.post('/register', asyncRoute(async (req, res) => {
  if (env.REQUIRE_ORGANIZATION && !env.DEFAULT_ORGANIZATION_ID) return res.status(503).json({ error: 'Patient registration is temporarily unavailable until an organization is configured.' })
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Check the name, email, password (12+ characters), and language.' })
  const data = parsed.data
  const passwordHash = await bcrypt.hash(data.password, 12)
  try {
    const user = await prisma.user.create({ data: { email: data.email.toLowerCase(), passwordHash, role: UserRole.PATIENT, ...(env.DEFAULT_ORGANIZATION_ID ? { organization: { connect: { id: env.DEFAULT_ORGANIZATION_ID } } } : {}), patientProfile: { create: { fullName: data.name, preferredLanguage: data.language } } }, include: { patientProfile: true, organization: true } })
    await issueSession(user.id, res)
    await audit(user.id, 'patient_registered', 'user', user.id)
    return res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return res.status(400).json({ error: 'Unable to create an account with these details.' })
    throw error
  }
}))

router.post('/login', asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' })
  const email = parsed.data.email.toLowerCase(), key = clientKey(req, email)
  if (locked(key)) return res.status(429).json({ error: 'Too many failed sign-in attempts. Try again later.' })
  const user = await prisma.user.findUnique({ where: { email }, include: { patientProfile: true, organization: true } })
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) { recordFailure(key); return res.status(401).json({ error: 'Email or password is incorrect.' }) }
  clearFailures(key)
  await issueSession(user.id, res)
  await audit(user.id, 'login', 'user', user.id)
  return res.json({ user: publicUser(user) })
}))

router.get('/me', requireAuth, (req, res) => res.json({ user: req.authUser }))
router.post('/logout', requireAuth, asyncRoute(async (req, res) => {
  if (req.authSessionId) await prisma.userSession.deleteMany({ where: { id: req.authSessionId } })
  if (req.authUser) await audit(req.authUser.id, 'logout', 'user', req.authUser.id)
  clearSessionCookie(res)
  return res.json({ ok: true })
}))

router.delete('/account', requireAuth, asyncRoute(async (req, res) => {
  const parsed = z.object({ password: z.string().min(1).max(128), confirmation: z.literal('DELETE') }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Password and confirmation DELETE are required.' })
  const user = await prisma.user.findUnique({ where: { id: req.authUser!.id }, include: { patientProfile: { include: { documents: true } } } })
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: 'Password is incorrect.' })
  await audit(user.id, 'account_deletion_requested', 'user', user.id)
  const erased = await Promise.all((user.patientProfile?.documents ?? []).map((doc) => removeDocumentObject(doc.storageKey)))
  await prisma.user.delete({ where: { id: user.id } })
  clearSessionCookie(res)
  return res.json({ ok: true, storageErasure: erased.every(Boolean) })
}))

export default router
