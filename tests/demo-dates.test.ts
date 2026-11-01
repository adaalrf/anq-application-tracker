import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/server/app.js';
import { loadConfig } from '../src/server/config.js';
import { migrate } from '../src/server/migrate.js';
import { demoDateShiftDays, projectDemoDates, shiftDemoDate } from '../src/server/demo-dates.js';

test('demo date projection preserves calendar days, nulls and non-date text', () => {
  assert.equal(demoDateShiftDays('2024-02-28', new Date('2024-03-01T23:00:00Z')), 2);
  assert.equal(shiftDemoDate('2024-02-28', 2), '2024-03-01');
  const data = {
    appliedOn: '2024-02-28',
    lastBackupAt: null,
    notes: '2024-02-28',
    createdAt: new Date('2024-02-28T12:00:00Z'),
  };
  assert.equal(projectDemoDates(data, 0), data);
  assert.deepEqual(projectDemoDates(data, 2), {
    appliedOn: '2024-03-01',
    lastBackupAt: null,
    notes: '2024-02-28',
    createdAt: '2024-03-01T12:00:00.000Z',
  });
  assert.equal(data.appliedOn, '2024-02-28');
  assert.throws(
    () => loadConfig({ DATABASE_URL: 'test', DEMO_DATE_ANCHOR: '2024-02-28' }),
    /only allowed/,
  );
  assert.throws(() =>
    loadConfig({ DATABASE_URL: 'test', DEMO_MODE: 'true', DEMO_DATE_ANCHOR: '2024-02-30' }),
  );
});
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
test('demo API shifts dates without altering storage; unconfigured instances retain stored dates', async () => {
  const schema = `dates_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const pool = new pg.Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(pool);
    const anchor = '2024-02-28',
      days = demoDateShiftDays(anchor),
      id = randomUUID();
    await pool.query(
      `INSERT INTO applications(id,company,role,location,job_url,contact,salary,notes,stage,applied_on,follow_up_on,created_at,updated_at) VALUES ($1,'Example','Developer','','','','','','applied','2024-02-21','2024-02-27','2024-02-28T12:00Z','2024-02-28T12:00Z')`,
      [id],
    );
    await pool.query(
      `INSERT INTO activities(id,application_id,kind,body,created_at) VALUES ($1,$2,'note','Sample note','2024-02-28T12:00Z')`,
      [randomUUID(), id],
    );
    for (const configured of [false, true]) {
      const app = await createApp(
        pool,
        loadConfig({
          DATABASE_URL: 'test',
          DEMO_MODE: 'true',
          DEMO_DATE_ANCHOR: configured ? anchor : '',
        }),
      );
      apps.push(app);
      const count = configured ? days : 0;
      const record = (await app.inject('/api/applications')).json()[0];
      assert.equal(record.followUpOn, shiftDemoDate('2024-02-27', count));
      assert.equal(record.appliedOn, shiftDemoDate('2024-02-21', count));
      const history = (await app.inject('/api/activities')).json()[0];
      assert.equal(history.createdAt, shiftDemoDate('2024-02-28T12:00:00.000Z', count));
      const exported = (await app.inject('/api/export')).json();
      assert.equal(exported.applications[0].followUpOn, record.followUpOn);
      assert.equal((await app.inject('/api/session')).json().relativeDates, configured);
      assert.equal(
        (await app.inject({ method: 'POST', url: '/api/login', payload: {} })).statusCode,
        403,
      );
    }
    assert.equal(
      (await pool.query('SELECT follow_up_on::text FROM applications WHERE id=$1', [id])).rows[0]
        .follow_up_on,
      '2024-02-27',
    );
  } finally {
    for (const app of apps) await app.close();
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
