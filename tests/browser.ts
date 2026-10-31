import { checkNavigationTheme } from './navigation-theme.js';
import { workspaceLink } from './workspace-link.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import pg from 'pg';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createApp } from '../src/server/app.js';
import { loadConfig } from '../src/server/config.js';
import { hashPassword } from '../src/server/auth.js';
import { migrate } from '../src/server/migrate.js';
import { localToday } from '../src/shared/model.js';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
const schema = `browser_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  options: `-c search_path=${schema}`,
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  headless: true,
});
const apps: Awaited<ReturnType<typeof createApp>>[] = [];
const errors: string[] = [];
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(pool);
  for (const [company, role, stage] of [
    ['Birch Studio', 'Frontend developer', 'saved'],
    ['Northline Tools', 'Full-stack developer', 'applied'],
    ['Moss & Co.', 'Junior developer', 'interview'],
    ['Forma Lab', 'Web developer', 'offer'],
  ])
    await pool.query(
      `INSERT INTO applications(id,company,role,location,job_url,contact,salary,notes,stage,follow_up_on) VALUES ($1,$2,$3,'Oslo · Hybrid','','','','Fictional demo application.',$4,$5)`,
      [randomUUID(), company, role, stage, localToday()],
    );
  const config = loadConfig({
    DATABASE_URL: 'test',
    OWNER_PASSWORD_HASH: await hashPassword('browser-test-password'),
  });
  const owner = await createApp(pool, config);
  apps.push(owner);
  config.origin = await owner.listen({ host: '127.0.0.1', port: 0 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(config.origin);
  await page.getByLabel('Username', { exact: true }).fill('owner');
  await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Add application', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add application', exact: true }).click();
  await page.getByLabel('Company', { exact: true }).fill('Test company');
  await page.getByLabel('Role', { exact: true }).fill('Test developer');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Company', { exact: true })).toHaveValue('Test company');
  await page
    .getByLabel('Cover letter', { exact: true })
    .fill(
      'Dear team,\n\nI would like to apply. <script>plain text</script>\n\nRegards, Test applicant',
    );
  await page.getByLabel('Application address / email', { exact: true }).fill('jobs@example.test');
  await page.getByLabel('Job listing URL', { exact: true }).fill('https://example.test/jobs/42');
  await page.getByLabel('Next action', { exact: true }).fill('Submit the letter');
  await page.getByLabel('Follow up on', { exact: true }).fill(localToday());
  await page.getByRole('button', { name: 'Save application', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test developer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit application', exact: true }).click();
  await expect(page.getByLabel('Cover letter', { exact: true })).toHaveValue(
    /I would like to apply/,
  );
  await page.getByLabel('Stage', { exact: true }).selectOption('interview');
  await page.getByRole('button', { name: 'Save application', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved → Interviewing', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByLabel('Note', { exact: true }).fill('Prepare the project walkthrough.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByText('Prepare the project walkthrough.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Test developer', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Test developer at Test company · ANQ Next Step');
  assert.ok(new URL(page.url()).searchParams.get('application'));
  await expect(page.getByText(/I would like to apply/)).toBeVisible();
  await expect(page.getByText('jobs@example.test', { exact: true })).toBeVisible();
  await expect(page.getByText('Submit the letter', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original listing ↗', exact: true })).toHaveAttribute(
    'href',
    'https://example.test/jobs/42',
  );
  await expect(page.getByText('Prepare the project walkthrough.', { exact: true })).toBeVisible();
  await workspaceLink(page, 'Follow-ups');
  await expect(page).toHaveURL(/view=followups/);
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Keep the conversation going.',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'View Test developer at Test company',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'View Test developer at Test company',
      exact: true,
    })
    .click();
  await page.goBack();
  await expect(
    page.getByRole('heading', {
      name: 'Keep the conversation going.',
      exact: true,
    }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Test developer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Record follow-up', exact: true }).click();
  await page
    .getByLabel('What happened / next action', { exact: true })
    .fill('Spoke with the team. No next date needed yet.');
  await page.getByLabel('Next action', { exact: true }).fill('Prepare interview examples');
  await page.getByRole('button', { name: 'Save follow-up', exact: true }).click();
  await expect(page.getByText(/Follow-up completed; no next date set/)).toBeVisible();
  await workspaceLink(page, 'Follow-ups');
  await expect(
    page.getByRole('button', { name: 'View Test developer at Test company', exact: true }),
  ).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Test developer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit application', exact: true }).click();
  await page.getByLabel('Archive this application (keeps its history)', { exact: true }).check();
  await page.getByRole('button', { name: 'Save application', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add note', exact: true })).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export JSON' }).click();
  const stream = await (await downloadPromise).createReadStream();
  let exported = '';
  for await (const chunk of stream!) exported += chunk;
  assert.equal(JSON.parse(exported).activities.length, 4);
  const saved = JSON.parse(exported).applications.find(
    (a: { company: string }) => a.company === 'Test company',
  );
  assert.match(saved.coverLetter, /I would like to apply/);
  assert.equal(saved.applicationAddress, 'jobs@example.test');
  assert.equal(saved.nextAction, 'Prepare interview examples');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  const demo = await createApp(pool, loadConfig({ DATABASE_URL: 'test', DEMO_MODE: 'true' }));
  apps.push(demo);
  const demoOrigin = await demo.listen({ host: '127.0.0.1', port: 0 });
  await page.goto(demoOrigin);
  await expect(page.getByRole('button', { name: 'Add application', exact: true })).toBeDisabled();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.goto(new URL('?application=missing', page.url()).href);
  await expect(
    page.getByText('Application not found in this workspace.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to applications', exact: true }).click();
  await page.getByLabel('Search applications', { exact: true }).fill('no-matching-company');
  await expect(
    page.getByText('No applications match this search. Try another company or role.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await page.getByLabel('Search applications', { exact: true }).fill('birch');
  await expect(
    page.getByRole('button', {
      name: 'View Frontend developer at Birch Studio',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'View Web developer at Forma Lab',
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByLabel('Search applications', { exact: true }).fill('');
  await page.getByLabel('Search applications', { exact: true }).blur();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  assert.deepEqual(
    accessibility.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
    [],
  );
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({
    path: 'docs/screenshots/pipeline-desktop.png',
    fullPage: true,
  });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/screenshots/pipeline-mobile.png',
    fullPage: true,
  });
  await workspaceLink(page, 'Activity');
  await expect(page.getByRole('heading', { name: 'Recent activity', exact: true })).toBeVisible();
  await workspaceLink(page, 'Applications');
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'View Test developer at Test company',
      exact: true,
    }),
  ).toBeVisible();
  await checkNavigationTheme(page, demoOrigin, true);
  assert.deepEqual(errors, []);
  console.log(
    'Browser workflows passed: owner create, stage history, notes, persistence, follow-up, archive, export, logout, public demo, search, mobile layout and accessibility.',
  );
} finally {
  for (const app of apps) await app.close();
  await browser.close();
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
}
