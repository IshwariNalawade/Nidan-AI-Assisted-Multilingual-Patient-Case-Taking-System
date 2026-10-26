import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { prismaDatasourceUrl } from '../server/api/db-url.js'

const slug = process.argv[2]?.trim().toLowerCase()
const kindFlag = process.argv.find((arg) => arg.startsWith('--kind='))?.slice('--kind='.length).trim().toUpperCase()
const kind = ['GENERAL', 'HOSPITAL', 'CLINIC', 'RESEARCH', 'AYUSH'].includes(kindFlag ?? '') ? kindFlag! : 'GENERAL'
const name = process.argv.slice(3).filter((arg) => !arg.startsWith('--kind=')).join(' ').trim()
if (!slug || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) || !name || name.length > 160) {
  console.error('Usage: npm run organization:create -- hospital-slug Organization Name [--kind=HOSPITAL|CLINIC|RESEARCH|AYUSH|GENERAL]')
  process.exitCode = 2
} else {
  const datasourceUrl = prismaDatasourceUrl(process.env.DATABASE_URL)
  const db = datasourceUrl ? new PrismaClient({ datasources: { db: { url: datasourceUrl } } }) : new PrismaClient()
  try {
    const organization = await db.organization.create({ data: { slug, name, kind } })
    console.log(`Organization created: ${organization.id} (${organization.kind}: ${organization.slug})`)
  } finally { await db.$disconnect() }
}
