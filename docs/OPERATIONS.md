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
  Test the actual scheduled backup unit and its configured off-host repository.
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

An owner deployment needs its own persistent PostgreSQL volume,
independent of the app container and the public demo. Replacing the app container
does not remove that volume. Never remove the production database volume, seed it
with demo data, or restore an old empty checkpoint over current records.

The ANQ Publish backup policy retains 7 daily and 4 weekly checkpoints
(and at least 2 latest snapshots). Configure daily runs and alerts for failures
or stale backups on your host. Daily
backups can lose changes made since the last successful checkpoint if the entire
web host is lost. Export JSON after important submissions for an additional copy.
Keep host access/configuration recovery material separately; use the latest
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

## Deployment

### Runtime

Build with `podman build -t localhost/anq-application-tracker:release .`.
The image serves the built interface and API on port 8080 as an unprivileged user.
It supports a read-only filesystem with writable `/tmp` and requires PostgreSQL 17.
Container replacement must preserve the database volume; application containers
are disposable.

Supply `DATABASE_URL` and the exact HTTPS `APP_ORIGIN` through a protected host
environment file. Keep the database off the public network and terminate TLS at
the reverse proxy. `/healthz` checks database access and the initial schema;
it does not verify a backup or every migration.

### Database and access

Run `node dist/server/migrate.js` explicitly before startup. Startup does not
migrate or seed automatically. Back up existing data before applying migrations.
A previous image is usable for rollback only while its schema remains compatible;
image rollback does not undo database changes.

Set `DEMO_MODE=false`, `OWNER_USERNAME`, and `OWNER_PASSWORD_HASH` for a private
owner workspace. Generate the hash with `npm run --silent password`, supplying
the password on stdin. Owner mode requires HTTPS outside localhost.

A public demo must use `DEMO_MODE=true`, a separate database, and fictional data.
Run the seed command only for an empty demonstration database. Never copy owner
records or credentials into a demo, screenshot, or repository.

### ANQ Publish

Enable PostgreSQL and encrypted off-host backups, and configure:

```sh
MIGRATION_COMMAND=(node dist/server/migrate.js)
```

Keep each deployment's Unix account, database and secrets separate. Verify HTTPS,
sign-in, saved-record persistence after container replacement, and an isolated
restore before storing valuable data. Use the recovery procedure above.
