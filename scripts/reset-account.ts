import 'dotenv/config'
import { stdin, stdout } from 'node:process'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { prismaDatasourceUrl } from '../server/api/db-url.js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) throw new Error('Usage: npm run account:reset -- user@example.org')
const askHidden = (label: string) => new Promise<string>((resolve, reject) => { stdout.write(label); const chars: string[] = []; const done = (error?: Error) => { stdin.off('data', onData); stdin.setRawMode?.(false); stdin.pause(); stdout.write('\n'); error ? reject(error) : resolve(chars.join('')) }; const onData = (buffer: Buffer) => { for (const c of buffer.toString('utf8')) { if (c === '\u0003') return done(new Error('Cancelled.')); if (c === '\r' || c === '\n') return done(); if (c === '\u007f' || c === '\b') chars.pop(); else if (c >= ' ' && c <= '~' && chars.length < 128) chars.push(c) } }; if (!stdin.isTTY || !stdout.isTTY) return reject(new Error('A terminal is required; do not pass passwords as command-line arguments.')); stdin.setRawMode?.(true); stdin.resume(); stdin.on('data', onData) })
const password = await askHidden('New temporary password (12+ characters, input hidden): ')
if (password.length < 12) throw new Error('Password must have at least 12 characters.')
const datasourceUrl = prismaDatasourceUrl(process.env.DATABASE_URL)
const db = datasourceUrl ? new PrismaClient({ datasources: { db: { url: datasourceUrl } } }) : new PrismaClient()
try {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) throw new Error('Account not found.')
  const hash = await bcrypt.hash(password, 12)
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: hash } }),
    db.userSession.deleteMany({ where: { userId: user.id } }),
    db.auditEvent.create({ data: { actorId: user.id, action: 'account_password_reset_admin_cli', entityType: 'user', entityId: user.id } }),
  ])
  console.log(`Password reset for ${email}. Deliver the temporary password through an approved institutional channel and require an immediate change.`)
} finally { await db.$disconnect() }
