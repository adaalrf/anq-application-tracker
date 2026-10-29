import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsFollowUp } from '../src/shared/model.js';
import { loadConfig } from '../src/server/config.js';
test('follow-ups include today and overdue active records, never closed or archived ones', () => {
  const base = { archived: false, stage: 'applied' as const, followUpOn: '2026-10-26' };
  assert.equal(needsFollowUp(base, '2026-10-26'), true);
  assert.equal(needsFollowUp({ ...base, followUpOn: '2026-10-25' }, '2026-10-26'), true);
  assert.equal(needsFollowUp({ ...base, followUpOn: '2026-10-27' }, '2026-10-26'), false);
  for (const stage of ['accepted', 'rejected', 'withdrawn'] as const)
    assert.equal(needsFollowUp({ ...base, stage }, '2026-10-26'), false);
  assert.equal(needsFollowUp({ ...base, archived: true }, '2026-10-26'), false);
  assert.equal(needsFollowUp({ ...base, followUpOn: null }, '2026-10-26'), false);
});
test('owner mode refuses missing credentials or non-local HTTP', () => {
  assert.throws(() => loadConfig({ DATABASE_URL: 'test' }), /OWNER_PASSWORD_HASH/);
  assert.throws(
    () => loadConfig({ DATABASE_URL: 'test', APP_ORIGIN: 'http://example.com' }),
    /HTTPS/,
  );
});
