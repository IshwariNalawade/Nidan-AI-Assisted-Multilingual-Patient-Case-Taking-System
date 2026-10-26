# Clinical & translation review (REQUIRED before any real patient use)

The red-flag rules, the clinical questions and the Marathi/Hindi texts in NIDAN are **drafts written by the development team. They have not been reviewed by a clinician or a professional translator.**
The staff area shows a DRAFT banner until `VITE_REVIEW_SIGNOFF` is set.

## How to review (30–60 minutes per reviewer)
1. `npm run review-sheet` → opens `docs/clinical-review.csv` (165 rows) in Excel.
2. **Red-flag rules** (`type = red-flag rule`): a doctor decides for each — is the concept right, is the tier (urgent / needs-check) right, are obvious phrases missing, any dangerous omissions? Add missing phrases as comments; the team adds them to `src/lib/safety.ts` and re-runs `npm test`.
3. **Questions** (`type = question`, `mr`, `hi`): a native speaker who is also medically literate compares English vs Marathi/Hindi; do a *back-translation* for the safety-critical ones (chest, breathing, bleeding, fever in infants, pregnancy).
4. **UI strings** (consent, emergency, voice notice, guardian, disclaimer): check meaning and tone; consent text should be reviewed by someone familiar with the DPDP Act, 2023.
5. Each reviewer fills `reviewer_name_and_reg_no`, `decision`, `comment`.

## Sign-off record
| Area | Reviewer (name, registration no.) | Date | Decision | Notes |
|---|---|---|---|---|
| Red-flag rules |  |  |  |  |
| General-medicine questions (mr/hi) |  |  |  |  |
| AYUSH content (Dashavidha fields) |  |  |  |  |
| Consent / safety wording |  |  |  |  |

After sign-off set `VITE_REVIEW_SIGNOFF="Dr … (Reg …), date"` in `.env` and rebuild.

## What the engine does and does not do
It restructures what the patient says and raises a flag from a word list with negation handling. It does **not** diagnose, triage or clear anyone. A missing flag never means "safe". Staff must treat the kiosk as a convenience, not a safety system.
