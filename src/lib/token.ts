// Daily queue token. Urgent cases get a "U-" token so staff can pull them forward. No identity in the token.
const KEY = 'nidan-token-v1'
export function nextToken(urgent: boolean): string {
  const day = new Date().toISOString().slice(0, 10); let n = 0
  try { const r = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { d?: string; n?: number }; n = r.d === day ? r.n ?? 0 : 0; localStorage.setItem(KEY, JSON.stringify({ d: day, n: n + 1 })) } catch { n = Math.floor(Math.random() * 900) }
  return `${urgent ? 'U' : 'T'}-${String(n + 1).padStart(3, '0')}`
}
