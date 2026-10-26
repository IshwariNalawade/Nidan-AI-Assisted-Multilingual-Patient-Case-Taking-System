const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1'])

export function prismaDatasourceUrl(value?: string): string | undefined {
  if (!value) return undefined
  const url = new URL(value)
  if (url.protocol === 'mysql:' && !loopbackHosts.has(url.hostname.toLowerCase())) {
    url.searchParams.set('sslaccept', 'strict')
  }
  return url.toString()
}
