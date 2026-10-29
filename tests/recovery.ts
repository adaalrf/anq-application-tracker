import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { hashPassword } from '../src/server/auth.js';
const tag = randomUUID().replaceAll('-', '');
const source = 'recovery_' + tag,
  restored = 'restored_' + tag;
if (
  !process.env.TEST_DATABASE_URL ||
  !process.env.TEST_IMAGE ||
  !process.env.TEST_POSTGRES_CONTAINER
)
  throw new Error(
    'TEST_DATABASE_URL, TEST_IMAGE and TEST_POSTGRES_CONTAINER are required; use disposable local PostgreSQL only.',
  );
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(databaseUrl.hostname))
  throw new Error('Recovery tests require a local disposable database.');
const postgresContainer = process.env.TEST_POSTGRES_CONTAINER;
const url = (db: string) => {
  const u = new URL(databaseUrl);
  u.pathname = '/' + db;
  return u.href;
};
const admin = new pg.Pool({ connectionString: url('postgres') });
const image = process.env.TEST_IMAGE;
const name = 'tracker-recovery-' + tag;
const origin = `http://127.0.0.1:${process.env.TEST_PORT || '18586'}`;
const password = 'recovery-test-' + tag;
const hash = await hashPassword(password);
const podman = (...a: string[]) =>
  execFileSync('podman', a, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
let cookie = '';
async function call(path: string, body?: unknown) {
  const r = await fetch(origin + path, {
    method: body ? 'POST' : 'GET',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(r.ok, `${path}: ${r.status}`);
  if (path === '/api/login') cookie = r.headers.get('set-cookie')!.split(';')[0];
  return r.json();
}
async function boot(db: string) {
  podman(
    'run',
    '-d',
    '--name',
    name,
    '--network',
    'host',
    '--read-only',
    '--cap-drop=all',
    '--security-opt=no-new-privileges',
    '--tmpfs',
    '/tmp:rw,nosuid,nodev,size=64m',
    '-e',
    'DATABASE_URL=' + url(db),
    '-e',
    'APP_ORIGIN=' + origin,
    '-e',
    'HOST=127.0.0.1',
    '-e',
    'PORT=' + new URL(origin).port,
    '-e',
    'OWNER_PASSWORD_HASH=' + hash,
    image,
  );
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(origin + '/healthz');
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error('App not ready');
}
const fixture = {
  company: 'Recovery fixture',
  role: 'Developer',
  location: 'Test',
  jobUrl: 'https://example.test/job',
  contact: 'Recruiter',
  salary: '',
  notes: 'Test only',
  stage: 'applied',
  appliedOn: '2026-10-29',
  followUpOn: '2026-11-05',
  coverLetter: 'Dear team,\n\n' + 'A durable application. ø '.repeat(400),
  applicationAddress: 'jobs@example.test\nTest street 1',
  nextAction: 'Call recruiter',
};
try {
  await admin.query(`CREATE DATABASE ${source}`);
  await admin.query(`CREATE DATABASE ${restored}`);
  podman(
    'run',
    '--rm',
    '--network',
    'host',
    '-e',
    'DATABASE_URL=' + url(source),
    image,
    'node',
    'dist/server/migrate.js',
  );
  await boot(source);
  await call('/api/login', { username: 'owner', password });
  const created = await call('/api/applications', fixture);
  await call(`/api/applications/${created.id}/follow-up`, {
    version: created.version,
    body: 'Submitted exact saved letter.',
    followUpOn: '2026-11-06',
    nextAction: 'Prepare for interview',
  });
  const before = await call('/api/export');
  podman('rm', '-f', name);
  await boot(source);
  const afterReplacement = await call('/api/export');
  assert.deepEqual(afterReplacement.applications, before.applications);
  assert.deepEqual(afterReplacement.activities, before.activities);
  podman('rm', '-f', name);
  const dump = execFileSync('podman', [
    'exec',
    postgresContainer,
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    source,
    '-Fc',
  ]);
  execFileSync(
    'podman',
    [
      'exec',
      '-i',
      postgresContainer,
      'pg_restore',
      '--exit-on-error',
      '--no-owner',
      '-U',
      'postgres',
      '-d',
      restored,
    ],
    { input: dump },
  );
  await boot(restored);
  await call('/api/login', { username: 'owner', password });
  const recovered = await call('/api/export');
  assert.deepEqual(recovered.applications, before.applications);
  assert.deepEqual(recovered.activities, before.activities);
  console.log(
    'PASS: built image migration, full application materials, follow-up, forced container replacement, pg_dump/pg_restore to separate database, recovered owner login and exact export comparison.',
  );
} finally {
  try {
    podman('rm', '-f', name);
  } catch {}
  for (const db of [source, restored])
    await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
  await admin.end();
}
