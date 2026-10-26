# NIDAN innovation and evaluation notes

NIDAN is an accessibility and information-collection prototype, not a diagnostic product. The features below are designed to be demonstrated and measured without making clinical accuracy claims.

## Implemented in this build

- **Explainable safety prompts:** rule-based findings retain matched patient evidence and show that the result is a draft prompt for clinician review.
- **Completeness review:** the patient summary lists missing profile fields, unanswered questions, processing documents, and unconfirmed OCR text. It does not infer disease or urgency.
- **Voice repair cue:** interim speech is shown while listening; final speech is shown in an “I heard…” confirmation bar. The UI states that browser confidence is not calibrated and offers retry or typing fallback.
- **Anonymous research metrics:** the staff Metrics tab records completion time, completion rate, voice attempts/successes, corrections, assisted mode, quick mode, and urgent-rule counts without names or answers.
- **Language capability matrix:** the Metrics tab separates reviewed translation, browser-dependent recognition, and system-dependent speech output for every listed language.
- **Offline/sync visibility:** encrypted browser records and pending hub uploads remain visible as separate local/offline versus optional hub behavior.
- **Consent and audit boundaries:** care consent, optional AI consent, research consent, audit events, and document confirmation remain separate states.
- **Clinician evidence trail:** doctor summaries show patient-reported answers, matched safety evidence, document confirmation status, and clinician-entered notes.

## Still prototype-only or not implemented

- **Phone-to-separate-kiosk QR pairing:** same-device mobile camera capture is implemented. Secure cross-device transfer needs one-time signed pairing tokens, expiry, anti-replay checks, encrypted transport, and cleanup; it is not claimed as implemented.
- **Clinical validation:** red-flag rules, question wording, and summary usefulness require clinician review and a documented study.
- **22-language equivalence:** only the languages marked reviewed have reviewed UI copy. Browser voice availability depends on the device and installed voice packs.
- **Real-world outcome improvement:** no improvement percentage is claimed until a pilot produces de-identified measurements.

## Suggested Avishkar evaluation

Run the same fictional scenarios in paper, touch-only, and voice-assisted modes. Record completion time, unanswered fields, voice retries, touch fallback, OCR corrections, and participant comprehension. Ask clinicians to rate information completeness and usefulness separately from diagnostic accuracy. Export the anonymous CSV from the staff Metrics tab and preserve the scenario script and participant consent.
