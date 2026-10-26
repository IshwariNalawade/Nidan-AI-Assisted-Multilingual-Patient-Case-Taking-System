# NIDAN voice language support

The kiosk now passes all 22 listed language codes to the browser speech-recognition layer. Each language has a regional BCP-47 tag, and the recognizer tries only valid region/script aliases for that language before showing the text-entry fallback. It does not silently switch a patient from one language to English.

The browser controls the actual speech engine and installed language packs. Therefore, “mapped” means NIDAN can request the language correctly; it does not mean every Chrome, Edge, Android, kiosk image, or operating-system build has recognition and speech-output support installed. The language picker refreshes output-voice availability after the browser fires `voiceschanged`, and each voice field reports when the device has no installed output voice.

For a competition demonstration, test the same device image in English, Hindi, Marathi, and several additional languages. Record whether the browser accepted recognition, whether final transcripts were correct, whether speech output was available, and whether the operator used typed fallback. Do not present browser-dependent availability as clinical or language-equivalence validation.

## Update: voice in all 23 languages, site-wide
- Speech output now falls back to the closest installed voice (e.g. Maithili/Dogri/Sanskrit → Hindi, Konkani → Marathi, Kashmiri/Sindhi → Urdu, Manipuri/Assamese → Bengali) instead of an English voice, and long text is read in sentence chunks.
- `#/dashboard` is the new sidebar workspace (Overview, Live queue, Patients, Care team, Reports, Settings) with a language picker, spoken search (mic) and read-aloud for the selected case.
- Account, patient, doctor, staff and access pages have a floating "Read page aloud" button using the selected language.
- Browser engines still decide which voices/recognisers exist. Newly added dashboard strings fall back to English until translated.
