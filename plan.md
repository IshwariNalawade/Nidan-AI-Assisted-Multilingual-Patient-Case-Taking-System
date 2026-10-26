# NIDAN — Patient-First Healthcare Intake

> Historical source notes: the statements in this original section describe the uploaded ZIP **before** the full-stack upgrade documented below. For current commands and configuration, use `README.md` and `docs/WINDOWS-SETUP.md`.

## Original application as received in the ZIP

React 18 + TypeScript + Vite. The original kiosk was browser-first; it had no account API or persistent application database. Its original startup and OCR behavior are recorded as source-history, not current instructions.

## The original 16-step intake flow
01 Welcome · 02 Language · 03 Patient · 04 Register · 05 Consent · 06 Consultation type · 07 AYUSH system (skipped for General) · 08 Main concern · 09 Where does it hurt (body map) · 10 Ayurvedic history (skipped for General) · 11 Questions · 12 Reports · 13 Safety check · 14 Summary · 15 Doctor review · 16 Complete.
Header buttons: Help, Hackathon demo (fills a fictional patient — it never pre-ticks consent), Start over.

## Structure
```
src/App.tsx                 shell: header, sidebar, step routing, voice provider, safety banner
src/i18n.ts                 UI dictionary (en / mr / hi) — add keys here
src/model.ts                session model + the 16 steps
src/components/Voice.tsx     VoiceInput (field + speaker + mic + confirm bar), ChoiceMic, GuideCard
src/components/Frame.tsx     page frame, validation, auto read-aloud, confirm-before-advance
src/components/Steps1.tsx    steps 01-09     Steps2.tsx  steps 10-16
src/components/Camera.tsx    camera scanner + trim
src/lib/voice.ts             SpeechRecognition / speechSynthesis wrappers
src/lib/ocr.ts               Tesseract.js (images), pdf.js text layer + OCR fallback (PDF), rule-based field finder
src/lib/report.ts            question queue, safety scan, summary builder, download
src/data/                    22+English language list, 11 clinical modules (from the original project), mr/hi question translations
tests/                       automated tests
```

## v3 additions
- **Languages:** English, Marathi, Hindi fully translated. **Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu, Nepali:** 85 core strings each (navigation, consent, safety/emergency, voice, alerts, returning-patient question) — **machine-drafted, shown as "draft translation", not reviewed by native speakers**. Clinical question wording is still Marathi/Hindi/English only. **Dogri, Bodo, Kashmiri, Manipuri, Santali, Sindhi, Sanskrit, Maithili, Konkani:** not translated (English UI) — I did not generate medical/consent text I could not stand behind. `npm run translation-sheet` / `import-translations` is the workflow to close the gap.
- **Returning patients:** "How are you feeling now?" (better / same / worse / new), "what changed", current medicines/allergies. "Worse" is passed to staff as a review item.
- **Staff-held history:** master history per patient (conditions, allergies, medicines, notes) + visit timeline, encrypted, staff-only, linked by a keyed hash of the phone.
- **Hospital-local data and AI:** blind ciphertext hub, local-model gateway that refuses non-local hosts and de-identifies, separate optional research consent, de-identified export. See docs/LOCAL-AI.md.

## Status by problem (honest)
| Area | State |
|---|---|
| Red-flag matching: negation, spelling/romanised/code-mixed variants, evidence shown | **Done**, 58 automated cases. Lexicon is a **draft**: needs a clinician (docs/REVIEW.md) |
| Staff alerts: token-based, instant on same device, webhook / relay server for other devices, queued + retried, "patient left" escalation | **Done** (relay tested against a local server). Real messaging gateway not included |
| Child / infant / pregnancy / elderly handling, proxy answering, guardian consent | **Done** (rules are draft, need clinical review) |
| Clinical review | **Tooling only** — `npm run review-sheet`, docs/REVIEW.md. Sign-off must come from humans |
| Encryption at rest, no default PIN, lock-out, auto-lock, consent log, patient deletion, retention, audit chain, voice opt-in | **Done** (see limits in docs/DEPLOYMENT.md) |
| Voice offline / accuracy in noise | **Not solvable in code.** On-device recognition is attempted where the browser supports it; typing always works; test protocol provided |
| Language coverage | **Honestly labelled**: 3 fully translated, 20 English UI; per-language voice/OCR matrix on the About page |
| OCR offline + originals kept + low-confidence/handwriting warning | **Done** for English/Hindi/Marathi (bundled, verified on a printed sample). Handwriting still unreliable |
| Extraction | Still keyword rules; now marked UNVERIFIED and staff tick "checked against original" |
| Real-device testing | **Not done by me.** Self-test page + protocol provided |
| Hospital/ABDM link | FHIR export + optional endpoint POST + relay server. **No real ABDM integration** |
| Time-saving evidence | Anonymous metrics built in; **numbers must come from your pilot** |
| Accessibility | Text size, high contrast, keyboard/ARIA, axe checks pass; no user testing yet |
| Demo risks | Self-test page, mic status messages, demo banner, "what is real" page |

## Tests
`npm test` → 116 automated tests (safety engine, vault, audit, alerts, privacy flows, full intake, axe). Real OCR was additionally verified outside the test suite on a printed prescription image.


# Full-stack upgrade plan (2026-10-20)

## Source audit and constraints
The source of truth is the user's uploaded `nidan-updated-bhashini.zip` (React 18, TypeScript, Vite; 16-step kiosk; voice helpers; OCR; safety rules and alerts; staff console; browser vault; relay and optional local-AI code; FHIR export). The initialized project directory was inspected before import and contained only Git metadata. The archive's files have now been copied into it with no-clobber semantics; `.git` was preserved. No UI screenshots accompanied the archive. Clinical rules remain draft and require human review; handwritten OCR is not present and must remain explicitly experimental until a real engine is integrated and tested.

## Implementation approach
Preserve the existing kiosk and its visual identity. Keep the authenticated patient/doctor web portal and backend services as a separate experience rather than replacing the kiosk flow. The hosting project already has Manus-managed MySQL enabled; adapt the Prisma datasource and schema/migrations to MySQL instead of introducing an unprovided external PostgreSQL service. Store `bodyRegions` as JSON because the original PostgreSQL string-array type is not portable to MySQL. Use strict certificate-validated TLS for hosted MySQL Prisma connections while leaving local loopback MySQL unchanged. Use a Node/Express TypeScript API, server-side session records, role/ownership checks, and Vite development proxying. Change local Docker Compose and `.env.example` to MySQL so the same schema works outside the hosted environment. Keep the existing optional encrypted browser vault and relay behavior for kiosk/offline operation; clearly distinguish that storage from database-backed authenticated records. Do not migrate or delete browser-stored records silently.

Persist users, patient profile, consent, assessments/answers, medical history, document metadata, clinician review and audit events. Passwords are hashed; opaque session tokens are random, stored only as hashes, and held in HttpOnly cookies. Enforce patient ownership and doctor role authorization in backend middleware and queries. Store report blobs in Manus project object storage and metadata in MySQL; only issue an authorized report read after server-side ownership checks. The runtime storage API cannot physically delete objects, so the demo must not promise physical erasure and must never be used for real patient data. Existing PDF/image OCR remains a real client OCR/text extraction path; text stays machine-extracted until the patient or clinician confirms it. Do not claim handwriting recognition unless a supported model/service is actually connected and tested.

Create a provider-neutral DATA → PROMPT → AI → OUTPUT service that gathers only relevant confirmed assessment/report text, removes unnecessary identifiers, labels source and uncertainty, and produces a structured non-diagnostic draft. A configured provider may be a local Ollama-compatible server; absent configuration, only the transparent rule-based summary is available and is labelled as such—not as AI. Urgent safety guidance stays in the existing rules path and never waits for AI.

## Delivery phases
1. Restore and verify the original app (done); retain its existing routes, scripts, tests, design and safety behavior.
2. Add backend/database/auth foundation and a first persistent patient-assessment flow; keep guest kiosk usable and emergency guidance available without account creation.
3. Add patient portal and doctor case review with server-enforced access, history and report/document links.
4. Connect existing voice, OCR review/confirmation and reports to persisted records; add optional AI provider adapter and honest non-AI fallback; keep handwriting recognition experimental unless actually available.
5. Run build/tests and API/auth/persistence checks; document external/clinical/device tests not completed; add Windows CMD setup, environment placeholders, migrations and synthetic seed instructions; package the complete source ZIP.

## Project structure
- `src/`: retain the NIDAN kiosk components, translations, styles and existing `lib/` feature modules; add API client, account portal, patient dashboard and doctor UI as separate modules.
- `server/`: retain `server.mjs` as the existing minimal relay; add a typed Express application, middleware, REST route modules, auth/session, document handling and AI workflow modules.
- `prisma/`: MySQL schema, migrations and synthetic development seed.
- `server/api/routes/documents.ts`: authenticated upload metadata and ownership-gated access to project object storage; no patient-report bytes in the container filesystem.
- `tests/`: preserve current tests and add API, authorization, persistence and integration tests.
- `docs/`: setup/security/AI/OCR/testing notes, including explicit unverified clinical and handwriting status.

## Design and product constraints
Continue the existing NIDAN visual system—warm cream panels, dark teal/navy surfaces, orange highlights, rounded cards, accessible large touch targets, guided progress and patient-friendly language. Retain existing logo, page structure and kiosk interaction wherever possible. New authenticated portal pages reuse the same type, palette, button and panel primitives; avoid introducing a competing theme. Use keyboard-accessible focus, responsive layout, explicit loading/empty/error/success states and visible safety/disclaimer language. This is an information-collection and clinician-review system, not a diagnostic or treatment product.

## Approved hosting scope (2026-10-23)
Publish the full kiosk and patient/doctor portal as a demo prototype using the already-enabled Manus-managed MySQL database and platform project object storage for document blobs. Add a prominent warning in the kiosk and account/portal screens in English, Marathi, and Hindi: fictional data only; do not enter real patient or health information. Do not present the deployment as production-ready or clinically validated. The original deployment note about institutional review remains in force; real health data, clinician workflows, and production clinical use are out of scope. Keep the optional Bhashini integration disabled unless real approved credentials are supplied; retain the documented browser voice and local OCR fallbacks.


## Follow-up enhancement plan (2026-10-23)

Preserve the existing published React/Vite kiosk, patient and doctor portals, Express API, MySQL schema/data, private project-storage document flow, translations, safety rules, and fictional-data warning. This is an additive continuation, not a rebuild or a replacement of earlier functionality.

### OCR recovery
Use the already-bundled Tesseract worker, WASM cores, and English/Hindi/Marathi traineddata for every OCR attempt. When the patient's selected OCR language is one of those packs, run locally without network. For another selected language, try its normal Tesseract traineddata with a bundled local worker/core; if the language download fails, retry the scan with the locally bundled English model and report which language was actually used. Expose a clear fallback note and keep editable, unverified extracted text; do not describe English fallback as native-language recognition. Typed input remains available after genuine OCR failure. Test both successful local recognition setup and failed remote-language initialization with fallback.

### Symptom/condition questions
Retain the existing selectable symptom modules and their question IDs/answers. Make every selectable module explicitly flow into its own adaptive follow-up queue, and add patient-reported symptom categories for common blood sugar, blood pressure, eye, ear/nose/throat, dental, allergy, menstrual/reproductive, and injury concerns. Questions gather onset, course, relevant measurements/exposures, associated symptoms and safety concerns; they do not diagnose or prescribe. Keep English question text and draft Hindi/Marathi question translations keyed by stable answer IDs, clearly subject to clinical/native-speaker review. Ensure selection resets stale category answers, back/edit navigation still works, and submitted summaries/review queues include the selected category's questions.

### Persistent returning-patient drafts
After a signed-in patient grants existing care consent, debounce-save their non-demo, self-authored in-progress intake (language, profile, selected category, answers, current step and timing) into their own MySQL assessment row with status DRAFT. Do not send data URLs, original image bytes, session cookies, or secret values in the JSON draft. Add owner-scoped draft listing/retrieval, show drafts in the patient dashboard, and resume at the saved step. On final kiosk submission, atomically transition the matching draft to SUBMITTED, persist the final answer/safety summary and consent, clear transient draft JSON, and avoid duplicate records. Do not alter, overwrite, or delete other users' records. Existing profile, history, uploaded report, history/timeline, and patient registration/login functions remain unchanged.

### Staff triage role and workflow
Add a STAFF role that cannot be self-registered. Protect a new staff portal and every staff API with server authentication and role enforcement. Provide a minimal patient queue with symptom/answer summary, server-derived draft safety findings, urgency-first priority ordering, triage state and notes; expose no report blob or unauthorised doctor-only detail. Permit staff to mark a case triaged and refer it to an existing organization so organization-scoped doctors see it in their existing queue; record actor/timestamps and audit events. Provide an administrator-only command-line staff provisioning path, never public default credentials. Keep existing patient/doctor data access boundaries and doctor claim/review/status workflows intact.

### Schema, validation, and delivery
Use only additive MySQL migration changes for STAFF, draft JSON, and triage metadata; preserve existing records. Test route authentication/ownership, draft resumption/submission, triage sorting/referral, and OCR local fallback without writing test records to shared managed production data. Run database schema validation, Prisma generation, frontend and server builds, API tests and relevant existing regression tests. Publish only the successful new checkpoint, and provide a source ZIP that excludes `.env`, credentials, `.git`, node_modules, and build artifacts. Keep the public fictional-data-only notice on every portal and do not claim clinical validation or production readiness.


## Dashboard experience refresh (approved 2026-10-24)

Keep the existing role-authenticated Doctor and Staff portals, server APIs, case data, and actions. Refresh only their workspace presentation and information hierarchy. The Doctor portal becomes a calm clinical workbench: organization context and queue metrics, easy-to-scan authorized cases, clear patient-reported history and safety evidence, report status/OCR method/confidence with an explicit patient-confirmed versus unverified-text label, and a focused review panel for notes/status and print. The Staff portal becomes a separate operations-style triage/review desk with its own accent and hierarchy for urgent-first queue scanning, concise intake/safety summaries, triage notes, and organization referral. Both stay within NIDAN's existing light clinical palette and wordmark, retain prominent fictional-data-only warnings, and remain responsive and keyboard-operable. Do not add decorative imagery or alter backend permissions/clinical logic. Keep the existing root route manifest because both role workspaces are hash-routed views under `/`.

Implementation stays in `src/components/Portal.tsx` and the portal-specific rules appended in `src/styles.css`, with focused portal workflow regression tests in `tests/portal-workflows.test.tsx`. Reuse the authenticated role gates, API routes, MySQL-backed cases, and current status/triage controls. After implementation, run host TypeScript diagnostics, the dashboard workflow test, full frontend/API test suites and `npm run build:all`; push an attributed checkpoint to canonical `origin/main`, request explicit publication confirmation, then verify the published deployment and refresh the source ZIP.


## Approved 23-language localization expansion (2026-10-24)

Extend the existing static, offline-capable localization system to every one of the 23 languages in `src/data/languages.ts`: English, Hindi, Marathi, and the other 20 current picker entries. Preserve existing English/Hindi/Marathi wording as the baseline. Complete all kiosk, local staff-console, help/about/self-test/accessibility, account/patient/returning-patient, doctor and staff-triage interface strings. Add translated symptom/module names, descriptions, all question prompts, helpers, choices and placeholders for every existing stable question ID. Keep the workflow static and browser-local; do not add live translation calls or transmit patient content to translation services.

Use stable keyed locale resources rather than conditionals embedded in JSX. Reuse `src/i18n.ts`/`src/locales.json` for core interface copy, expand the CSV translation-sheet and importer for every locale and product surface, and add a typed clinical/localized catalog keyed by existing `SymptomKey`/question IDs. Add a shared portal locale context and selector that retains the user’s choice on-device across authenticated portal routes; default patient display to a valid saved preferred language, then the persisted portal choice, then English. Continue using the selected kiosk language for the intake. Set correct document `lang`/`dir`; provide RTL layout for Urdu and Sindhi while preserving left-to-right language codes, numbers and technical identifiers as appropriate. Keep all current API payloads, role gates, question IDs, safety rules, warning meanings, answer IDs and persisted user answers unchanged.

Preserve the existing published NIDAN visual identity and responsive/keyboard-accessible controls. Keep English/Hindi/Marathi review status unchanged. For newly generated translations, label the interface and language capability matrix as draft / needs native-speaker review; medical questions, consent and emergency warnings additionally require qualified clinical-language review before real-world use. Do not claim that translated UI adds speech recognition, speech synthesis or OCR support in that language.

Localization modules: `src/i18n.ts` and `src/locales.json` for keyed UI strings; `src/data/clinical.ts`, `src/data/qtr.ts`, `src/data/qlocales.json` and a typed localized clinical catalog for symptom/question text; a shared `src/components/PortalLocale.tsx` context/provider for portal settings; `src/components/Portal.tsx`, `RoleWorkspaces.tsx`, kiosk/Staff/Tools components consume the translator; `scripts/translation-sheet.ts`, `import-translations.ts` and `validate-languages.ts` export, merge and verify every supported locale. Continue serving only the existing root route manifest because localization does not add page routes.