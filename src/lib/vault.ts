// Staff vault. A staff passphrase protects an ECDH P-256 private key (PBKDF2 + AES-GCM). The kiosk only ever needs the PUBLIC key,
// so it can seal records for staff without being able to read them back. No default PIN exists: first run = staff sets a passphrase.
// Honest scope: this protects data at rest in the browser profile. It is not a substitute for a hardened server in production.
const PUB = 'nidan.vault.pub', PRIV = 'nidan.vault.priv', FAIL = 'nidan.vault.fail', ITER = 210000, IDLE_MS = 5 * 60_000
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = (u: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(u instanceof Uint8Array ? u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) : u)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
let priv: CryptoKey | null = null, timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
export const onVaultChange = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
const emit = () => listeners.forEach((f) => f())
export const vaultReady = () => { try { return !!localStorage.getItem(PUB) } catch { return false } }
export const isUnlocked = () => priv !== null
export function lock() { priv = null; clearTimeout(timer); emit() }
export function touch() { if (!priv) return; clearTimeout(timer); timer = setTimeout(lock, IDLE_MS) }

async function wrapKey(pass: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function setupVault(pass: string) {
  if (pass.length < 8) throw new Error('Passphrase must be at least 8 characters')
  if (vaultReady()) throw new Error('Already set up')
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await wrapKey(pass, salt), enc.encode(JSON.stringify(await crypto.subtle.exportKey('jwk', kp.privateKey))))
  localStorage.setItem(PRIV, JSON.stringify({ s: b64(salt), i: b64(iv), c: b64(ct) }))
  localStorage.setItem(PUB, JSON.stringify(await crypto.subtle.exportKey('jwk', kp.publicKey)))
  await unlock(pass)
}
export function lockoutSeconds(): number {
  try { const f = JSON.parse(localStorage.getItem(FAIL) ?? '{}') as { n?: number; t?: number }; if (!f.n || f.n < 5) return 0; return Math.max(0, Math.ceil(((f.t ?? 0) + Math.min(900, 60 * 2 ** (f.n - 5))) * 1 - Date.now() / 1000)) } catch { return 0 }
}
export async function unlock(pass: string) {
  const wait = lockoutSeconds(); if (wait > 0) throw new Error(`Too many attempts. Try again in ${wait}s`)
  const rec = JSON.parse(localStorage.getItem(PRIV) ?? 'null') as { s: string; i: string; c: string } | null; if (!rec) throw new Error('Vault not set up')
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.i) as BufferSource }, await wrapKey(pass, unb64(rec.s)), unb64(rec.c) as BufferSource)
    priv = await crypto.subtle.importKey('jwk', JSON.parse(dec.decode(pt)), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
    localStorage.removeItem(FAIL); touch(); emit()
  } catch {
    const f = JSON.parse(localStorage.getItem(FAIL) ?? '{}') as { n?: number }; localStorage.setItem(FAIL, JSON.stringify({ n: (f.n ?? 0) + 1, t: Math.floor(Date.now() / 1000) }))
    throw new Error('Wrong passphrase')
  }
}
const aes = (shared: CryptoKey) => shared
async function derive(a: CryptoKey, bPub: CryptoKey) { return crypto.subtle.deriveKey({ name: 'ECDH', public: bPub }, a, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) }
export interface Sealed { e: JsonWebKey; i: string; c: string }
export async function seal(obj: unknown): Promise<Sealed> {
  const pubJwk = JSON.parse(localStorage.getItem(PUB) ?? 'null') as JsonWebKey | null; if (!pubJwk) throw new Error('Vault not set up')
  const pub = await crypto.subtle.importKey('jwk', pubJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const key = aes(await derive(eph.privateKey, pub)), iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))
  return { e: await crypto.subtle.exportKey('jwk', eph.publicKey), i: b64(iv), c: b64(ct) }
}
export async function open<T>(blob: Sealed): Promise<T> {
  if (!priv) throw new Error('locked'); touch()
  const epk = await crypto.subtle.importKey('jwk', blob.e, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.i) as BufferSource }, await derive(priv, epk), unb64(blob.c) as BufferSource)
  return JSON.parse(dec.decode(pt)) as T
}
export const sha256 = async (s: string) => b64(await crypto.subtle.digest('SHA-256', enc.encode(s)))
