# Design decisions

## A useful personal workflow

The job hunt often spreads details across notes, saved links, and message threads.
The tracker focuses on the current stage and the next useful action. It does not
apply on a person's behalf or read their email.

## Data model

Applications store current editable facts with an optimistic version counter.
Stage changes and append-only notes form a separate activity history. A row lock
and transaction make each stage change and corresponding event atomic. Archive
keeps the record and history; accepted/rejected/withdrawn are outcomes, not deletion.

Follow-up days are SQL dates, returned as ISO calendar-date strings. Due status
uses the viewer's local calendar day and excludes closed/archived applications.
Blank dates are null. Export uses repeatable-read isolation so records and their
history come from a coherent snapshot.

## Privacy and deployment

Owner mode requires configured credentials and HTTPS outside localhost. Scrypt
password hashing, a rate-limited login, hashed random session tokens, HttpOnly/
SameSite=Strict cookies, expiry, Origin checks, strict input schemas, parameterized
SQL, and first-party Content Security Policy form the application boundary.
Secure cookies are enabled on HTTPS. Forwarded-IP headers are not trusted; the
login rate limit is per directly observed address and may group proxy clients.

Job links accept HTTP(S) only and use noreferrer in a new tab. Note text is never
interpreted as HTML. No actual job-hunt files were imported to create the demo.

Authentication/configuration and deployment files began from the server-ops
implementation. They remain local to each repository to allow independent builds;
there is no shared runtime service or cross-app authorization. Each deployed app
has its own Unix account, key, container network, and PostgreSQL store.

## Trade-offs

This is a personal workspace, not a recruitment platform. No tenants, email
delivery, integration credentials, board drag-and-drop, or analytics service.
Changing a stage through the edit form is keyboard-accessible and produces an
explicit history event. Version conflicts require a reload and review.
