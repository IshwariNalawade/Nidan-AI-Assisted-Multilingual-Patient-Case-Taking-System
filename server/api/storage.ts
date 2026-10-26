import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from './config.js'
import { getProjectObject, putProjectObject } from './platform-storage.js'

type StorageBackend = 'local' | 'project'

function configuredBackend(): StorageBackend {
  const hasUrl = Boolean(process.env.MANUS_API_URL)
  const hasKey = Boolean(process.env.MANUS_API_KEY)
  if (hasUrl !== hasKey) throw new Error('Project object storage credentials are incomplete.')
  if (env.NIDAN_STORAGE_BACKEND === 'project') return 'project'
  if (env.NIDAN_STORAGE_BACKEND === 'local') {
    if (process.env.NODE_ENV === 'production') throw new Error('Local report storage is disabled in production.')
    return 'local'
  }
  if (process.env.NODE_ENV === 'production' || (hasUrl && hasKey)) return 'project'
  return 'local'
}

function localPath(key: string) {
  const match = /^local\/([a-f0-9-]{36}\.(?:pdf|jpg|png))$/.exec(key)
  if (!match) throw new Error('Invalid local report key.')
  return path.join(path.resolve(env.PRIVATE_UPLOAD_DIR), match[1])
}

export function documentStorageKey(id: string, ext: string) {
  const backend = configuredBackend()
  return backend === 'project' ? `nidan-demo/${id}${ext}` : `local/${id}${ext}`
}

export async function saveDocumentObject(key: string, contentType: string, bytes: Buffer) {
  if (key.startsWith('nidan-demo/')) return putProjectObject(key, contentType, bytes)
  const filePath = localPath(key)
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  await writeFile(filePath, bytes, { flag: 'wx', mode: 0o600 })
}

export async function readDocumentObject(key: string): Promise<Buffer | null> {
  if (key.startsWith('nidan-demo/')) return getProjectObject(key)
  return readFile(localPath(key)).catch((error: { code?: string }) => error.code === 'ENOENT' ? null : Promise.reject(error))
}

export async function removeDocumentObject(key: string): Promise<boolean> {
  if (key.startsWith('nidan-demo/')) return false
  await unlink(localPath(key)).catch((error: { code?: string }) => { if (error.code !== 'ENOENT') throw error })
  return true
}
