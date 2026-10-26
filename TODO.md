# NIDAN full-stack upgrade — TODO

## Preserve the existing NIDAN kiosk and feature set
- Retain the ZIP's React 18/TypeScript/Vite app, branding, styles, accessibility controls and 16-step intake flow: welcome, language, patient, registration/demo ID, consent, consultation type, AYUSH system, main concern, body map, AYUSH history, questions, reports, safety, summary, doctor handoff and completion.
- Preserve General/AYUSH conditional steps, returning-patient flow, child/proxy/guardian consent, pregnancy questions, express/staff-assisted modes, voice opt-in, touch and typed alternatives, urgent alerts, staff console, existing OCR, encrypted browser vault, relay, audit, metrics and FHIR export.
- Do not silently remove or migrate/delete browser-stored records; preserve the original project files and tests. No screenshots were supplied, so use the current UI as the reference.

## Managed MySQL API and persistent records
- Use the already-enabled Manus-managed MySQL database with a Node.js/Express/TypeScript REST API and Prisma schema/migrations, relations and indexes; store `bodyRegions` as JSON rather than PostgreSQL-only arrays.
- Persist application users/roles, patient profiles, consent, assessments and answers, medical history, report metadata, doctor reviews/status and audit records.
- Provide `.env.example`, local MySQL setup, exact Windows CMD commands, migrations, safe synthetic development seed instructions and API documentation. Never commit live secrets or real patient data.
- Validate all inputs server-side, return useful errors, use safe DB access, and retain data after server/application restarts.

## Authentication and role-based privacy
- Implement patient registration, login, logout, password hashing, server-side session management, protected routes and editable patient profiles.
- Implement separate authorized doctor access; enforce access control on every sensitive API endpoint and query, not only in the UI. Patients may access only their own records; doctors see only authorized cases. Patients cannot modify clinician notes/reviews.
- Use HttpOnly session cookies and CSRF/origin protection appropriate to the cookie policy. Do not expose credentials, tokens, patient records or secrets in browser bundles/logs. Keep guest kiosk intake and emergency guidance available without forcing account registration.

## Assessment, patient portal and clinician review
- Connect the existing symptom interview to persisted assessments; retain approximately 10–11 symptom categories, onset/duration/severity/progression and relevant follow-up questions, editable/back navigation, unanswered/missing information and structured summaries.
- Add an authenticated patient dashboard showing the user's profile, assessment history/timeline, summaries, reports, allergies/medicines and appropriate status; include loading, empty, error, search/filter and recovery states where appropriate.
- Add a doctor dashboard for authorized cases with patient-reported symptoms/history, allergies, medicines, uploaded reports, red flags, missing information, review/edit of summaries, notes, case status and review timestamp. Clearly distinguish patient-provided data, OCR text and clinician-entered notes.
- Keep synthetic demo records visibly marked and separate from real patient records.

## Secure documents, OCR and experimental handwriting module
- Support PDF, JPG, JPEG and PNG with file type/size limits, upload progress/errors, durable project object storage, database metadata, per-patient authorization, report history/view/removal and no public static document URLs; accurately disclose that the runtime object-storage API does not physically delete blobs and do not promise physical erasure.
- Keep real PDF text extraction and OCR; preserve originals and show extraction method/confidence. Show extracted text for correction; mark it machine-extracted and unverified until confirmed. Never fabricate values or interpretations.
- Connect only relevant confirmed report text to assessment/AI workflows. Handle empty/unsupported/error cases gracefully.
- Investigate handwriting recognition separately. Integrate a real local/open-source model or documented service only if it actually supports handwriting; otherwise expose a clearly marked experimental/unavailable state and document dependencies/privacy/cost. Do not use fake OCR, hardcoded text or claim handwritten recognition works. Do not require a live Colab notebook for the website.

## Multilingual voice experience
- Preserve and improve speech input/read-aloud for registration, symptoms and applicable forms, prioritizing English, Hindi and Marathi. Include start/stop/retry/edit/confirm, transcript-to-correct-field behavior, voice-guided adaptive questions, typed fallback, permission/unsupported/network/empty-result/error handling and duplicate-submission protection.
- Keep voice opt-in and clearly disclose whether recognition uses browser-vendor cloud services. Never claim offline recognition without device/browser verification.
- Language selection must persist through navigation and relevant sessions. Translate navigation, forms, validation, assessment questions, alerts, dashboard/report labels and consent for supported languages; clearly label partial/draft/fallback coverage, use appropriate fonts and do not mark a language fully supported when translations are missing.

## DATA → PROMPT → AI → OUTPUT and safety
- Build a real integration layer that constructs context-aware structured prompts from actual available and consented data, uses selected language/context, sanitizes/de-identifies unnecessary personal information, handles missing information, and returns structured source-labelled output.
- Use a configured provider only when available. If no provider/API key/model is configured, show a transparent rule-based result labelled as rule-based—not as AI. Document configuration and potential cost. Do not hardcode an AI response or claim an AI model was called when it was not.
- AI output is informational, non-diagnostic and clinician-reviewed; include uncertainty, missing information, source provenance and appropriate care-seeking language. Never delay red-flag safety guidance pending AI. Do not diagnose or prescribe.
- Keep red-flag rules transparent and draft until a clinician signs them off. Preserve prompt evidence, negation handling and code-mixed matching; add clinician-reviewed cases before claiming validated triage. Include visible emergency guidance and 112 where applicable.

## Reports, exports and interoperability
- Produce summaries from actual saved records with assessment date, symptoms/timeline, answers, history, allergies/medicines, document references/confirmed text, missing information, red flags/disclaimer and doctor-review status.
- Provide print-friendly output and a tested PDF download, or accurately document print-to-PDF if direct PDF generation is not implemented. Keep exports aligned to saved records.
- Preserve FHIR R4 export/optional endpoint integration and label ABDM/HIP as not integrated until real credentials and end-to-end tests exist.

## Verification, documentation and final ZIP
- Preserve and run existing tests; add relevant backend/API tests for auth, role isolation, patient ownership, persistence across restart, assessment create/edit/retrieve, upload/access, OCR failures, language switching, voice fallback, doctor review and reports.
- Run dependency installation, TypeScript checks, frontend build, server build and available tests; fix observed errors. Test actual app/API interactions where the environment permits. Explicitly list clinical, human-review, hardware, external-service and handwriting tests not run.
- Reconcile README test-count/setup inconsistencies and verify environment names/commands against the final source. Document current limitations honestly.
- Deliver the working website link after a successful publication. The user explicitly requested deployment, and authorized a full demo portal using managed MySQL and project object storage with a prominent fictional-data-only warning. Do not claim production readiness or clinical validation; do not claim any feature works merely because source exists.

## Demo-only safety and deployment
- Preserve the full kiosk, patient portal, and doctor portal; prominently warn visitors in English, Marathi, and Hindi that the public deployment is a prototype for fictional data only and must not receive real patient/health information.
- Use the Manus-managed MySQL capability already enabled for this project; keep database migrations compatible with MySQL and avoid using the database for live production patient data.
- Store report bytes in Manus project object storage, retain ownership metadata in MySQL, authorize reads through the application, and disclose the runtime storage API's lack of physical-delete support.
- Publish a container serving the site and API, use an unauthenticated `/api/health` health route, keep Bhashini disabled until approved credentials exist, and do not describe the site as production-ready or clinically validated.

## Optional BHASHINI/ULCA integration
- **Implemented in this working copy:** server-only Bhashini pipeline-config and inference client; rate-limited `/api/bhashini/asr` and `/api/bhashini/tts` proxy routes; opt-in frontend ASR/TTS flags; existing browser voice, typing, touch, and local OCR fallbacks preserved; setup and privacy boundary documented in `docs/BHASHINI.md`.
- **Not yet provider-validated:** no real `BHASHINI_USER_ID` or `BHASHINI_API_KEY` was supplied or stored; no live pipeline-config/inference call was made; target-device microphone, WebM/Opus acceptance, provider retention, quotas, native-speaker quality, and institutional privacy review remain open.
- **ZIP snapshot validation (historical, before this managed-MySQL continuation):** `npm run test:api` passed 10 backend tests with the PostgreSQL persistence test skipped; `npm run build:all` passed; the original PostgreSQL test database schema validated; `npm audit --omit=dev` reported 0 vulnerabilities; Vite returned HTTP 200. The archived full-suite note recorded 127 passed, 1 skipped, and one timing-sensitive full-intake failure. These are source-ZIP records, not current managed-database tests.

## Managed demo continuation status (2026-10-23)
- **Managed database:** converted Prisma to MySQL with `bodyRegions` stored as JSON, preserved PostgreSQL SQL under `prisma/legacy-postgresql-migrations/`, generated a MySQL baseline, and applied the initial and additive patient-draft/staff-triage migrations over strict TLS. The final Prisma migration status reports both migrations applied and the schema up to date; no patient, account, or sample records were inserted. Runtime and administrative Prisma clients require certificate-validated TLS for non-loopback MySQL.
- **Hosted report storage:** the application uses Manus project object storage for hosted report blobs and MySQL for metadata; authorization remains in the API. Storage API calls have mocked tests, but no hosted object was uploaded because the runtime API cannot physically erase objects. The UI and README disclose this deletion limitation.
- **Preview and safety:** English/Hindi/Marathi prototype warnings are included in the kiosk and portal. API health and `/manus-routes.json` returned HTTP 200; invalid account requests were rejected for localhost and the exact Preview origin before database writes. Preview cookies were verified `Secure; SameSite=None`. The ignored Preview `.env` contains only public-origin/cookie/storage settings, no credentials.
- **Current checks (2026-10-23):** `npm run db:validate`, `npm run db:generate`, and `npm run db:deploy` succeeded; `npx prisma migrate status` reports both migrations applied; `npm run build:all` passed; `npm test` passed 169 with 1 skipped; `npm run test:api` passed 32 with 1 skipped; `npm run languages:validate` validated 23 language entries. A real Chromium browser smoke test read a synthetic report image using the locally bundled English/Hindi/Marathi packs with no fallback. The one persistence integration test remains skipped to avoid writing test records to the managed database shared with publication. No hosted object upload, live Bhashini call, or clinical/device validation was run.
- **Dashboard refresh checks (2026-10-24):** `npm test -- --reporter=dot` passed 170 tests with 1 skipped; the portal workflow test passed all 3 cases, including doctor claim/review and staff triage/referral using mocked API calls; it also verifies that unconfirmed report OCR is explicitly labeled as an unverified preview. `npm run test:api -- --reporter=dot` passed 32 with 1 skipped; `npm run build:all` passed. No managed database writes were made. The preview health route and unchanged page route manifest both returned HTTP 200. No real doctor/staff account or production patient data was used for visual/browser testing.
- **Release verification:** the dashboard refresh was published successfully as application version `31c7aa0374fb5e699f15dd8f82a8fd214c32b093` at `https://nidanapp-njbfdvon.manus.space`. The documentation-only release-status correction does not change the deployed app.
- **Still open:** no clinician demo account is provisioned; doctor and staff accounts require the documented trusted administrator CLI provisioning path, with no public default credentials. Bhashini remains disabled without approved credentials; no live hosted document upload was exercised; password reset/email verification, external/device testing, clinical review, and production readiness remain out of scope for this fictional-data demo.

## Imported ZIP snapshot implementation status (2026-10-20; historical, not current hosted validation)
- **Preserved kiosk and existing feature set — implemented.** Original intake components and flows remain in place; frontend and original regression suite build/run successfully.
- **PostgreSQL/authenticated core — implemented and integration-tested locally.** Prisma migration applied to a sandbox-only `nidan_test` database; registration, hashed-password login/session cookie, profile/history, assessment idempotency, patient isolation, doctor role/claim/review, database reconnect persistence and logout passed.
- **Private report storage — implemented and integration-tested locally.** PDF signature validation, private file access control, patient OCR-text confirmation, patient-owned deletion and doctor access after assignment passed. Storage is a local private directory, not a durable cloud object store.
- **AI and emergency behavior — implemented with limitations.** The API accepts no client-supplied safety flags; it recomputes red flags from patient answers and authenticated profile. PostgreSQL integration verifies a forged urgent flag is rejected and chest pain is recomputed as urgent. The original staff AI panel now has a separate default-off per-visit consent; its shared-token relay checks the consent envelope but is not identity-grade consent. FHIR relay storage uses AES-256-GCM and refuses unkeyed writes. The optional Ollama response path was not tested against a running model, and safety rules remain drafts pending clinical validation.
- **Patient/doctor UI, print and handwriting status — implemented.** Dashboard pages, patient history, case review, notes, print-to-PDF through the browser and a separate unavailable handwriting status are present. No browser/device print interaction was exercised.
- **Voice, OCR, language coverage, additional reports/interoperability — partial.** Original kiosk voice/OCR/FHIR features were preserved; this work did not independently verify microphone, camera, native speech service, OCR on new real-world samples, translations in the new portals, FHIR from the database-backed portal, or any ABDM endpoint.
- **Remaining open:** actual handwritten recognition engine; reviewed portal translations for English/Hindi/Marathi; external browser/device and microphone/camera testing; clinical/triage sign-off; tested direct PDF generation (currently print-to-PDF); institutional security/retention/backups and production object storage; password reset/email verification and web-based doctor administration; deployment/ABDM integration.
- **Automated checks:** `npm run build:all` passed; the normal suite passed 127 tests (one opt-in integration test is skipped unless explicitly enabled); `npm audit` reported zero vulnerabilities. The opt-in PostgreSQL integration test was not rerun in this continuation because Docker is unavailable in the current sandbox. Container image build was not run for the same reason.


## Follow-up enhancements requested (2026-10-23)

### OCR recovery and honest fallback — COMPLETE (2026-10-23)
- Recover from the reported “Reading failed (Failed to fetch). OCR language data is downloaded on first use and needs an internet connection” failure. Use the existing bundled OCR worker/WASM and English, Hindi, Marathi traineddata locally where applicable; OCR for these packs must not require internet access.
- For a selected language without a bundled traineddata pack, keep the local worker/core, attempt the selected language where available, and if that traineddata fetch fails retry with local English OCR instead of failing the entire read. Show an explicit notice naming the fallback language; never claim the fallback is native-language recognition.
- Preserve PDF text extraction, image OCR, patient-editable extraction, typed-text fallback, confirmation before report text is trusted, and original document handling. Genuine OCR failures must still give an actionable retry/type message.

### Symptom categories and condition-specific follow-ups — COMPLETE (2026-10-23)
- Keep every current selectable symptom category and its existing question IDs, safety prompts, answer editing, back navigation, language selection, and final summary. Every displayed category must have its own follow-up questions after selection; changing selection must clear only stale answers for the previous symptom module.
- Add selectable patient-reported categories for high blood sugar/diabetes concern, high blood pressure, eye symptoms, ear/nose/throat symptoms, dental/mouth symptoms, allergy reaction, menstrual/reproductive symptoms, and injury/wound symptoms. Provide category-specific follow-up questions about onset/course and relevant associated symptoms or measurements. These are intake categories only and must not diagnose or prescribe.
- Add Hindi and Marathi draft labels for the new follow-ups, preserve question answer IDs in saved assessments and clinician review, and clearly mark non-reviewed clinical translations/rules as requiring human review.

### Returning patient drafts — COMPLETE (2026-10-23)
- Keep patient registration, secure login/logout, editable profile, preferred language, medical history (conditions, allergies, medicines, family history and notes), assessment timeline, report upload/download/removal disclosure, and consent-controlled summaries.
- For an authenticated patient who has granted care consent, save non-demo self-intake progress to the same patient-owned MySQL record as a DRAFT, including language, current step, answers and progress needed to resume. Do not persist image data URLs or report bytes in the draft JSON. Do not save guest, demo, proxy/guardian, or another patient's draft into that account.
- List and retrieve only the signed-in patient's incomplete drafts, offer a working resume action that restores the saved step and answers, and allow final submission to transition the matching draft to a submitted visit without creating a duplicate. Clear transient draft state only on successful submission; retain all existing report/history data.

### Staff triage portal — COMPLETE (2026-10-23)
- Add secure STAFF login role without public staff self-registration or default credentials. Every staff endpoint must enforce the role on the server.
- Show a persisted triage queue with patient-reported symptom summaries, urgency flags recomputed by the server, clear triage state/notes, and urgent-first priority ordering. Provide working actions to mark cases triaged and refer them to an existing care organization; referred cases must enter that organization's current doctor queue. Record staff actor and timestamps/audit actions.
- Limit staff results to the triage information needed for queue handling; do not expose report-file blobs or bypass patient ownership, doctor organization scoping, or existing review permissions. Keep doctor login, patient login, doctor notes, red-flag alerts, and case-status workflows working.

### Existing safety, storage, publishing and ZIP — COMPLETE (2026-10-24)
- Do not rebuild the application from a generic template, replace existing features, delete stored patient/demo data, or disable current kiosk, patient portal, doctor portal, API auth, managed MySQL, project object-storage documents, Bhashini-off-by-default setting, or fictional-data-only warnings.
- Keep the prominent English, Hindi, and Marathi fictional-data-only prototype warning throughout the public kiosk and all account portals. Do not imply clinical validation or production readiness.
- Use additive MySQL schema migration only; validate without destructive operations or production-like test record writes. Run relevant OCR, question coverage, auth/ownership, draft resume/submit, triage/referral, API, build and existing regression checks; document any remaining known intermittent test or external/device test limitations.
- Publish the successful updated checkpoint and deliver its confirmed live URL plus a clean source ZIP excluding `.env`, credentials, `.git`, dependencies, and build artifacts.


## Approved dashboard experience refresh (2026-10-24)

### Doctor clinical dashboard refresh — COMPLETE (2026-10-24)
- Add a polished, calm clinical workbench for authenticated doctors that presents their organization context and queue metrics, makes authorized cases easy to scan, and gives the selected case a focused clinician-review layout.
- Clearly distinguish patient-reported history and answers, server-derived draft safety findings, uploaded-report/OCR provenance, staff handoff notes, optional unverified AI review, and clinician-entered notes.
- Preserve the existing doctor role gate, organization-scoped case access, claim/token lookup, report access, review notes/status, print workflow, responsive layout, keyboard access and prominent English/Hindi/Marathi fictional-data-only warning. Do not alter permissions or represent draft rules/AI as diagnosis.

### Distinct staff triage/review dashboard — COMPLETE (2026-10-24)
- Give staff a visually distinct operations-style triage/review workspace, separate in hierarchy and accent from the doctor's clinical workbench but still within NIDAN's existing identity.
- Make the urgent-first patient queue, concise patient-reported symptom and status summary, server-derived urgency flags, triage note/status controls, organization selector and doctor referral action easy to scan and use across screen sizes.
- Preserve staff role authentication and API authorization, actor/audit behavior, assigned-case restrictions, current triage and referral workflows, keyboard access and prominent English/Hindi/Marathi fictional-data-only warning. Do not expose report blobs or add diagnostic claims.


## Approved full localization expansion (2026-10-24)

Accepted scope: “Yes — all 23 languages, including every portal and the clinical questions; draft labels are fine.” The language set is the 23 existing options in `src/data/languages.ts`; do not silently add or remove a locale.

### Complete kiosk and portal UI localization — OPEN
- Provide localized user-facing labels, headings, buttons, navigation, status, help, accessibility labels, empty/loading/success/error messages, consent, demo/privacy disclosures, and safety warnings for all 23 listed languages.
- Cover the patient kiosk and its complete existing intake flow; local staff console, About/help and self-test; account registration/login; patient history, reports and returning-patient drafts; doctor dashboard/review; and staff triage/referral dashboard.
- Preserve the approved English/Hindi/Marathi copy and every existing product feature, role permission, data/API field, route, and action. Use static locale resources so language selection does not call an external translation service or transmit patient content.

### Complete symptom and clinical-question localization — OPEN
- Localize every selectable symptom module label, short label, description, all 98 existing question prompts, helper text, placeholders, choice labels/options, and validation guidance for each of the 23 listed languages.
- Preserve every existing symptom key, question/answer ID, conditional follow-up, skip/back/edit behavior, safety rule and submitted assessment value. Translation must not add diagnosis or treatment claims or change clinical logic.
- Keep generated non-English additions visibly marked as draft; consent, emergency warnings, and clinical language require native-speaker and qualified clinical review before real-world use. Do not imply voice/OCR service support merely because interface text is translated.

### Portal language selection, script direction and honest coverage — OPEN
- Offer and retain a display-language choice across account, patient, returning-draft, doctor, and staff portal screens; use a valid patient preferred language when available and a persisted on-device choice/default English otherwise. Continue to use the selected intake language in the kiosk.
- Set page `lang`/direction for the active locale and support right-to-left Urdu and Sindhi layouts without mirroring numeric or technical identifiers incorrectly.
- Update locale capabilities, About/help material and translation sheets so full UI availability, draft/review state, clinical-review need, browser-dependent voice, and bundled English/Hindi/Marathi OCR are represented honestly; never say the app is fully reviewed or offers native speech/OCR when it does not.

### Localization implementation validation and release — OPEN
- Expand the existing translation sheet/importer and add automated key-parity, placeholder, script/direction, required-warning and question-coverage checks across all 23 locales. Preserve all existing tests and authentication/workflow behavior.
- Run language validation, the full regression tests and production frontend/server build. Publish the canonical successful checkpoint after confirmation and deliver its live URL and a clean updated source ZIP that excludes `.env`, credentials, `.git`, dependencies and generated builds.
