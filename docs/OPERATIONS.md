# Operations

- Keep real applications and contacts in owner mode behind HTTPS. A public demo
  exposes all its records and its complete JSON export.
- Keep credentials out of the repository, image, and notes. Password generation
  reads plaintext from stdin and emits a scrypt hash for the private environment.
- To rotate credentials, update the owner hash, execute `DELETE FROM sessions`
  through an administrative database connection, and restart the app.
- Migrate explicitly before first startup. Migrations are transactional and use
  an advisory lock. Keep schema changes compatible with the previous app image.
- Configure encrypted off-server PostgreSQL backups before storing real data.
  Local disposable tests use test storage; deployed instances use their configured
  encrypted off-host repositories. Test the actual scheduled systemd unit.
- Test recovery into a separate database with fresh credentials; verify sign-in,
  application stages, date values, notes, activity history, and export.
- A 409 during an edit means the record changed. Reload and review instead of
  retrying the stale version automatically.
- Archive to retain history; unarchive to add more notes. Append a clarifying
  note rather than editing a previous history item.
- Follow-ups do not send reminders. Open the workspace to review what is due.
- Use Record follow-up to save the conversation and its next date together. An
  empty next date clears the due item without closing the application. Stale edits
  fail without adding a duplicate note or changing the date.
- Form draft protection is a discard/navigation warning, not draft storage. Failed
  saves keep the form open; intentionally discarding or closing the browser loses
  unsaved content. Do not use browser storage to retain private application notes.
- The JSON export is an application data copy, not a full database backup.

## Production data and recovery

Tracker stores saved cover letters (plain text, up to 20,000 characters), listing
URLs, application addresses, next actions, dates and status in PostgreSQL. They
are included in JSON export and the complete database backup. These are saved
records; an unsaved form is not durable. Files such as PDFs are not uploaded.

The private production instance uses its own persistent PostgreSQL volume,
independent of the app container and the public demo. Replacing the app container
does not remove that volume. Never remove the production database volume, seed it
with demo data, or restore an old empty checkpoint over current records.

Encrypted off-host backups run daily, retain 7 daily and 4 weekly checkpoints
(and at least 2 latest snapshots), and alert on failure or stale backups. Daily
backups can lose changes made since the last successful checkpoint if the entire
web host is lost. Export JSON after important submissions for an additional copy.
The production recovery kit contains access/configuration; use the latest
database backup for application records. Backups can briefly pause the app.

Run `npm run test:recovery` with TEST_DATABASE_URL pointing to disposable local
PostgreSQL, TEST_POSTGRES_CONTAINER naming that server's container, and TEST_IMAGE
set to the built image ID. It creates two random temporary databases, uses the
actual image and migrations, records materials and a follow-up, replaces the app
container, restores pg_dump into the second database, verifies recovered login
and exact exported records/history, then removes only its own test resources.

For locally preloaded releases, retain the current image with a unique tag in the
same repository (for example `localhost/anq-application-tracker:retained-r3`)
BEFORE loading the next OCI archive. Replacing the sole tag can remove the old
repository digest association even while its image ID remains stored. Verify
`podman image exists REPOSITORY@CURRENT_DIGEST` before deployment or backup,
then retain the new release similarly. The backup job must be able to restart
the current immutable image without pulling from a nonexistent localhost registry.
