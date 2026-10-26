import 'dotenv/config'
import { AssessmentStatus, PrismaClient } from '@prisma/client'
import { removeDocumentObject } from '../server/api/storage.js'
import { prismaDatasourceUrl } from '../server/api/db-url.js'

const days = Number(process.env.RETENTION_DAYS ?? 365)
if (!Number.isInteger(days) || days < 30) throw new Error('RETENTION_DAYS must be an integer of at least 30 days.')
const datasourceUrl = prismaDatasourceUrl(process.env.DATABASE_URL)
const db = datasourceUrl ? new PrismaClient({ datasources: { db: { url: datasourceUrl } } }) : new PrismaClient()
const cutoff = new Date(Date.now() - days * 864e5)
try {
  const expiredSessions = await db.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  const oldAudit = await db.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
  const oldAssessments = await db.assessment.findMany({ where: { status: AssessmentStatus.REVIEWED, submittedAt: { lt: cutoff } }, select: { id: true, documents: { select: { storageKey: true } } } })
  let projectObjectsRetained = 0
  const documentIds: string[] = []
  for (const assessment of oldAssessments) for (const doc of assessment.documents) {
    if (!(await removeDocumentObject(doc.storageKey))) projectObjectsRetained++
    documentIds.push(doc.storageKey)
  }
  if (documentIds.length) await db.medicalDocument.deleteMany({ where: { storageKey: { in: documentIds } } })
  if (oldAssessments.length) await db.assessment.deleteMany({ where: { id: { in: oldAssessments.map((x) => x.id) } } })
  console.log(JSON.stringify({ cutoff: cutoff.toISOString(), expiredSessions: expiredSessions.count, oldAudit: oldAudit.count, reviewedAssessments: oldAssessments.length, reportObjectsRetainedInProjectStorage: projectObjectsRetained }))
} finally { await db.$disconnect() }
