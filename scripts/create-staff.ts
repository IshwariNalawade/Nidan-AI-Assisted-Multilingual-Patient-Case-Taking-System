import 'dotenv/config'
import { stdin, stdout } from 'node:process'
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prismaDatasourceUrl } from '../server/api/db-url.js'

function hiddenPrompt(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) return Promise.reject(new Error('A terminal is required; never pass a password as a command-line argument.'))
  return new Promise((resolve, reject) => {
    stdout.write(prompt)
    const chars: string[] = []
    const onData = (buffer: Buffer) => {
      for (const c of buffer.toString('utf8')) {
        if (c === '\u0003') { cleanup(); reject(new Error('Cancelled.')); return }
        if (c === '\r' || c === '\n') { cleanup(); stdout.write('\n'); resolve(chars.join('')); return }
        if (c === '\u007f' || c === '\b') chars.pop()
        else if (c >= ' ' && c <= '~' && chars.length < 128) chars.push(c)
      }
    }
    const cleanup = () => { stdin.off('data', onData); stdin.setRawMode?.(false); stdin.pause() }
    stdin.setRawMode?.(true); stdin.resume(); stdin.on('data', onData)
  })
}

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run staff:create -- triage@example.org')
  process.exitCode = 2
} else {
  const password = await hiddenPrompt('New staff password (12+ chars, input hidden): ')
  const repeat = await hiddenPrompt('Repeat password: ')
  if (password.length < 12 || password !== repeat) throw new Error('Passwords must match and have at least 12 characters.')
  const datasourceUrl = prismaDatasourceUrl(process.env.DATABASE_URL)
  const db = datasourceUrl ? new PrismaClient({ datasources: { db: { url: datasourceUrl } } }) : new PrismaClient()
  try {
    if (await db.user.findUnique({ where: { email } })) throw new Error('An account already exists with this email. Use a reviewed administrator process rather than changing its role.')
    const user = await db.user.create({ data: { email, role: UserRole.STAFF, passwordHash: await bcrypt.hash(password, 12) } })
    await db.auditEvent.create({ data: { actorId: user.id, action: 'staff_account_provisioned_cli', entityType: 'user', entityId: user.id } })
    console.log(`Staff account provisioned: ${user.email}. Keep this machine and credential under institutional control.`)
  } finally { await db.$disconnect() }
}
