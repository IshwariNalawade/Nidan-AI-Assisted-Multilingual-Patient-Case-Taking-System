import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, UserRole } from '@prisma/client'
import { prismaDatasourceUrl } from '../server/api/db-url.js'

const datasourceUrl = prismaDatasourceUrl(process.env.DATABASE_URL)
const prisma = datasourceUrl ? new PrismaClient({ datasources: { db: { url: datasourceUrl } } }) : new PrismaClient()
async function main() {
  const password = process.env.SEED_DEMO_PASSWORD
  if (!password) { console.log('No synthetic accounts created. Set SEED_DEMO_PASSWORD locally to opt in.'); return }
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to create demo accounts in production.')
  if (password.length < 12) throw new Error('SEED_DEMO_PASSWORD must have at least 12 characters.')
  const passwordHash = await bcrypt.hash(password, 12)
  const doctor = await prisma.user.upsert({ where: { email: 'doctor.demo@nidan.invalid' }, update: { passwordHash, role: UserRole.DOCTOR }, create: { email: 'doctor.demo@nidan.invalid', passwordHash, role: UserRole.DOCTOR } })
  const patient = await prisma.user.upsert({ where: { email: 'patient.demo@nidan.invalid' }, update: { passwordHash }, create: { email: 'patient.demo@nidan.invalid', passwordHash, patientProfile: { create: { fullName: 'Synthetic Demo Patient', ageYears: 35, sex: 'unspecified', preferredLanguage: 'en-IN' } } } })
  if (!patient) throw new Error('Synthetic patient seed failed')
  console.log(`Created/updated synthetic local users: ${doctor.email} and ${patient.email}. Do not use these in production.`)
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
