import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { execFileSync, spawnSync } from 'node:child_process';
import { createApp } from '../src/server/app.js';
import { loadConfig } from '../src/server/config.js';
import { hashPassword } from '../src/server/auth.js';
import { migrate } from '../src/server/migrate.js';
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required; tests create and drop a temporary schema.');
const schema = `tracker_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${schema}`,
});
let app: Awaited<ReturnType<typeof createApp>>;
let cookie = '';
let id = '';
const origin = 'http://localhost:5173';
const input = {
  company: 'Example team',
  role: 'Web developer',
  location: 'Oslo',
  jobUrl: '',
  contact: '',
  salary: '',
  notes: '',
  stage: 'saved',
  appliedOn: null,
  followUpOn: '2026-10-25',
};
const headers = () => ({ cookie, origin });
before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(pool);
  await migrate(pool);
  app = await createApp(
    pool,
    loadConfig({
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      OWNER_PASSWORD_HASH: await hashPassword('correct-test-password'),
    }),
  );
});
after(async () => {
  if (app) await app.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});
test('owner data is private; login checks origin and credentials', async () => {
  assert.equal((await app.inject('/healthz')).statusCode, 200);
  assert.equal((await app.inject('/api/applications')).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/login',
        payload: { username: 'owner', password: 'correct-test-password' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/login',
        headers: { origin },
        payload: { username: 'owner', password: 'bad-password' },
      })
    ).statusCode,
    401,
  );
  const login = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { origin },
    payload: { username: 'owner', password: 'correct-test-password' },
  });
  assert.equal(login.statusCode, 200);
  assert.match(String(login.headers['set-cookie']), /HttpOnly.*SameSite=Strict/i);
  cookie = String(login.headers['set-cookie']).split(';')[0];
});
test('strict validation rejects blank names, impossible dates and executable URLs', async () => {
  for (const payload of [
    { ...input, company: '  ' },
    { ...input, followUpOn: '2026-02-30' },
    { ...input, jobUrl: 'javascript:alert(1)' },
    { ...input, role: '' },
    { ...input, extra: 'no' },
  ]) {
    assert.equal(
      (await app.inject({ method: 'POST', url: '/api/applications', headers: headers(), payload }))
        .statusCode,
      400,
    );
  }
});
test('create preserves plain date strings and records initial stage atomically', async () => {
  const created = await app.inject({
    method: 'POST',
    url: '/api/applications',
    headers: headers(),
    payload: input,
  });
  assert.equal(created.statusCode, 201);
  id = created.json().id;
  assert.equal(created.json().followUpOn, '2026-10-25');
  assert.equal(created.json().appliedOn, null);
  const activity = (await app.inject({ url: '/api/activities', headers: headers() })).json();
  assert.equal(activity.length, 1);
  assert.equal(activity[0].toStage, 'saved');
});
test('stage updates preserve a history and reject conflicting edits', async () => {
  const payload = {
    ...input,
    stage: 'applied',
    appliedOn: '2026-10-26',
    version: 1,
    archived: false,
  };
  const update = await app.inject({
    method: 'PUT',
    url: `/api/applications/${id}`,
    headers: headers(),
    payload,
  });
  assert.equal(update.statusCode, 200);
  assert.equal(update.json().version, 2);
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: `/api/applications/${id}`,
        headers: headers(),
        payload,
      })
    ).statusCode,
    409,
  );
  const activity = (
    await app.inject({ url: `/api/activities?applicationId=${id}`, headers: headers() })
  ).json();
  assert.equal(activity.length, 2);
  const change = activity.find((a: { kind: string }) => a.kind === 'stage');
  assert.equal(change.fromStage, 'saved');
  assert.equal(change.toStage, 'applied');
});
test('notes are inert text, append-only, and remain associated with the application', async () => {
  const text = "<script>alert(1)</script>'; DROP TABLE applications; --";
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/applications/${id}/notes`,
        headers: headers(),
        payload: { body: text },
      })
    ).statusCode,
    201,
  );
  const activity = (
    await app.inject({ url: `/api/activities?applicationId=${id}`, headers: headers() })
  ).json();
  assert.equal(activity.find((a: { kind: string }) => a.kind === 'note').body, text);
  assert.equal(
    (
      await app.inject({
        method: 'DELETE',
        url: `/api/applications/${id}/notes`,
        headers: headers(),
      })
    ).statusCode,
    404,
  );
});
test('archive keeps history, prevents new notes, and can be reversed', async () => {
  const archived = await app.inject({
    method: 'PUT',
    url: `/api/applications/${id}`,
    headers: headers(),
    payload: { ...input, stage: 'applied', version: 2, archived: true },
  });
  assert.equal(archived.statusCode, 200);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/applications/${id}/notes`,
        headers: headers(),
        payload: { body: 'Not allowed' },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await app.inject({
        method: 'PUT',
        url: `/api/applications/${id}`,
        headers: headers(),
        payload: { ...input, stage: 'applied', version: 3, archived: false },
      })
    ).statusCode,
    200,
  );
});
test('exports the complete application history without session data', async () => {
  const response = await app.inject({ url: '/api/export', headers: headers() });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.json().applications.length, 1);
  assert.equal(response.json().activities.length, 3);
  assert.equal(response.json().sessions, undefined);
});
test('demo reads are public, every mutation is denied, even with an owner cookie', async () => {
  const demo = await createApp(pool, loadConfig({ DATABASE_URL: 'test', DEMO_MODE: 'true' }));
  try {
    assert.equal((await demo.inject('/api/applications')).statusCode, 200);
    assert.equal((await demo.inject('/api/export')).statusCode, 200);
    for (const url of ['/api/login', '/api/applications', `/api/applications/${id}/notes`])
      assert.equal(
        (await demo.inject({ method: 'POST', url, headers: headers(), payload: input })).statusCode,
        403,
      );
    assert.equal(
      (
        await demo.inject({
          method: 'PUT',
          url: `/api/applications/${id}`,
          headers: headers(),
          payload: {},
        })
      ).statusCode,
      403,
    );
  } finally {
    await demo.close();
  }
});
test('follow-up completion and rescheduling preserve a note and reject stale or closed edits', async () => {
  let record = (await app.inject({ url: '/api/applications', headers: headers() })).json()[0];
  const payload = {
    version: record.version,
    followUpOn: null,
    body: 'Called the recruiter; waiting for feedback.',
  };
  const result = await app.inject({
    method: 'POST',
    url: `/api/applications/${id}/follow-up`,
    headers: headers(),
    payload,
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.json().followUpOn, null);
  assert.equal(result.json().version, record.version + 1);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/applications/${id}/follow-up`,
        headers: headers(),
        payload,
      })
    ).statusCode,
    409,
  );
  const history = (
    await app.inject({ url: `/api/activities?applicationId=${id}`, headers: headers() })
  ).json();
  assert.match(history[0].body, /Follow-up completed/);
  assert.match(history[0].body, /Called the recruiter/);
  const scheduled = await app.inject({
    method: 'POST',
    url: `/api/applications/${id}/follow-up`,
    headers: headers(),
    payload: { ...payload, version: result.json().version, followUpOn: '2026-11-05' },
  });
  assert.equal(scheduled.statusCode, 200);
  assert.equal(scheduled.json().followUpOn, '2026-11-05');
  record = scheduled.json();
  await app.inject({
    method: 'PUT',
    url: `/api/applications/${id}`,
    headers: headers(),
    payload: { ...input, stage: 'rejected', archived: false, version: record.version },
  });
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/applications/${id}/follow-up`,
        headers: headers(),
        payload: { ...payload, version: record.version + 1 },
      })
    ).statusCode,
    409,
  );
  const demo = await createApp(pool, loadConfig({ DATABASE_URL: 'test', DEMO_MODE: 'true' }));
  try {
    assert.equal(
      (
        await demo.inject({
          method: 'POST',
          url: `/api/applications/${id}/follow-up`,
          headers: headers(),
          payload,
        })
      ).statusCode,
      403,
    );
  } finally {
    await demo.close();
  }
});
test('application materials survive reconnect, stale clients, follow-ups and export', async () => {
  const materials = {
    coverLetter: 'Dear team,\n\n' + 'ø'.repeat(18000) + '\n<script>inert text</script>',
    applicationAddress: 'recruiting@example.test\nExample street 1',
    nextAction: 'Submit the tailored letter',
  };
  const response = await app.inject({
    method: 'POST',
    url: '/api/applications',
    headers: headers(),
    payload: { ...input, ...materials, jobUrl: 'https://example.test/job/42' },
  });
  assert.equal(response.statusCode, 201);
  const created = response.json();
  for (const [key, value] of Object.entries(materials)) assert.equal(created[key], value);
  // A browser left open before this release must not erase newly saved materials.
  const oldClient = await app.inject({
    method: 'PUT',
    url: `/api/applications/${created.id}`,
    headers: headers(),
    payload: { ...input, stage: 'applied', version: 1, archived: false },
  });
  assert.equal(oldClient.statusCode, 200);
  assert.equal(oldClient.json().coverLetter, materials.coverLetter);
  const oversized = await app.inject({
    method: 'POST',
    url: `/api/applications/${created.id}/follow-up`,
    headers: headers(),
    payload: { version: 2, body: 'x'.repeat(7800), nextAction: 'y'.repeat(500), followUpOn: null },
  });
  assert.equal(oversized.statusCode, 400);
  const updated = await app.inject({
    method: 'POST',
    url: `/api/applications/${created.id}/follow-up`,
    headers: headers(),
    payload: {
      version: 2,
      body: 'Submitted the letter.',
      nextAction: 'Call the recruiter',
      followUpOn: '2026-11-05',
    },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().nextAction, 'Call the recruiter');
  const stale = await app.inject({
    method: 'PUT',
    url: `/api/applications/${created.id}`,
    headers: headers(),
    payload: { ...input, coverLetter: 'stale overwrite', version: 1, archived: false },
  });
  assert.equal(stale.statusCode, 409);
  const reconnected = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  try {
    const row = (
      await reconnected.query(
        'SELECT cover_letter,application_address,next_action FROM applications WHERE id=$1',
        [created.id],
      )
    ).rows[0];
    assert.equal(row.cover_letter, materials.coverLetter);
    assert.equal(row.application_address, materials.applicationAddress);
    assert.equal(row.next_action, 'Call the recruiter');
  } finally {
    await reconnected.end();
  }
  const exported = (await app.inject({ url: '/api/export', headers: headers() }))
    .json()
    .applications.find((a: { id: string }) => a.id === created.id);
  assert.equal(exported.coverLetter, materials.coverLetter);
  assert.equal(exported.nextAction, 'Call the recruiter');
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/applications',
    headers: headers(),
    payload: { ...input, coverLetter: 'x'.repeat(20001) },
  });
  assert.equal(invalid.statusCode, 400);
});
test('expired and logged-out sessions cannot read owner data', async () => {
  assert.equal(
    (await app.inject({ method: 'POST', url: '/api/logout', headers: headers(), payload: {} }))
      .statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ url: '/api/applications', headers: headers() })).statusCode,
    401,
  );
  const login = await app.inject({
    method: 'POST',
    url: '/api/login',
    headers: { origin },
    payload: { username: 'owner', password: 'correct-test-password' },
  });
  cookie = String(login.headers['set-cookie']).split(';')[0];
  await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
  assert.equal(
    (await app.inject({ url: '/api/applications', headers: headers() })).statusCode,
    401,
  );
});

test('demo seeding shows application materials and refuses to replace existing content', async () => {
  const demoSchema = `seed_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`CREATE SCHEMA ${demoSchema}`);
  const demoPool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${demoSchema}`,
  });
  try {
    await migrate(demoPool);
    const databaseUrl = new URL(process.env.TEST_DATABASE_URL!);
    databaseUrl.searchParams.set('options', `-c search_path=${demoSchema}`);
    const env = { ...process.env, DATABASE_URL: databaseUrl.href, SEED_DEMO: 'true' };
    execFileSync(process.execPath, ['--import', 'tsx', 'src/server/seed.ts'], {
      env,
      stdio: 'pipe',
    });
    const before = (await demoPool.query('SELECT * FROM applications ORDER BY id')).rows;
    assert.equal(before.length, 5);
    for (const record of before) {
      assert.match(record.cover_letter, /Fictional demonstration letter/);
      assert.match(record.cover_letter, new RegExp(record.role));
      assert.equal(record.application_address, 'recruiting@example.test (fictional demo contact)');
      if (record.stage !== 'rejected') assert.ok(record.next_action);
    }
    const history = (await demoPool.query('SELECT count(*) FROM activities')).rows[0].count;
    const repeated = spawnSync(process.execPath, ['--import', 'tsx', 'src/server/seed.ts'], {
      env,
      encoding: 'utf8',
    });
    assert.notEqual(repeated.status, 0);
    assert.match(repeated.stderr, /Refusing to seed a non-empty workspace/);
    assert.deepEqual((await demoPool.query('SELECT * FROM applications ORDER BY id')).rows, before);
    assert.equal((await demoPool.query('SELECT count(*) FROM activities')).rows[0].count, history);
  } finally {
    await demoPool.end();
    await admin.query(`DROP SCHEMA ${demoSchema} CASCADE`);
  }
});
