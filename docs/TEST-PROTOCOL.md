# Test protocol — produce evidence instead of claims

The automated tests use a simulated microphone and OCR engine. They prove the logic, **not** that it works for real people. Do this on the real device.

## A. Pilot (10 people, 1 hour)
Participants: at least 3 Marathi speakers, 2 Hindi, 2 older adults (60+), 1 person with low literacy, 1 with low vision if possible. Not team members.
1. Run `/#/selftest`; save a screenshot.
2. Each participant completes an intake with a stopwatch observer (the app also records anonymous timings: Staff → Metrics).
3. Observer notes: where they hesitated, what they mis-tapped, whether voice recognised them (the app counts voice attempts/successes), whether they needed help.
4. Control: time how long the same history takes by a nurse/doctor the normal way (3–5 patients).
5. Export Staff → Metrics → CSV. Report **median time, completion rate, voice success rate**, and what failed. Do not report "saves time" unless the numbers show it.

## B. Voice in noise
Record 20 short utterances (name, age, "chest pain" in Marathi/Hindi/code-mixed) at ~60–70 dB background (play OPD noise). Count correct transcripts. Compare headset vs array mic.

## C. OCR
Photograph 20 real documents (10 printed prescriptions/reports, 10 handwritten). Record: read correctly / partly / failed. Expect handwriting to fail; the app must flag low confidence and keep the original image.

## D. Red-flag drill (with a doctor)
Doctor invents 30 phrases (Marathi/Hindi/English/code-mixed, positive and negated). Record misses and false alarms; fix the lexicon; repeat until the doctor is satisfied.

## E. Accessibility checklist
Keyboard-only run-through; screen-reader (NVDA) pass of the first 5 steps; text size A+ ×2; high-contrast mode; 200% zoom; colour-blind check of red/green states; reach-height check. Automated axe checks run in `npm test` (colour contrast needs a browser audit — use Lighthouse).

## F. Demo rehearsal
Offline (airplane mode): intake works by typing/touch; alerts show "local"; OCR works for English/Hindi/Marathi (bundled). Mic blocked: message appears, typing works.
