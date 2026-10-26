# Deployment & workflow guide

## Who it is for (and who it is not)
- **Primary:** outpatients waiting in a government/private OPD who can read, or listen to, Marathi/Hindi/English and tap a screen.
- **Staff-assisted mode:** ticking "Staff is helping me" marks the intake as assisted (recorded in metrics). For patients who cannot use a screen (low vision, no literacy, tremor, distress) a staff member or volunteer reads questions aloud and types/taps. Voice can be switched off at any time.
- **Not for:** emergencies (staff and the 112 link come first), patients who cannot give consent, anyone needing an interpreter for a language that has no support.
- **Children / dependants:** the person answering chooses "my child" or "family member" and gives their relation; a guardian confirmation is required for anyone under 18.

## Hardware (kiosk option)
Touch monitor 21–24" (landscape, wall or stand, ADA-style height), mini-PC or Chromebox, USB speakerphone/array microphone with noise suppression (sound is the weakest link in a busy OPD), 1080p webcam or document camera for reports, UPS, wired LAN + Wi-Fi fallback. Mount the screen so a wheelchair user can reach it. A tablet on a stand works for pilots.

## Cleaning / shared device hygiene
Wipe the screen between patients (alcohol-based screen wipes). Prefer the voice option to reduce touching, put a hand-sanitiser dispenser beside the kiosk, and use a screen protector that tolerates disinfectants. The kiosk wipes an unfinished session after 3 minutes of inactivity and after every patient.

## Queue integration
Every intake gets a daily token (T-001…; the local draft engine may use U-001…). Print or announce it. Cross-device relay events are generic, **unverified kiosk notices** with no red-flag severity; they must not be treated as triage or sorted as confirmed emergencies. Review the live patient/kiosk and the original intake before clinical action. FHIR Flags are likewise patient-intake drafts until a clinician verifies them.

## Staff set-up (once per device)
1. Open `/#/staff`, choose a passphrase (no default PIN; lose it = saved data is unrecoverable).
2. Run `/#/selftest` on the real machine 10 minutes before use; fix every ❌.
3. Keep the staff board open on a screen the nurses can see; click once on the page so the browser lets it play the alert sound.

## Alerts to other devices
- **Webhook** `VITE_ALERT_WEBHOOK` and **relay server** (`server/server.mjs`) send/store only a generic `{kind, token, at, unverified}` kiosk notice—never client-authored flags, age, identity or status. A browser-exposed kiosk key cannot prove who raised a notice. Every remote notice is explicitly labelled **unverified**; only a separate staff token can acknowledge it.
- Configure unique private `NIDAN_KIOSK_KEY`/`NIDAN_STAFF_TOKEN`, exact `NIDAN_ORIGIN`, HTTPS, the production UI CSP allowlist (`APP_CSP_CONNECT_ORIGINS`, below), and private storage. `NIDAN_NOTIFY_URL` also forwards only the generic unverified notice.
- If delivery fails the local draft alert remains queued and the patient is told to tell a staff member in person.

## Hospital / ABDM
NIDAN produces an HL7 FHIR R4 transaction Bundle (Patient, Consent, Condition, Allergy, Medication, Flag, DocumentReference, Composition). Export it from the staff area or POST it to `VITE_FHIR_ENDPOINT`. The optional local relay stores received FHIR bundles only as AES-256-GCM ciphertext and refuses the write unless a valid base64-encoded 32-byte `NIDAN_FHIR_ENCRYPTION_KEY` is set. Keep that key separately backed up and protected; the relay has no FHIR decryption/download endpoint. A real ABDM/HIP connection needs registration, sandbox credentials and a gateway — **not done**.

## Production browser CSP
The Express server defaults `connect-src` to `'self'`. If a production build uses an external `VITE_API_BASE` or `VITE_FHIR_ENDPOINT`, add only the exact HTTPS origins to `APP_CSP_CONNECT_ORIGINS` (comma-separated, no paths, wildcards, credentials, queries or fragments). Rebuild/restart with that server configuration, and configure the remote service's CORS policy to allow the exact kiosk origin. Leave the setting empty for same-origin API use.

## Privacy configuration
Encrypted at rest (ECDH P-256 + AES-GCM, passphrase-wrapped key); in-progress intake in memory only; voice requires opt-in; patient can delete their data; 30-day retention; hash-chained audit log. This protects a lost/shared browser profile. It is not a hardened production store — use the relay server + a proper database for production.
