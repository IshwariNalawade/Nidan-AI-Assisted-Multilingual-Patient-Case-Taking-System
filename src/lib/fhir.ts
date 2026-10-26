// HL7 FHIR R4 transaction Bundle (ABDM-style structure). Built locally; sent only when VITE_FHIR_ENDPOINT is configured.
import type { Session } from '../model'
import { assessSession, summaryText } from './report'
import { makeUi } from '../i18n'
const uid = () => 'urn:uuid:' + crypto.randomUUID(), b64 = (x: string) => btoa(unescape(encodeURIComponent(x)))
export function toBundle(s: Session) {
  const pid = uid(), ref = { reference: pid }, e = (r: { resourceType: string }, id = uid()) => ({ fullUrl: id, resource: r, request: { method: 'POST', url: r.resourceType } })
  const E: ReturnType<typeof e>[] = [e({ resourceType: 'Patient', name: [{ text: s.profile.name }], gender: s.profile.sex === 'male' ? 'male' : s.profile.sex === 'female' ? 'female' : 'unknown', telecom: s.profile.phone ? [{ system: 'phone', value: s.profile.phone }] : [] } as never, pid)]
  if (s.consentLog) E.push(e({ resourceType: 'Consent', status: 'active', scope: { text: 'patient-privacy' }, patient: ref, dateTime: s.consentLog.at, policyRule: { text: s.consentLog.version }, performer: [{ display: s.consentLog.by }] } as never))
  if (s.concern) E.push(e({ resourceType: 'Condition', subject: ref, code: { text: s.concern }, note: [{ text: 'Patient-reported via NIDAN; unverified until clinician review' }] } as never))
  if (s.answers.hist_allergy) E.push(e({ resourceType: 'AllergyIntolerance', patient: ref, code: { text: s.answers.hist_allergy } } as never))
  if (s.answers.hist_meds) E.push(e({ resourceType: 'MedicationStatement', status: 'unknown', subject: ref, medicationCodeableConcept: { text: s.answers.hist_meds } } as never))
  for (const f of assessSession(s).urgent) E.push(e({ resourceType: 'Flag', status: 'active', subject: ref, code: { text: f.label } } as never))
  for (const d of s.docs) E.push(e({ resourceType: 'DocumentReference', status: 'current', docStatus: d.verified ? 'final' : 'preliminary', subject: ref, description: d.name, content: [{ attachment: { contentType: 'text/plain', title: d.name, data: b64(d.text) } }] } as never))
  const text = summaryText(s, makeUi('en-IN')).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  E.push(e({ resourceType: 'Composition', status: s.reviewedAt ? 'final' : 'preliminary', type: { text: 'Pre-consultation history' }, subject: ref, date: s.reviewedAt || s.startedAt, title: 'NIDAN summary', section: [{ title: 'Summary', text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml"><pre>${text}</pre></div>` } }] } as never))
  return { resourceType: 'Bundle', type: 'transaction', timestamp: new Date().toISOString(), entry: E }
}
export async function pushFhir(s: Session): Promise<boolean> {
  const url = (import.meta.env as unknown as Record<string, string>).VITE_FHIR_ENDPOINT; if (!url) return false
  try { return (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(toBundle(s)) })).ok } catch { return false }
}
