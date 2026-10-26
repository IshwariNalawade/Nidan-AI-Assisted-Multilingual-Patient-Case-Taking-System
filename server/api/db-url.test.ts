import { describe, expect, it } from 'vitest'
import { prismaDatasourceUrl } from './db-url.js'

describe('Prisma database URL policy', () => {
  it('requires certificate-validated TLS for non-loopback MySQL', () => {
    const result = new URL(prismaDatasourceUrl('mysql://user:pass@managed.example/nidan?ssl=true')!)
    expect(result.searchParams.get('sslaccept')).toBe('strict')
    expect(result.searchParams.get('ssl')).toBe('true')
  })

  it('leaves local MySQL and missing URLs unchanged', () => {
    const local = 'mysql://nidan:local@localhost:3306/nidan'
    expect(prismaDatasourceUrl(local)).toBe(local)
    expect(prismaDatasourceUrl(undefined)).toBeUndefined()
  })
})
