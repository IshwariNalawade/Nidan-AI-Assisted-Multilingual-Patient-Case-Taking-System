# Windows CMD setup (NIDAN local full-stack)

This preserves the supplied React/Vite kiosk. The full authenticated account portal and API use MySQL via Prisma. Install Node.js 22.12+ or Node.js 24+ and Docker Desktop with Docker Compose, then open **Command Prompt** in the project folder.

```cmd
copy .env.example .env
docker compose up -d mysql
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev:full
```

Open `http://localhost:3000`. Vite serves the kiosk and portal; it proxies `/api` to the Express server on port `8787`. The kiosk remains usable without signing in. Patient sign-up requires a 12+ character password. Doctor accounts are never created by patient sign-up. Create an organization first, then provision the doctor into that organization from a separately controlled terminal:

```cmd
npm run organization:create -- hospital-slug Hospital Name --kind=HOSPITAL
set DEFAULT_ORGANIZATION_ID=<id printed by the command>
npm run doctor:create -- doctor@example.org
```

Supported organization kinds are `GENERAL`, `HOSPITAL`, `CLINIC`, `RESEARCH`, and `AYUSH`. The doctor dashboard displays the signed-in doctor’s organization and kind, and only shows assessments routed to that organization. A kiosk session used without authenticated patient sign-in remains in the encrypted local/staff handoff; it is not automatically copied into the MySQL account portal or exposed to doctors. At the review step, sign in through the patient portal to connect the intake to the patient account and configured default organization.

The CLI prompts for the password without echoing it. Do not put credentials in the command line, screenshots, Git or support messages. For a fully synthetic local test only, set `SEED_DEMO_PASSWORD` in the ignored `.env`, then run `npm run db:seed`; sample identities are `patient.demo@nidan.invalid` and `doctor.demo@nidan.invalid`. Do not enable sample accounts in production.

For a separately hosted frontend, set `VITE_API_BASE` to the API origin (for example `https://api.example.org`), add the exact frontend origin to the API's comma-separated `APP_ORIGINS`, and add the API origin to `APP_CSP_CONNECT_ORIGINS`. The API returns credentialed CORS headers only for exact configured origins. Use `GET /api/health` for process health and `GET /api/ready` for MySQL readiness.

Run `npm run build:all`, `npm test`, `npm run db:validate`, and `npx prisma migrate status` with the normal local database. The MySQL persistence integration suite is opt-in and may only use a disposable `nidan_test` database on `localhost`, `127.0.0.1`, or `::1` with local file storage; the test refuses remote databases, including the shared hosted demo database. In a separate Command Prompt, create and migrate that local database once, then run the tests:

```cmd
docker compose exec mysql mysql -uroot -pnidan-root-local-only -e "CREATE DATABASE nidan_test;"
set DATABASE_URL=mysql://root:nidan-root-local-only@localhost:3306/nidan_test
set NIDAN_STORAGE_BACKEND=local
npx prisma migrate deploy
set NIDAN_RUN_PERSISTENCE_TESTS=YES
npm run test:integration
set NIDAN_RUN_PERSISTENCE_TESTS=
```

Close that Command Prompt or restore the normal app `DATABASE_URL` and `NIDAN_STORAGE_BACKEND` afterward. The suite refuses database names that do not include `nidan_test` and removes its unique synthetic records and local test files; never run it against the shared hosted database. `npm run api:dev` starts only the API; `npm run dev` starts only Vite; `npm run dev:full` starts both. Stop Docker with `docker compose down` (`-v` deletes the local database volume).

## Local security defaults and production cautions
`.env.example` defaults to local MySQL and `COOKIE_SECURE=false`, `COOKIE_SAME_SITE=lax`, `PUBLIC_HTTPS=false`. HTTPS Manus Preview uses `Secure` and `SameSite=None` for session cookies; the published container does the same. Browsers may still block third-party cookies. Keep plain-HTTP local settings separate. The public demo stores report files in Manus project object storage; local development uses `PRIVATE_UPLOAD_DIR`. The runtime object-storage API cannot physically delete cloud objects, so removing a report/account from NIDAN is not erasure. Use fictional data only; the Compose passwords are local-development examples.

For a production fail-closed configuration, set `PRODUCTION_HARDENING=true`, `REQUIRE_ORGANIZATION=true`, `DEFAULT_ORGANIZATION_ID=<approved-id>`, `CLAMAV_SCAN=required`, `COOKIE_SECURE=true`, and `COOKIE_SAME_SITE=strict` or `none`. The API refuses to start if this combination is incomplete. Create encrypted database backups with a private `NIDAN_BACKUP_PASSWORD` (20+ characters):

```cmd
set NIDAN_BACKUP_PASSWORD=<private-secret>
npm run backup:create
npm run backup:verify
npm run backup:restore
```

Keep encrypted backup files and the password in separate protected systems. `npm run account:reset -- user@example.org` is an administrator-assisted recovery command that revokes existing sessions; self-service email recovery is not bundled because it requires an approved mail provider and institutional token-delivery policy. Run `npm run languages:validate` to validate the 22-language metadata catalog; native-speaker and clinician review is still required for linguistic quality.

AI is off by default. To test an Ollama-compatible model locally, set its loopback URL/model in the ignored `.env` and run the local model separately; optional AI requests remain gated by a separate patient opt-in and use only consented answers plus patient-confirmed report text. No remote provider, model key, handwriting model, or handwriting adapter is bundled. Existing kiosk OCR handles machine-printed text locally; handwriting remains unavailable/experimental and must not be represented as recognized.

Optional AI4Bharat adapters are also supported without replacing the existing fallbacks. Run a separate local IndicConformer ASR service and an Indic-OCR-compatible service, then set `AI4BHARAT_ASR_URL`, `AI4BHARAT_OCR_URL`, `VITE_AI4BHARAT_ASR=true`, and `VITE_AI4BHARAT_OCR=true` in `.env`. The API proxies bounded audio/document requests at `/api/ai4bharat/asr` and `/api/ai4bharat/ocr`, rejects non-private adapter URLs by default, and falls back to browser SpeechRecognition, bundled Tesseract OCR, or typing when adapters are unavailable. The ZIP contains the adapter contract in `docs/AI4BHARAT-ADAPTERS.md`; it does not bundle model checkpoints or claim that AI4Bharat is installed until the local services are separately configured and tested.

The optional official BHASHINI/ULCA proxy is documented in `docs/BHASHINI.md`. Keep `BHASHINI_USER_ID` and `BHASHINI_API_KEY` server-only; never prefix them with `VITE_`. Set `BHASHINI_ENABLED=true`, provide the approved credentials, then enable `VITE_BHASHINI_ASR=true` and/or `VITE_BHASHINI_TTS=true` only after testing the selected pipeline on the target kiosk. NIDAN calls `/api/bhashini/asr` and `/api/bhashini/tts`, resolves service IDs through the BHASHINI pipeline-config response, and retains browser voice, typing, touch, and local OCR fallbacks. Provider availability, account approval, external data handling, audio-format compatibility, native-speaker review, and device testing remain deployment requirements.

For explicit retention cleanup, review the policy and run `npm run retention:purge` with `RETENTION_DAYS` set. The script removes report records and local files but reports cloud objects it cannot physically erase. Account deletion requires the authenticated patient password and explicit `DELETE` confirmation; it does not erase project-storage objects. Set `CLAMAV_SCAN=required` only when `clamdscan` is installed; uploads fail closed if the scanner is unavailable.

The published site is a demo prototype, not a certified hospital information system or a production-ready/clinically validated service. Clinical rule sets need clinician review; no ABDM integration, native-device validation, institutional privacy review, email verification, password reset, MFA, production backup service or formal penetration test is included. Do not enter real patient, health, Aadhaar, ABHA, or report information. Production use requires qualified institutional review of security, retention, consent, backups, incident response and clinical safety.
