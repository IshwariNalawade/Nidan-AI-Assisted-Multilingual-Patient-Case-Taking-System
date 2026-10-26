# Hospital-local data and AI

This optional relay and model path is intended for a hospital-controlled pilot. Do not treat it as a production security certification. The HTTP service must be placed behind HTTPS, protected by network controls, and configured with private secrets and storage permissions.

## Privacy and consent rules

1. **Separate purposes:** care consent, optional research consent, optional voice consent and optional visit-level AI-processing consent are distinct. The local staff AI actions are unavailable unless the visit recorded the separate AI opt-in. Saying no does not block care. The AI opt-in is not permission to train a model.
2. **AI is local by default:** the relay accepts an Ollama-compatible model only on the local machine or private network by default. The Express API can optionally use Gemini when `NIDAN_AI_PROVIDER=gemini` and `GEMINI_API_KEY` are configured. Gemini is an external processor; the institution must update patient notices, obtain the separate visit-level AI consent already required by the API, and approve the provider before enabling it. Do not place the key in any `VITE_*` variable.
3. **Minimize before sending:** the browser and relay redact common phone/ID/email patterns and patient name parts before the prompt. This is not perfect; free text can still contain identifiers. The staff panel says this plainly.
4. **AI never decides:** results are unverified drafts, not diagnosis or treatment; they are not saved unless staff copy them into notes. Check source documents and patient words. Voice recognition in Chrome/Edge can use the browser vendor's cloud service if the patient opts in.
5. **Storage paths differ:** `/api/blobs` stores client-encrypted session/history blobs, but the hub also stores operational alert metadata. `/api/fhir` stores an AES-256-GCM-encrypted bundle under `NIDAN_DATA/fhir`; it refuses the write unless a valid 32-byte base64 key is configured. Keep the key outside the project, restrict access to the data directory and include it in a separately protected backup. The relay does not provide a FHIR decryption/download endpoint.
6. **Research has its own consent:** only visits where the patient ticked the research box appear in Staff → Data research export. Research use still requires local ethics/data-protection approval; scrubbing is not guaranteed.
7. **Relay alert integrity:** a VITE kiosk key is shipped to the browser and cannot authenticate a clinical source. Cross-device relay/webhook alerts therefore carry no flags, urgency, age or identity; each is labelled unverified, and a kiosk request cannot acknowledge an alert. Staff must verify the live kiosk/patient. Same-device red flags remain draft rules.
8. **Governance remains required:** apply an institutional retention period, backup/restore plan, incident process, access review and clinical safety review before real-patient use.

## Set-up (hospital server)

### Optional Gemini provider

The backend calls Gemini's REST `generateContent` endpoint only after the authenticated patient or assigned doctor has recorded separate AI-processing consent for that assessment. NIDAN limits the prompt to the concern, selected answers and patient-confirmed report text, then scrubs common phone numbers, IDs, email addresses and ABHA-like identifiers. This scrubbing is not guaranteed to remove every identifier. The response must be JSON with `complaint`, `details` and `missingInformation`; malformed, timed-out or rejected responses use the transparent rule-based fallback instead. Safety findings are calculated independently and are never delegated to Gemini.

Configure this only in the private backend environment:

```text
NIDAN_AI_PROVIDER=gemini
NIDAN_AI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=<secret from Google AI Studio>
```

The model name is configurable because supported Gemini models can change. Restrict and rotate the Google key using the institution's secret-management process. Never commit it to the ZIP or expose it through frontend environment variables.

Install and locally approve the model first. Create high-entropy relay credentials and a 32-byte FHIR key in the institution's secret manager (never commit them):

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set these variables in a private environment file or service secret store, then start the relay behind HTTPS:

```text
NIDAN_KIOSK_KEY=<long random secret>
NIDAN_STAFF_TOKEN=<different long random secret>
NIDAN_FHIR_ENCRYPTION_KEY=<base64 output from the command above>
NIDAN_ORIGIN=https://kiosk.hospital.example
NIDAN_DATA=/srv/nidan-private
NIDAN_LLM_URL=http://127.0.0.1:11434
NIDAN_LLM_MODEL=llama3.1
```

`NIDAN_ORIGIN` is an exact origin, not a path; the default is `http://localhost:3000`, not `*`. Use a private directory with restricted ownership/permissions and a durable protected volume. Protect backups and retain the FHIR encryption key separately. For an external relay or FHIR endpoint, build with `VITE_API_BASE=https://hub.hospital.example` and/or `VITE_FHIR_ENDPOINT=https://fhir.hospital.example`, then set the main Express server's `APP_CSP_CONNECT_ORIGINS=https://hub.hospital.example,https://fhir.hospital.example` to the matching exact HTTPS origins (no paths/wildcards). Configure each external service to permit the kiosk origin by CORS. Keep `VITE_KIOSK_KEY` only on the kiosk client; staff enter their token on the staff board.

## What the model is asked to do

Restate patient-provided words in English as short sections (complaint, duration/severity, associated symptoms, medicines and allergies), say “not stated” when unknown, and never diagnose or suggest treatment. Or translate the patient's words to English. Quality depends on the selected model; test local-language performance with clinicians before relying on it.

## Returning patients and limits

The original browser staff workflow keeps the master patient history in its encrypted local vault. The full-stack patient/doctor portals use separately authenticated Prisma records in MySQL. Local development uploads use a private directory; the hosted demo uses Manus project object storage behind the authorized API route. The runtime storage API cannot physically delete hosted objects, so the portal is fictional-data-only and not for production patient data. The relay is a pilot component: it has shared relay tokens, no per-doctor relay accounts, no built-in backups/high availability and no key-rotation UI. Clinically validate safety rules and all language/device workflows. DPDP and hospital policy questions require institutional governance.
