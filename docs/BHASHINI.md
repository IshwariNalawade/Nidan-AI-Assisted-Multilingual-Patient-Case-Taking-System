# NIDAN + BHASHINI integration

NIDAN includes an optional server-side integration with the official BHASHINI/ULCA pipeline API for speech recognition and speech synthesis. It is disabled by default. The current kiosk remains usable with browser speech recognition, browser read-aloud, typing, touch controls, and bundled local OCR.

## What is implemented

When enabled, the Express API calls BHASHINI's pipeline-config endpoint using server-only `userID` and `ulcaApiKey` credentials. It resolves the configured ASR or TTS service for the selected ISO-639 language, then calls the returned inference endpoint. The browser only calls NIDAN's same-origin `/api/bhashini/asr` and `/api/bhashini/tts` routes; credentials are never placed in Vite variables, URLs, local storage, or client logs.

The ASR path records only after the existing voice opt-in, shows the existing listening/interim/final-confirmation flow, and sends the captured audio to the server only when `VITE_BHASHINI_ASR=true`. The TTS path is enabled with `VITE_BHASHINI_TTS=true`. If either request fails, NIDAN falls back to the existing browser voice path and keeps visible typing/touch alternatives. Audio is not persisted by NIDAN.

The browser `MediaRecorder` commonly produces WebM/Opus. NIDAN forwards the detected format as `webm`; if the selected BHASHINI pipeline rejects that format, deploy a tested WAV/FLAC conversion boundary or keep the browser fallback enabled. Do not claim a Bhashini path is production-ready until it is tested with the target kiosk browser, microphone, network, account, selected languages, and pipeline service IDs.

## Configuration

Copy `.env.example` to `.env` and set these values only on the server:

```env
BHASHINI_ENABLED=true
BHASHINI_USER_ID=<server-only-user-id>
BHASHINI_API_KEY=<server-only-ulca-api-key>
BHASHINI_PIPELINE_ID=643930aa521a4b1ba0f4c41d
BHASHINI_CONFIG_URL=https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline
BHASHINI_INFERENCE_URL=https://dhruva-api.bhashini.gov.in/services/inference/pipeline
BHASHINI_TIMEOUT_MS=45000
BHASHINI_SAMPLING_RATE=16000
VITE_BHASHINI_ASR=true
VITE_BHASHINI_TTS=true
```

Obtain `userID` and `ulcaApiKey` from the BHASHINI/ULCA profile for the approved organization. Never commit them, put them in `VITE_*` variables, or include them in an archive or screenshot. The pipeline ID and service availability are account/provider dependent; the integration resolves service IDs from the config response rather than hardcoding a language service for every language.

## Consent and privacy boundary

The existing voice permission/opt-in is required before microphone capture. For an institutional deployment, update the consent wording and privacy notice to identify BHASHINI as an external speech service, the selected languages, retention terms supplied by the institution, and the approved data-processing basis. This prototype does not claim that BHASHINI's provider-side retention, residency, SLA, or clinical compliance is established. Use fictional/synthetic data for a competition demonstration unless the institution has approved otherwise.

BHASHINI output is a patient-reported transcript or audio prompt. It is not a diagnosis, triage decision, translation certification, or clinical interpretation. Patients must confirm dictated text, and clinicians must verify information before care decisions.

## Validation checklist

1. Test `npm run build:all` and the normal test suite with Bhashini disabled.
2. On the target device, enable Bhashini with a secret-managed account and test English, Hindi, and Marathi separately.
3. Verify the pipeline-config response contains a matching ASR/TTS service and that the inference endpoint returns transcript/audio output.
4. Test microphone denial, offline mode, timeout, empty transcript, unsupported language, and provider errors. Each case must leave typing, touch, or browser voice available.
5. Confirm browser network logs and source bundles do not contain `BHASHINI_API_KEY`, `ulcaApiKey`, or the user ID.
6. Record the actual browser, device, language, pipeline ID, date, and result in the competition test notes. Native-speaker, clinical, privacy, and provider-policy review remain external requirements.

## Official API references

- [BHASHINI API overview](https://bhashini.gitbook.io/bhashini-apis)
- [Pipeline configuration call](https://bhashini.gitbook.io/bhashini-apis/pipeline-config-call.md)
- [Pipeline compute call](https://bhashini.gitbook.io/bhashini-apis/pipeline-compute-call.md)
- [Request payload examples](https://bhashini.gitbook.io/bhashini-apis/pipeline-compute-call/request-payload.md)
- [Available models and service IDs](https://dibd-bhashini.gitbook.io/bhashini-apis/available-models-for-usage.md)
