import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { prisma } from './db.js'

export const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler => (req, res, next) => { void fn(req, res, next).catch(next) }
export async function audit(actorId: string | null, action: string, entityType: string, entityId?: string) {
  await prisma.auditEvent.create({ data: { actorId, action, entityType, entityId: entityId ?? null } })
}
export function parseId(value: string) { return /^[a-z0-9_-]{8,64}$/i.test(value) }
