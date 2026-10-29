## Public demo aligned with current source — 2026-10-29

Publish app anq-application-tracker revision 3 now serves the current source at
https://tracker.demo.adaalrf.dev. Additive migration 002 and the normal encrypted
pre-migration backup succeeded. Existing fictional applications and all history
were preserved. Only the new empty material fields received explicitly fictional
cover letters, contact addresses and next actions, matching fresh local seeds.
The private production instance anq-next-step is separate and was not updated.

## Production application workflow — 2026-10-29

The private instance https://tracker.adaalrf.dev is designated production by the
owner. Publish revision 3 includes saved plain-text cover letters, application
address/email and next action; existing status, URL, notes and follow-up dates
complete the workflow. Migration 002 is additive and preserves existing records.
The private database is never demo-seeded or reset.

Typecheck/build, 15 API/model/navigation tests, complete browser workflow and
built-image container-replacement/restore tests passed. Tests use fictional
records in isolated databases. Encrypted off-host backups and monitoring remain
enabled; see OPERATIONS.md for durability, retention and recovery limits.

## Private owner workspace — 2026-10-29

The private owner instance is live at https://tracker.adaalrf.dev, deployed as
anq-next-step through ANQ Publish revision 1. Its database is independent of the
fictional public demo and starts empty. Scheduled encrypted off-host backups,
backup freshness and HTTPS monitoring are enabled. Owner access is checked over
public HTTPS and Chromium without inserting fictional production records.

This release includes atomic follow-up recording/completion, unsaved-edit discard
warnings and separate per-application history fetching. Owner data and credentials
must never be copied into demo seeds, screenshots or this repository.

## Interface release — 2026-10-28

Live at https://tracker.demo.adaalrf.dev through ANQ Publish, revision 2.
The reviewed page/component organization and navigation changes are deployed.
Readiness and public read-only browser/mobile checks passed. Automated accessibility
scans passed the public homepage. Existing fictional records and authentication
settings were preserved. GitHub publication remains separate.

Image: `localhost/anq-application-tracker@sha256:52cef4a2107ecb01008d0208b5aaef147a3884fe26769d8a9945167c02108644`

Previous image retained for rollback: `localhost/anq-application-tracker@sha256:cb8a114cc37eddc3b0fd7397743bfb3f1439a38038a8cc1c1fe5a5c5fde02706`
