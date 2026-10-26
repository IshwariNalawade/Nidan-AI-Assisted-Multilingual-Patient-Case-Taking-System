# NIDAN REST API (local core)

Base path: `/api`; local Vite uses a same-origin proxy to the API at `127.0.0.1:8787`. JSON endpoints use `application/json`; authenticated requests use the HttpOnly session cookie configured by `SESSION_COOKIE_NAME`.

## Authentication
- `POST /auth/register`: `{name,email,password,language?}` creates a patient account/profile. Password is hashed with bcrypt; registration never accepts a role.
- `POST /auth/login`: `{email,password}`; sets an opaque HttpOnly session cookie.
- `GET /auth/me`: current identity/role/profile.
- `POST /auth/logout`: revokes the current session and clears cookie.
- `DELETE /auth/account`: authenticated patient account deletion; requires the current password and literal `DELETE` confirmation, removes private report files, and cascades patient-owned records.

## Patient-owned APIs (patient role only)
- `GET|PATCH /patient/profile`: read/update own profile.
- `GET|PUT /patient/history`: read/update own reported medical history.
- `GET|POST /patient/assessments`: list own assessments / submit an assessment and care consent. Submitted red flags are recomputed by the API using its copy of NIDAN's safety engine, authenticated patient age/profile context and stored patient answers; client-supplied `safetyFindings` is rejected.
- `GET|PATCH /patient/assessments/:id`: access/edit own not-yet-reviewed assessment. Every accepted edit recomputes red flags; clinician-claimed cases cannot be edited by the patient.
- `POST /patient/assessments/:id/ai-consent`: records a separate, revocable per-assessment opt-in/out.
- `POST /documents`: upload a private PDF/JPG/PNG report for the signed-in patient.
- `POST /documents/:id/confirm`: save patient-corrected text as confirmed. Only confirmed text is eligible for AI use.
- `GET /documents/:id/file`, `DELETE /documents/:id`: authorized download/removal.

## Clinician APIs (doctor role only)
- `GET /doctor/cases`: own assigned cases include patient-reported details; unassigned cases return queue metadata only until atomically claimed. Results are restricted to the doctor's `organizationId`; doctors without an organization cannot claim unassigned cases. Server-derived urgent findings are surfaced first.
- `POST /doctor/cases/:id/claim`: atomically assign an available case.
- `GET /doctor/cases/:id`: assigned case with patient-reported details and documents.
- `POST /doctor/cases/:id/review`: `{status:"IN_REVIEW"|"REVIEWED",notes}` records status and clinician review separately from patient data.

Doctor accounts are not self-registered. Local synthetic doctor seeding is optional and requires an explicit strong `SEED_DEMO_PASSWORD`; production accounts need a controlled administrator process, which is not yet implemented. Never use synthetic accounts in production.

## AI / handwriting status
- `POST /ai/draft`: `{assessmentId,task?}` uses only an authorized assessment, a separate recorded AI-processing opt-in and patient-confirmed report text. When a local Ollama-compatible model is configured and returns valid structured JSON, the response is labelled `local-ai`; otherwise a rule-based summary uses actual stored data and is explicitly labelled `rule-based`. Urgent guidance is computed separately and does not wait for a model. Neither mode diagnoses or prescribes.
- `POST /ai/clinical-review`: `{assessmentId}` is doctor-only and requires an assigned, organization-scoped case. When Gemini is enabled, it returns validated structured fields for symptom parsing, English clinical translation, SOAP draft sections, 2–3 non-diagnostic follow-up questions and missing information. Triage is calculated from server-derived safety findings: RED for urgent, YELLOW for review, GREEN otherwise. Gemini cannot override those findings; when Gemini is unavailable, the endpoint returns an explicit rule-based fallback.
- The preserved staff relay's `POST /api/ai` also requires the visit-level patient opt-in envelope and an authorized staff token; the relay has shared tokens and cannot cryptographically establish which person checked a browser control. It is a pilot path, not an identity-grade production consent system.
- `GET /experimental/handwriting/status`: reports availability honestly. The project contains no handwriting-recognition model and does not claim handwriting support.
- Optional legacy relay route `POST /api/fhir` is staff-token-only and rate-limited, encrypts stored FHIR bundles with AES-256-GCM and restrictive file permissions; without a valid 32-byte base64 `NIDAN_FHIR_ENCRYPTION_KEY`, storage is refused. Relay blob deletion is staff-only. It has no FHIR decryption/download endpoint.

Every full-stack route validates the role/session server-side. Patient queries filter by authenticated ownership; doctor document access requires case assignment and organization scope. Documents are stored under a private runtime directory, never `public/`; `CLAMAV_SCAN=required` enables fail-closed ClamAV scanning. Run the explicit `npm run retention:purge` command under an institution-approved retention policy. The default deployment is not production-hardened; use HTTPS, secure cookies, durable encrypted storage, backups, MFA/SSO, formal malware scanning, incident response and institution-reviewed security/clinical governance.
