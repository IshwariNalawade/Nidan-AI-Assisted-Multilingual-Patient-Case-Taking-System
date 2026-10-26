// Patient key: links a patient's visits WITHOUT storing the phone number in the clear on the kiosk.
// HMAC-SHA256(device pepper, phone digits or demo ABHA id). Honest limit: the pepper lives on the same device, so this is
// pseudonymisation, not anonymisation; staff can always see the real phone inside the encrypted record.
const PEPPER = 'nidan-pepper-v1'
const b64u = (u: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(u))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export async function patientKey(phone: string, abha = ''): Promise<string> {
  const digits = phone.replace(/\D/g, '').slice(-10), basis = digits.length === 10 ? `p:${digits}` : abha.trim() ? `a:${abha.trim().toUpperCase()}` : ''
  if (!basis) return ''
  let pep = ''; try { pep = localStorage.getItem(PEPPER) ?? ''; if (!pep) { pep = b64u(crypto.getRandomValues(new Uint8Array(32)).buffer); localStorage.setItem(PEPPER, pep) } } catch { pep = 'volatile' }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pep), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(basis))).slice(0, 22)
}
