/** Parse a comma-separated browser connect-src allowlist. Cross-origin production calls must use exact HTTPS origins. */
export function parseCspConnectOrigins(input: string): string[] {
  const origins = new Set<string>()
  for (const value of input.split(',').map((item) => item.trim()).filter(Boolean)) {
    let url: URL
    try { url = new URL(value) } catch { throw new Error('APP_CSP_CONNECT_ORIGINS must contain exact HTTPS origins.') }
    if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('APP_CSP_CONNECT_ORIGINS accepts only exact HTTPS origins without paths, credentials, queries or fragments.')
    }
    origins.add(url.origin)
  }
  return [...origins]
}

export function cspConnectSources(origins: readonly string[]): string[] {
  return ["'self'", ...origins]
}
