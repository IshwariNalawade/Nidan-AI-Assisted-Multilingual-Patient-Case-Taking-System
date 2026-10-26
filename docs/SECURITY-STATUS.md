# NIDAN security-control status

## Implemented in this build

- Production-hardening gate: `PRODUCTION_HARDENING=true` refuses startup unless secure cookies, organization routing, a configured default organization, and `CLAMAV_SCAN=required` are enabled.
- Organization-required registration mode: `REQUIRE_ORGANIZATION=true` fails closed when a default organization is not configured.
- Encrypted PostgreSQL backup commands: `npm run backup:create`, `npm run backup:verify`, and `npm run backup:restore`. Set `NIDAN_BACKUP_PASSWORD` in a private secret environment and keep backup files outside the source tree.
- Administrator-assisted password reset: `npm run account:reset -- user@example.org`. The password is entered interactively without echo and all existing sessions are revoked. Use an approved institutional delivery channel for the temporary password.
- 22-language catalog structure validation: `npm run languages:validate`. This validates codes, names, voice tags, and translation metadata; it does not certify linguistic or clinical quality.
- Production dependency audit remains part of release validation.

## Not honestly claimable as completed by source changes alone

- Doctor MFA/SSO requires an institution-selected identity provider or TOTP enrollment and recovery policy. Do not deploy doctor accounts with password-only authentication for real patient data.
- Email password reset requires an approved mail provider, verified domain, token expiry/replay controls, abuse monitoring, and email templates. The included reset command is administrator-assisted, not self-service email recovery.
- Automated backup scheduling, off-host retention, key rotation, restore drills, and disaster recovery require an institution-controlled runtime and storage policy. The ZIP provides create/verify/restore primitives.
- Formal penetration testing and clinical safety validation must be performed by independent security and clinical reviewers using approved test plans and representative non-production data.
- Translation quality for all 22 languages requires native-speaker review, clinician review, and browser/device voice testing. The app intentionally marks most languages as needs-review or browser-dependent.
