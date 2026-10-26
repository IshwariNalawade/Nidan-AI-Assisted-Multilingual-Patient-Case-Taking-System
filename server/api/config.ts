import 'dotenv/config'
import { z } from 'zod'
import { parseCspConnectOrigins } from './csp.js'

const bool = z.enum(['true', 'false']).default('false').transform((v) => v === 'true')
const schema = z.object({
  DATABASE_URL: z.string().default('mysql://nidan:nidan-local-only@localhost:3306/nidan'),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(process.env.NODE_ENV === 'production' && Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 8787),
  SESSION_COOKIE_NAME: z.string().min(1).default('nidan_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  COOKIE_SECURE: bool,
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  PUBLIC_HTTPS: bool,
  COOKIE_DOMAIN: z.string().optional(),
  APP_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  APP_CSP_CONNECT_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.enum(['false', 'true']).default('false'),
  DEFAULT_ORGANIZATION_ID: z.string().min(1).optional(),
  REQUIRE_ORGANIZATION: bool,
  PRODUCTION_HARDENING: bool,
  LOGIN_LOCKOUT_THRESHOLD: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  NIDAN_STORAGE_BACKEND: z.enum(['auto', 'local', 'project']).default('auto'),
  PRIVATE_UPLOAD_DIR: z.string().default('./private-uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(25).default(10),
  CLAMAV_SCAN: z.enum(['off', 'required']).default('off'),
  RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
  NIDAN_AI_PROVIDER: z.enum(['none', 'ollama', 'gemini']).default('none'),
  NIDAN_AI_BASE_URL: z.string().url().optional(),
  NIDAN_AI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  NIDAN_AI_ALLOW_REMOTE: bool,
  NIDAN_HANDWRITING_URL: z.string().url().optional(),
  NIDAN_HANDWRITING_ALLOW_REMOTE: bool,
  AI4BHARAT_ASR_URL: z.string().url().optional(),
  AI4BHARAT_OCR_URL: z.string().url().optional(),
  AI4BHARAT_ALLOW_REMOTE: bool,
  BHASHINI_ENABLED: bool,
  BHASHINI_USER_ID: z.string().min(1).optional(),
  BHASHINI_API_KEY: z.string().min(1).optional(),
  BHASHINI_PIPELINE_ID: z.string().min(1).default('643930aa521a4b1ba0f4c41d'),
  BHASHINI_CONFIG_URL: z.string().url().default('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline'),
  BHASHINI_INFERENCE_URL: z.string().url().default('https://dhruva-api.bhashini.gov.in/services/inference/pipeline'),
  BHASHINI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(45000),
  BHASHINI_SAMPLING_RATE: z.coerce.number().int().min(8000).max(48000).default(16000),
  SEED_DEMO_PASSWORD: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
}
if (parsed.data.NIDAN_AI_PROVIDER === 'gemini' && (!parsed.data.GEMINI_API_KEY || parsed.data.GEMINI_API_KEY.length < 20)) {
  throw new Error('Invalid environment configuration: GEMINI_API_KEY is required when NIDAN_AI_PROVIDER=gemini')
}
if (parsed.data.BHASHINI_ENABLED && (!parsed.data.BHASHINI_USER_ID || !parsed.data.BHASHINI_API_KEY)) {
  throw new Error('Invalid environment configuration: BHASHINI_USER_ID and BHASHINI_API_KEY are required when BHASHINI_ENABLED=true')
}
if (parsed.data.COOKIE_SAME_SITE === 'none' && !parsed.data.COOKIE_SECURE) {
  throw new Error('COOKIE_SECURE=true is required when COOKIE_SAME_SITE=none')
}
if (parsed.data.PRODUCTION_HARDENING && (!parsed.data.DEFAULT_ORGANIZATION_ID || !parsed.data.REQUIRE_ORGANIZATION || parsed.data.CLAMAV_SCAN !== 'required' || !parsed.data.COOKIE_SECURE || parsed.data.COOKIE_SAME_SITE === 'lax')) {
  throw new Error('PRODUCTION_HARDENING requires DEFAULT_ORGANIZATION_ID, REQUIRE_ORGANIZATION=true, CLAMAV_SCAN=required, COOKIE_SECURE=true, and COOKIE_SAME_SITE=strict or none')
}
const localHost = (input?: string) => { if (!input) return true; const h = new URL(input).hostname.toLowerCase(); return ['localhost', '127.0.0.1', '::1'].includes(h) || h.endsWith('.local') || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) }
if (!parsed.data.AI4BHARAT_ALLOW_REMOTE && (!localHost(parsed.data.AI4BHARAT_ASR_URL) || !localHost(parsed.data.AI4BHARAT_OCR_URL))) throw new Error('AI4BHARAT ASR/OCR endpoints must be local/private unless AI4BHARAT_ALLOW_REMOTE=true.')
export const env = parsed.data
const previewOrigin = (() => {
  try {
    const origin = new URL(process.env.MANUS_ADDON_PREVIEW_PUBLIC_ORIGIN ?? '')
    return origin.protocol === 'https:' ? origin.origin : undefined
  } catch { return undefined }
})()
export const allowedOrigins = new Set([...env.APP_ORIGINS.split(',').map((x) => x.trim()).filter(Boolean), ...(previewOrigin ? [previewOrigin] : [])])
export const allowedCspConnectOrigins = parseCspConnectOrigins(env.APP_CSP_CONNECT_ORIGINS)
