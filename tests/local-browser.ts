import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { chromium, expect } from '@playwright/test';

// Read-only check of the local Vite workspace. Never create records or screenshots.
const env = parseEnv(await readFile('.env', 'utf8'));
assert.equal(env.APP_ORIGIN, 'http://localhost:5174');
assert.equal(env.DEMO_MODE, 'false');
const database = new URL(env.DATABASE_URL!);
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.pathname, '/application_tracker_owner');
const credentials = JSON.parse(await readFile('.local/owner-credentials.json', 'utf8'));
const origin = env.APP_ORIGIN;
for (const file of ['.env', '.local/owner-credentials.json']) {
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal((await fetch(`${origin}/@fs/${process.cwd()}/${file}`)).status, 403);
}
assert.equal((await fetch(`${origin}/api/applications`)).status, 401);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByLabel('Username', { exact: true }).fill(credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your next opportunity.', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add application', exact: true }).click();
  for (const name of [
    'Cover letter',
    'Application address / email',
    'Job listing URL',
    'Next action',
  ])
    await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Follow-ups', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Keep the conversation going.', exact: true }),
  ).toBeVisible();
  const exported = await page.request.get(`${origin}/api/export`);
  assert.equal(exported.status(), 200);
  assert.equal(exported.headers()['cache-control'], 'no-store');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  assert.equal((await page.request.get(`${origin}/api/applications`)).status(), 401);
  assert.deepEqual(errors, []);
  console.log(
    'Local Vite owner login, application form, follow-up navigation, export, logout and private-file denial passed. No records changed.',
  );
} finally {
  await browser.close();
}
