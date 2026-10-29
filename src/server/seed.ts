import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { demoMaterials } from './demo-materials.js';
if (process.env.SEED_DEMO !== 'true' || !process.env.DATABASE_URL)
  throw new Error(
    'Set SEED_DEMO=true and DATABASE_URL explicitly; fictional records are inserted into an empty workspace only.',
  );
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
try {
  await client.query('BEGIN');
  await client.query('LOCK TABLE applications IN EXCLUSIVE MODE');
  if ((await client.query('SELECT 1 FROM applications LIMIT 1')).rowCount)
    throw new Error('Refusing to seed a non-empty workspace');
  const examples = [
    [
      'Birch Studio',
      'Frontend developer',
      'Oslo · Hybrid',
      'saved',
      null,
      day(3),
      'Explore the team’s accessibility work before applying.',
    ],
    [
      'Northline Tools',
      'Full-stack developer',
      'Remote · Norway',
      'applied',
      day(-7),
      day(-1),
      'Prepare a short walkthrough of the server-ops project.',
    ],
    [
      'Moss & Co.',
      'Junior software developer',
      'Bergen · Hybrid',
      'interview',
      day(-14),
      day(1),
      'Practice explaining a database migration and rollback.',
    ],
    [
      'Forma Lab',
      'Web developer',
      'Trondheim · On-site',
      'offer',
      day(-21),
      day(2),
      'Compare the role, mentoring, and practical terms before deciding.',
    ],
    [
      'Harbor Systems',
      'React developer',
      'Remote',
      'rejected',
      day(-28),
      null,
      'Fictional outcome: position filled. Keep the preparation notes for next time.',
    ],
  ];
  for (const [company, role, location, stage, appliedOn, followUpOn, notes] of examples) {
    const id = randomUUID();
    const materials = demoMaterials(
      String(company),
      String(role),
      stage === 'rejected' ? '' : String(notes),
    );
    await client.query(
      "INSERT INTO applications(id,company,role,location,job_url,contact,salary,notes,stage,applied_on,follow_up_on,cover_letter,application_address,next_action) VALUES ($1,$2,$3,$4,'','','',$5,$6,$7,$8,$9,$10,$11)",
      [
        id,
        company,
        role,
        location,
        `Fictional demo application. ${notes}`,
        stage,
        appliedOn,
        followUpOn,
        materials.coverLetter,
        materials.applicationAddress,
        materials.nextAction,
      ],
    );
    await client.query(
      "INSERT INTO activities(id,application_id,kind,body,to_stage) VALUES ($1,$2,'created','Fictional application added to the demo',$3)",
      [randomUUID(), id, stage],
    );
    await client.query(
      "INSERT INTO activities(id,application_id,kind,body) VALUES ($1,$2,'note',$3)",
      [randomUUID(), id, notes],
    );
  }
  await client.query('COMMIT');
  console.log('Fictional application workspace created');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
