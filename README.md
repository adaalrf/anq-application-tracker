# ANQ Next Step — application tracker

A private, single-owner job application workspace. Keep roles, conversations,
stage changes, and follow-ups together without submitting anything automatically.
Built with React, TypeScript, Fastify, and PostgreSQL.

The [public read-only demo](https://tracker.demo.adaalrf.dev) contains fictional
applications, sample cover letters and next actions. Run the local workspace
below to create and edit your own examples.

![Application pipeline](docs/screenshots/pipeline-desktop.png)

## Features

- A pipeline for saved roles, submitted applications, interviews, and offers.
- Closed outcomes: accepted, rejected, and withdrawn; separate from archiving.
- Follow-ups due today or earlier, excluding closed and archived applications.
- Record a follow-up with a history note and either its next date or completion;
  both changes save together, with conflict detection.
- Saved plain-text cover letters, job listing URL, application address/email, next action, contacts, salary/terms and notes.
- Stage transitions recorded atomically alongside the application update.
- Append-only conversation notes; archiving preserves the full history.
- Conflict detection for stale edits and complete JSON export.
- Confirm before discarding form edits, with a browser warning before leaving an unsaved draft.
- An authenticated owner workspace or a read-only public demo with fictional data.

## Local development

On Linux with Node.js 24+, npm and rootless Podman, start an editable fictional workspace:

```sh
npm ci
npm run setup:local
npm run dev
```

Open http://localhost:5174. The API uses port 8081. Setup creates a separate
`application_tracker_owner` database and applies migrations. It seeds only on
initial setup and preserves records and credentials on repeat runs. The owner
password is in `.local/owner-credentials.json`; keep it private. Configuration
and credentials are ignored by Git, excluded from images, and denied by Vite.
Stopping the development servers leaves PostgreSQL data intact.

Requires Node.js 24+ and PostgreSQL 17. The Compose file starts a localhost-only
development database with a development-only password. Or use rootless Podman:

```sh
podman run -d --name application-tracker-dev-db \
  -e POSTGRES_PASSWORD=local-development-only -e POSTGRES_DB=application_tracker \
  -p 127.0.0.1:55433:5432 \
  -v application-tracker-development-data:/var/lib/postgresql/data docker.io/library/postgres:17-alpine
npm ci
cp .env.example .env
node --env-file=.env --import tsx src/server/migrate.ts
SEED_DEMO=true node --env-file=.env --import tsx src/server/seed.ts
node --env-file=.env --import tsx --watch src/server/main.ts
```

Run `npm run dev:client` in another terminal and open http://localhost:5174.
The example configuration is a read-only demo. Seeding is explicit, refuses a
non-empty workspace, and never reads actual job applications from this machine.

For editable owner mode set `DEMO_MODE=false`, choose `OWNER_USERNAME`, and supply
`OWNER_PASSWORD_HASH`. In Bash, generate the hash without putting the password in
history or process arguments:

```sh
read -rs -p 'Owner password (12+ characters): ' tracker_password
printf '%s' "$tracker_password" | npm run --silent password
unset tracker_password
```

Put the resulting hash in `.env` and restart the server. Owner mode requires
HTTPS outside localhost. `APP_ORIGIN` is the exact browser origin without a
trailing slash. Dates such as follow-up day remain calendar dates in PostgreSQL;
they do not shift when displayed in a different timezone.

## Verification

```sh
npm run typecheck
npm run build
TEST_DATABASE_URL=postgres://postgres:local-development-only@127.0.0.1:55433/application_tracker npm test
npx playwright install chromium
TEST_DATABASE_URL=postgres://postgres:local-development-only@127.0.0.1:55433/application_tracker npm run test:browser
```

Tests create and remove a randomly named schema. Use a disposable database only.
On NixOS, point `CHROMIUM_EXECUTABLE` at a Nix Chromium executable. Browser checks
exercise the production client, owner workflow, stage history, note persistence,
follow-ups, archiving, export, demo mode, search, mobile layout, and an automated
WCAG A/AA pipeline scan. Test screenshots contain fictional records only.

## Deployment

The multi-stage Dockerfile serves the built client and API from port 8080, as an
unprivileged user, with a read-only filesystem. The Node base is pinned by digest.
`/healthz` checks the database and initial schema. Migrations and seeding never
run implicitly at application startup.

With `anq-publish`, use PostgreSQL and backups, and configure
`MIGRATION_COMMAND=(node dist/server/migrate.js)`. Supply the database connection,
origin, and owner hash in the protected application environment. A public demo
must use `DEMO_MODE=true` and contain fictional records only.

The disposable `/tracker/` demo is built with `VITE_BASE_PATH=/tracker/` and a
proxy stripping that prefix. Normal deployments use `/`.

See [design](docs/DESIGN.md) and [operations](docs/OPERATIONS.md).

## Scope

One owner; no multi-user collaboration, recruitment automation, email access,
scraping, calendar integration, or notifications. Follow-ups are a filtered view,
not delivered reminders. Applications are unpaginated for a personal-sized
workspace. The UI displays the latest 500 activity records; exports include all.
Selected application history is fetched separately from the workspace activity
feed, up to the latest 500 entries for that application. History is append-only
through the API, not tamper-proof against database admins.
JSON export has no matching import endpoint in v1.

The current fictional read-only demo is live at https://tracker.demo.adaalrf.dev,
including cover letters, application addresses and next actions. Its public API,
read-only controls and responsive interface have been checked over HTTPS.

## Source organization

Page views live in `src/client/pages/`, shared controls and record forms in
`components/`, and the sidebar/topbar/reading area in `layouts/Workspace.tsx`.
`App.tsx` coordinates authenticated data and mutations. Client types and display
formatting live in `types.ts` and `lib/presentation.ts`. Navigation keeps the
existing deployment prefix. See [editing guide](docs/SOURCE-STRUCTURE.md).

Applications, Follow-ups and Activity use query-string navigation. Selected
applications survive refresh and Back/Forward; unknown record links show an
explicit missing-record state. A search with no matches offers Clear search.
Search text and collection filters remain local view state and reset on refresh.

## Real application workflow

1. Add the company and role; save the listing URL and an email/postal application
   address when needed. Keep it in Saved while preparing.
2. Paste your cover letter, record the next action, and save. You can reopen and
   edit the saved text; the letter is included in export and database backups.
3. Submit to the employer outside Tracker. Set the stage to Applied and record
   the submission date and a follow-up date.
4. Record follow-ups to save what happened, update the next action, and schedule
   the next date (or clear it to finish that follow-up). Update status as it moves
   through interviews, offers, or closure. Archive retains the record and history.

Cover letters are stored as plain text; this release does not upload documents
or submit applications automatically. Daily backups protect saved records, not
unsaved form drafts. See operations for recovery and backup retention.

## Working on the project

See [contributing and development](CONTRIBUTING.md) for the source map, everyday
commands, test prerequisites and troubleshooting. `npm run dev` starts both the
API and Vite after local setup; `dev:local` remains an alias. For a custom manual
configuration, run `npm run dev:server` and `npm run dev:client` separately.
