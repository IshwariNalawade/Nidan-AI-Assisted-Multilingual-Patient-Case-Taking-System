# Optional AI4Bharat ASR and OCR adapters

NIDAN now has an optional local adapter boundary for AI4Bharat speech recognition and Indic OCR. The default prototype remains usable without these services: Chrome/Edge SpeechRecognition handles voice input, and the bundled Tesseract.js/PDF text path handles OCR.

## ASR

Run an IndicConformer-based local HTTP service and configure:

```env
AI4BHARAT_ASR_URL=http://127.0.0.1:8090/transcribe
VITE_AI4BHARAT_ASR=true
```

NIDAN sends `multipart/form-data` containing `audio` and `language`. The adapter should return JSON in this shape:

```json
{"text":"patient-reported words","confidence":87,"method":"indicconformer"}
```

The browser records only after the patient permits voice input. Audio is forwarded only to the configured adapter; NIDAN does not persist the recording. The transcript is shown for patient confirmation.

## OCR

Run a local Indic-OCR-compatible service and configure:

```env
AI4BHARAT_OCR_URL=http://127.0.0.1:8091/ocr
VITE_AI4BHARAT_OCR=true
```

NIDAN sends `multipart/form-data` containing `file` and `language`. The adapter returns the same JSON shape with extracted `text`. If it is unavailable, image OCR falls back to bundled Tesseract.js and scanned PDFs fall back to the existing local path. Digital PDFs continue to use exact embedded PDF text first.

The API limits adapter uploads, applies rate limiting, and accepts only local/private adapter URLs unless `AI4BHARAT_ALLOW_REMOTE=true` is explicitly configured. Remote use requires institutional privacy review and separate consent.

## Official references

- AI4Bharat IndicConformer ASR: https://ai4bharat.iitm.ac.in/areas/model/ASR/IndicConformer/
- AI4Bharat IndicConformer repository: https://github.com/AI4Bharat/IndicConformerASR
- AI4Bharat Indic-OCR repository: https://github.com/AI4Bharat/Indic-OCR

This integration adds the NIDAN adapter and fallback logic. It does not bundle model checkpoints, GPU runtimes, or a preconfigured AI4Bharat server.
***
