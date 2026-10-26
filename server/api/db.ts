import { PrismaClient } from '@prisma/client'
import { env } from './config.js'
import { prismaDatasourceUrl } from './db-url.js'

const globalForPrisma = globalThis as unknown as { nidanPrisma?: PrismaClient }
const datasourceUrl = prismaDatasourceUrl(env.DATABASE_URL)
export const prisma = globalForPrisma.nidanPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
})
if (process.env.NODE_ENV !== 'production') globalForPrisma.nidanPrisma = prisma
