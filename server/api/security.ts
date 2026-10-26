import { createHash, randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { UserRole } from '@prisma/client'
import { env, allowedOrigins } from './config.js'
import { prisma } from './db.js'

export type SafeUser = { id: string; email: string; role: UserRole; organizationId: string | null; organization: { id: string; name: string; kind: string } | null; patientProfile: { id: string; fullName: string; ageYears: number | null; sex: string | null; phone: string | null; preferredLanguage: string } | null }
declare global {
  namespace Express {
    interface Request { authUser?: SafeUser; authSessionId?: string }
  }
}

export const hashSessionToken = (value: string) => createHash('sha256').update(value).digest('hex')
export const createSessionToken = () => randomBytes(32).toString('base64url')
const publicHttps = env.PUBLIC_HTTPS || process.env.MANUS_ADDON_PREVIEW_PUBLIC_ORIGIN?.startsWith('https://') === true
const sameSite = publicHttps ? 'none' : env.COOKIE_SAME_SITE
export const cookieOptions = {
  httpOnly: true,
  secure: publicHttps || env.COOKIE_SECURE,
  sameSite,
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
} as const
export function setSessionCookie(res: Response, token: string) { res.cookie(env.SESSION_COOKIE_NAME, token, cookieOptions) }
export function clearSessionCookie(res: Response) { const { maxAge: _maxAge, ...opts } = cookieOptions; res.clearCookie(env.SESSION_COOKIE_NAME, opts) }

function isTrustedOrigin(req: Request, value: string) {
  if (allowedOrigins.has(value)) return true
  try {
    const origin = new URL(value)
    if (origin.protocol !== 'https:' || origin.origin !== value) return false
    if (req.get('sec-fetch-site') === 'same-origin') return true
    if (process.env.NODE_ENV !== 'production') return false
    const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim()
    const host = forwardedHost || req.get('host')
    const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
    const protocol = forwardedProto || (env.PUBLIC_HTTPS ? 'https' : 'http')
    if (!host || protocol !== 'https') return false
    return origin.origin === new URL(`https://${host}`).origin
  } catch { return false }
}

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (!origin || !isTrustedOrigin(req, origin)) return res.status(403).json({ error: 'Request origin is not allowed.' })
  next()
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME]
    if (!token || typeof token !== 'string' || token.length > 256) return res.status(401).json({ error: 'Sign in required.' })
    const session = await prisma.userSession.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: { include: { patientProfile: true, organization: true } } } })
    if (!session || session.expiresAt <= new Date()) {
      if (session) await prisma.userSession.delete({ where: { id: session.id } })
      return res.status(401).json({ error: 'Session expired. Please sign in again.' })
    }
    req.authSessionId = session.id
    req.authUser = { id: session.user.id, email: session.user.email, role: session.user.role, organizationId: session.user.organizationId, organization: session.user.organization ? { id: session.user.organization.id, name: session.user.organization.name, kind: session.user.organization.kind } : null, patientProfile: session.user.patientProfile }
    next()
  } catch (error) { next(error) }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) return res.status(401).json({ error: 'Sign in required.' })
    if (!roles.includes(req.authUser.role)) return res.status(403).json({ error: 'You are not authorized for this action.' })
    next()
  }
}
