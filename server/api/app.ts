import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { existsSync } from 'node:fs'
import auth from './routes/auth.js'
import patient from './routes/patient.js'
import doctor from './routes/doctor.js'
import staff from './routes/staff.js'
import documents from './routes/documents.js'
import ai from './routes/ai.js'
import ai4bharat from './routes/ai4bharat.js'
import bhashini from './routes/bhashini.js'
import { requireTrustedOrigin } from './security.js'
import { allowedCspConnectOrigins, allowedOrigins, env } from './config.js'
import { cspConnectSources } from './csp.js'
import { prisma } from './db.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY === 'true')
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    frameguard: false,
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"],
      scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'style-src-attr': ["'unsafe-inline'"],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'], workerSrc: ["'self'", 'blob:'],
      connectSrc: cspConnectSources(allowedCspConnectOrigins), formAction: ["'self'"],
      frameAncestors: ["'self'", 'https://*.manus.computer'],
    } },
  }))
  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser())
  app.use((req, res, next) => {
    const origin = req.get('origin')
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'content-type')
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS')
    }
    if (req.method === 'OPTIONS') return origin && allowedOrigins.has(origin) ? res.sendStatus(204) : res.sendStatus(403)
    next()
  })
  app.use(requireTrustedOrigin)
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next() })
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'nidan-api', time: new Date().toISOString() }))
  app.get('/api/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      await prisma.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } })
      return res.json({ ok: true, service: 'nidan-api', database: 'ready' })
    } catch {
      return res.status(503).json({ ok: false, service: 'nidan-api', database: 'unavailable' })
    }
  })
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }), auth)
  app.use('/api/patient', patient)
  app.use('/api/doctor', doctor)
  app.use('/api/staff', staff)
  app.use('/api/documents', documents)
  app.use('/api', ai)
  app.use('/api/ai4bharat', ai4bharat)
  app.use('/api/bhashini', bhashini)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }))
  const webRoot = path.resolve(process.cwd(), 'dist')
  if (process.env.NODE_ENV === 'production' && existsSync(path.join(webRoot, 'index.html'))) {
    app.use(express.static(webRoot, { index: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }))
    app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(webRoot, 'index.html')) })
  }
  app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }))
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return
    const err = error as { code?: string }
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Upload exceeds the ${env.MAX_UPLOAD_MB} MB limit.` })
    console.error('NIDAN API request failed:', err.code ?? 'unexpected')
    return res.status(500).json({ error: 'The request could not be completed. Please try again.' })
  })
  return app
}
