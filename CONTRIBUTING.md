# Contributing to NIDAN

Thanks for helping make multilingual patient intake more accessible. NIDAN is a healthcare prototype, so changes should favor clarity, explicit consent, safe fallbacks, and honest documentation over claims that are not backed by tests or clinical review.

## Development workflow

1. Copy `.env.example` to `.env` and use fictional data only.
2. Start local MySQL with `docker compose up -d mysql` when working on the API.
3. Install dependencies with `npm ci`.
4. Run `npm run dev` for the kiosk or `npm run dev:full` for the kiosk plus API.
5. Run `npm test`, `npm run db:validate`, and `npm run build:all` before opening a pull request.

## Pull requests

Please describe the user problem, the affected surface (kiosk, patient portal, doctor workspace, staff triage, voice, OCR, or API), and the verification you ran. Never include real patient information, credentials, provider keys, screenshots containing health data, or unreviewed clinical claims.

Clinical rules, translations, consent wording, and external speech/AI integrations need human review. Keep the limitations visible in the relevant documentation when behavior changes.
