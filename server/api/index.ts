import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config.js'
import { prisma } from './db.js'

const server = createServer(createApp())
server.listen(env.API_PORT, '0.0.0.0', () => console.log(`NIDAN API listening on :${env.API_PORT}`))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)) })
})
