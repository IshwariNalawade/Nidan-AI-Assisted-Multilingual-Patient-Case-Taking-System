import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const url = process.env.DATABASE_URL
const password = process.env.NIDAN_BACKUP_PASSWORD
const file = process.env.NIDAN_BACKUP_FILE ?? path.resolve('backups', `nidan-${new Date().toISOString().replace(/[:.]/g, '-')}.sql.enc`)
if (!url || !password || password.length < 20) throw new Error('DATABASE_URL and NIDAN_BACKUP_PASSWORD (20+ characters) are required.')
if (!file.endsWith('.sql.enc')) throw new Error('NIDAN_BACKUP_FILE must end with .sql.enc')
const mode = process.argv[2] ?? 'create'
const dir = path.dirname(file)
mkdirSync(dir, { recursive: true })
const tmp = `${file}.plain`
const pg = new URL(url)
const args = ['--format=custom', '--no-owner', '--no-privileges', '--file', tmp, '--host', pg.hostname, '--port', pg.port || '5432', '--username', decodeURIComponent(pg.username), pg.pathname.replace(/^\//, '').split('?')[0]]
const env = { ...process.env, PGPASSWORD: decodeURIComponent(pg.password) }
try {
  if (mode === 'create') {
    execFileSync('pg_dump', args, { env, stdio: 'inherit' })
    execFileSync('openssl', ['enc', '-aes-256-cbc', '-pbkdf2', '-iter', '210000', '-salt', '-in', tmp, '-out', file, '-pass', `env:NIDAN_BACKUP_PASSWORD`], { env: { ...env, NIDAN_BACKUP_PASSWORD: password }, stdio: 'inherit' })
    const digest = execFileSync('sha256sum', [file], { encoding: 'utf8' }).split(' ')[0]
    writeFileSync(`${file}.sha256`, `${digest}  ${path.basename(file)}\n`)
    console.log(`Encrypted backup created: ${file}`)
  } else if (mode === 'restore') {
    if (!existsSync(file)) throw new Error(`Backup not found: ${file}`)
    execFileSync('openssl', ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '210000', '-in', file, '-out', tmp, '-pass', 'env:NIDAN_BACKUP_PASSWORD'], { env: { ...env, NIDAN_BACKUP_PASSWORD: password }, stdio: 'inherit' })
    execFileSync('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--host', pg.hostname, '--port', pg.port || '5432', '--username', decodeURIComponent(pg.username), '--dbname', pg.pathname.replace(/^\//, '').split('?')[0], tmp], { env, stdio: 'inherit' })
    console.log(`Backup restored: ${file}`)
  } else if (mode === 'verify') {
    if (!existsSync(file)) throw new Error(`Backup not found: ${file}`)
    execFileSync('openssl', ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '210000', '-in', file, '-out', tmp, '-pass', 'env:NIDAN_BACKUP_PASSWORD'], { env: { ...env, NIDAN_BACKUP_PASSWORD: password }, stdio: 'inherit' })
    execFileSync('pg_restore', ['--list', tmp], { stdio: 'ignore' })
    console.log(`Backup decrypts and contains a readable PostgreSQL archive: ${file}`)
  } else throw new Error('Usage: npm run backup:create | backup:restore | backup:verify')
} finally {
  if (existsSync(tmp)) unlinkSync(tmp)
}
