# NIDAN — multilingual, voice-assisted patient intake

> **NIDAN** helps clinics collect a clearer patient story before the consultation — in the patient’s language, with voice, touch, OCR, safety flags, and a structured handoff for staff and clinicians.

[![CI](https://github.com/IshwariNalawade/Nidan-AI-Assisted-Multilingual-Patient-Case-Taking-System/actions/workflows/ci.yml/badge.svg?branch=main )](https://github.com/IshwariNalawade/Nidan-AI-Assisted-Multilingual-Patient-Case-Taking-System/actions/workflows/ci.yml )

## Why this matters

Many patients spend their first minutes in a clinic repeating the same story across a language or literacy barrier. NIDAN turns that first conversation into an accessible, patient-led intake flow that can be completed at a kiosk or on a phone, then reviewed by the right person instead of treated as an automated diagnosis.

## The hackathon demo

## Demo video

Watch the complete NIDAN hackathon walkthrough:

[▶ Watch the NIDAN demo video](https://drive.google.com/file/d/118s5ZPcwcBSDqu9jl1lhHBM3j-7U-L2O/view?usp=sharing

## OCR demo sample

Use this clearly fictional report to test the browser OCR workflow:

- [Download the sample PDF report](demo-assets/nidan-demo-chest-pain-report-anjali-patil.pdf)
- [Download the OCR-friendly PNG report](demo-assets/nidan-demo-chest-pain-report-anjali-patil.png)

The report contains synthetic data for Anjali Patil, age 42, and is intended only for hackathon demonstration and OCR testing. It is not a real medical record, diagnosis, prescription, or clinical document.

1. Open the kiosk and choose English, Hindi, or Marathi.
2. Use the **Hackathon demo** button to load a clearly fictional patient.
3. Walk through the 16-step intake with touch, typing, or browser voice controls.
4. Upload a sample report to see local OCR and patient confirmation before extracted text is used.
5. Trigger a red-flag answer to see the visible safety banner and staff alert handoff.
6. Open the staff, patient, or doctor workspaces to show the same case moving through triage and review.

The demo never pre-checks consent and displays a fictional-data warning. Do not enter real patient, Aadhaar, ABHA, or report information.

## What is implemented

- **Accessible intake kiosk:** 16-step patient-led flow with keyboard support, text-size controls, high contrast, touch, and voice fallbacks.
- **Multilingual UX:** English, Hindi, and Marathi are fully translated; additional Indian languages have clearly labelled draft UI coverage.
- **Voice and OCR:** browser speech recognition/synthesis, optional BHASHINI and AI4Bharat adapters, and bundled offline Tesseract packs for English, Hindi, and Marathi.
- **Safety-first handoff:** explainable red-flag matching with evidence, urgent-first staff alerts, tokens, and explicit clinician review boundaries.
- **Role-based workspaces:** patient drafts, doctor review, staff triage, authenticated ownership checks, and organization-scoped access.
- **Privacy controls:** consent logging, encrypted browser handoff, idle wipe, retention tools, audit events, rate limits, and server-only provider secrets.
- **Interoperability:** structured reports, FHIR export helpers, and an API designed for hospital-local deployment.

## Architecture

```text
React + TypeScript + Vite kiosk / portals
                 │
                 ├── Browser voice + local OCR + encrypted local handoff
                 │
                 └── Express API ── Prisma ── MySQL
                         ├── patient / doctor / staff workflows
                         ├── authenticated document access
                         ├── optional local AI, BHASHINI, AI4Bharat adapters
                         └── safety rules, audit, retention, FHIR helpers
```

Key directories:

```text
src/components/     kiosk, voice controls, patient/doctor/staff workspaces
src/lib/            OCR, voice, safety, privacy, reports, audit, API clients
src/data/           languages, clinical modules, localization sources
server/api/         Express API, security middleware, role-scoped routes
prisma/             MySQL schema, migrations, and seed helpers
tests/              UI, safety, privacy, localization, API, and accessibility tests
docs/               deployment, integration, review, and test protocols
```

## Quick start: kiosk only

Requirements: Node.js 22.12+ (or Node 24+) and a modern Chromium-based browser for microphone/camera permissions.

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. This path runs the kiosk without a database and is the fastest way to judge the core experience.

## Quick start: full stack

Requirements: Docker and Docker Compose.

```bash
docker compose up -d mysql
cp .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run dev:full
```

The Vite app runs on port `3000`; the API runs on port `8787` and is proxied by Vite. Use fictional data only. See [`docs/WINDOWS-SETUP.md`](docs/WINDOWS-SETUP.md) for Windows-specific commands and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for deployment notes.

## Verification

```bash
npm run db:validate
npm run languages:validate
npm test
npm run build:all
```

The repository CI runs these checks on pushes and pull requests. The browser voice path, microphone quality, OCR accuracy, translation quality, clinical rules, and institutional security posture still require target-device and human review.

## Optional integrations

All external providers are disabled by default and must remain server-only where credentials are involved:

- [BHASHINI / ULCA](docs/BHASHINI.md) for optional Indic speech services.
- [AI4Bharat adapters](docs/AI4BHARAT-ADAPTERS.md) for separately hosted ASR/OCR services.
- [Hospital-local AI](docs/LOCAL-AI.md) for an optional Ollama-compatible model or approved external provider.

NIDAN can produce a structured patient-reported summary, but it does not diagnose, prescribe, certify a translation, or replace a clinician.

## Responsible-use boundary

This is a hackathon prototype for fictional data, not a clinically validated product. Clinical safety rules and translations are drafts until reviewed by qualified humans. Do not claim ABDM integration, production compliance, handwriting recognition, provider availability, or pilot outcomes unless you have independently verified them. Read [`docs/REVIEW.md`](docs/REVIEW.md), [`docs/SECURITY-STATUS.md`](docs/SECURITY-STATUS.md), and [`docs/TEST-PROTOCOL.md`](docs/TEST-PROTOCOL.md) before any real-world evaluation.

## Roadmap

- Native-speaker review for the remaining language surfaces and clinical question bank.
- Target-device testing for microphones, noise, kiosk permissions, and low-connectivity clinics.
- Clinician-reviewed safety lexicon and prospective usability evidence.
- Institutional deployment review, approved retention/backup policy, and hospital integration.

## License

Released under the [MIT License](LICENSE). See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the safe development workflow.
