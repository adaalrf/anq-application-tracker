import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type pg from 'pg';
import { z } from 'zod';
import type { Config } from './config.js';
import { newToken, tokenHash, verifyPassword } from './auth.js';
import {
  applicationInput,
  applicationUpdate,
  noteInput,
  followUpInput,
  isActive,
} from '../shared/model.js';

const applicationSelect = `SELECT a.id,a.company,a.role,a.location,a.job_url AS "jobUrl",a.contact,a.salary,a.notes,a.stage,
 a.cover_letter AS "coverLetter",a.application_address AS "applicationAddress",a.next_action AS "nextAction",
 a.applied_on::text AS "appliedOn",a.follow_up_on::text AS "followUpOn",a.archived,a.version,
 a.created_at AS "createdAt",a.updated_at AS "updatedAt" FROM applications a`;
const activitySelect = `SELECT e.id,e.application_id AS "applicationId",a.company,a.role,e.kind,e.body,
 e.from_stage AS "fromStage",e.to_stage AS "toStage",e.created_at AS "createdAt"
 FROM activities e JOIN applications a ON a.id=e.application_id`;
const idSchema = z.object({ id: z.uuid() });
function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}

export async function createApp(
  pool: pg.Pool,
  config: Config,
  options: { logger?: boolean; staticRoot?: string } = {},
) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 131_072,
    requestTimeout: 15_000,
    loggerInstance: undefined,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({
        message: error.issues.map((i) => `${i.path.join('.') || 'Input'}: ${i.message}`).join('; '),
      });
    const err = error as Error & { statusCode?: number };
    const status =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) request.log.error(error);
    return reply.code(status).send({
      message:
        status === 500 ? 'The request could not be completed. Please try again.' : err.message,
    });
  });
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    if (request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });
  async function authenticated(request: { cookies: Record<string, string | undefined> }) {
    const token = request.cookies['tracker_session'];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
    const result = await pool.query(
      'SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at > now()',
      [tokenHash(token)],
    );
    return result.rowCount === 1;
  }
  app.addHook('preHandler', async (request) => {
    if (!request.url.startsWith('/api/')) return;
    const path = request.url.split('?')[0];
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (mutation) {
      if (config.demo)
        fail(403, 'The public demo is read-only. Run your own instance to make changes.');
      if (request.headers.origin !== config.origin) fail(403, 'Request origin is not allowed.');
    }
    if (['/api/login', '/api/session'].includes(path)) return;
    if (!config.demo && !(await authenticated(request))) fail(401, 'Sign in to continue.');
  });
  app.get('/healthz', async (_, reply) => {
    try {
      await pool.query('SELECT id FROM applications LIMIT 1');
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
  app.get('/api/session', async (request) => ({
    demo: config.demo,
    authenticated: !config.demo && (await authenticated(request)),
    username: config.username,
  }));
  app.post(
    '/api/login',
    { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = z
        .object({ username: z.string().max(80), password: z.string().max(256) })
        .strict()
        .parse(request.body);
      const valid = await verifyPassword(input.password, config.passwordHash);
      if (input.username !== config.username || !valid)
        fail(401, 'Incorrect username or password.');
      const token = newToken();
      await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
      await pool.query(
        "INSERT INTO sessions(token_hash,expires_at) VALUES ($1, now() + interval '12 hours')",
        [tokenHash(token)],
      );
      reply.setCookie('tracker_session', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: config.secureCookie,
        path: '/',
        maxAge: 43_200,
      });
      return { authenticated: true };
    },
  );
  app.post('/api/logout', async (request, reply) => {
    if (request.cookies.tracker_session)
      await pool.query('DELETE FROM sessions WHERE token_hash=$1', [
        tokenHash(request.cookies.tracker_session),
      ]);
    reply.clearCookie('tracker_session', {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: config.secureCookie,
    });
    return { authenticated: false };
  });

  app.get(
    '/api/applications',
    async () =>
      (await pool.query(`${applicationSelect} ORDER BY a.archived,a.updated_at DESC,a.id`)).rows,
  );
  app.post('/api/applications', async (request, reply) => {
    const input = applicationInput.parse(request.body);
    const id = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO applications(id,company,role,location,job_url,contact,salary,notes,stage,applied_on,follow_up_on,cover_letter,application_address,next_action)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          id,
          input.company,
          input.role,
          input.location,
          input.jobUrl,
          input.contact,
          input.salary,
          input.notes,
          input.stage,
          input.appliedOn,
          input.followUpOn,
          input.coverLetter,
          input.applicationAddress,
          input.nextAction,
        ],
      );
      await client.query(
        `INSERT INTO activities(id,application_id,kind,body,to_stage) VALUES ($1,$2,'created','Application added',$3)`,
        [randomUUID(), id, input.stage],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return reply
      .code(201)
      .send((await pool.query(`${applicationSelect} WHERE a.id=$1`, [id])).rows[0]);
  });
  app.put('/api/applications/:id', async (request) => {
    const { id } = idSchema.parse(request.params);
    const input = applicationUpdate.parse(request.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const previous = (
        await client.query('SELECT version,stage FROM applications WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!previous) fail(404, 'Application not found.');
      if (previous.version !== input.version)
        fail(409, 'This application changed in another session. Reload before saving.');
      await client.query(
        `UPDATE applications SET company=$2,role=$3,location=$4,job_url=$5,contact=$6,salary=$7,notes=$8,
        stage=$9,applied_on=$10,follow_up_on=$11,archived=$12,cover_letter=COALESCE($13,cover_letter),application_address=COALESCE($14,application_address),next_action=COALESCE($15,next_action),version=version+1,updated_at=now() WHERE id=$1`,
        [
          id,
          input.company,
          input.role,
          input.location,
          input.jobUrl,
          input.contact,
          input.salary,
          input.notes,
          input.stage,
          input.appliedOn,
          input.followUpOn,
          input.archived,
          input.coverLetter,
          input.applicationAddress,
          input.nextAction,
        ],
      );
      if (previous.stage !== input.stage)
        await client.query(
          `INSERT INTO activities(id,application_id,kind,body,from_stage,to_stage) VALUES ($1,$2,'stage','Stage updated',$3,$4)`,
          [randomUUID(), id, previous.stage, input.stage],
        );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return (await pool.query(`${applicationSelect} WHERE a.id=$1`, [id])).rows[0];
  });
  app.get('/api/activities', async (request) => {
    const query = z
      .object({
        applicationId: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .strict()
      .parse(request.query);
    return (
      await pool.query(
        `${activitySelect} ${query.applicationId ? 'WHERE e.application_id=$1' : ''} ORDER BY e.created_at DESC,e.id LIMIT $${query.applicationId ? 2 : 1}`,
        query.applicationId ? [query.applicationId, query.limit] : [query.limit],
      )
    ).rows;
  });
  app.post('/api/applications/:id/notes', async (request, reply) => {
    const { id } = idSchema.parse(request.params);
    const input = noteInput.parse(request.body);
    const entryId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const record = (
        await client.query('SELECT archived FROM applications WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!record) fail(404, 'Application not found.');
      if (record.archived) fail(409, 'Restore this application before adding notes.');
      await client.query(
        `INSERT INTO activities(id,application_id,kind,body) VALUES ($1,$2,'note',$3)`,
        [entryId, id, input.body],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return reply
      .code(201)
      .send((await pool.query(`${activitySelect} WHERE e.id=$1`, [entryId])).rows[0]);
  });
  app.post('/api/applications/:id/follow-up', async (request) => {
    const { id } = idSchema.parse(request.params);
    const input = followUpInput.parse(request.body);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const previous = (
        await client.query(
          'SELECT version,stage,archived FROM applications WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!previous) fail(404, 'Application not found.');
      if (previous.version !== input.version)
        fail(409, 'This application changed in another session. Reload before saving.');
      if (previous.archived || !isActive(previous.stage))
        fail(409, 'Follow-ups are available for active applications only.');
      await client.query(
        'UPDATE applications SET follow_up_on=$2,next_action=COALESCE($3,next_action),version=version+1,updated_at=now() WHERE id=$1',
        [id, input.followUpOn, input.nextAction ?? null],
      );
      const summary = input.followUpOn
        ? `Next follow-up: ${input.followUpOn}`
        : 'Follow-up completed; no next date set.';
      await client.query(
        "INSERT INTO activities(id,application_id,kind,body) VALUES ($1,$2,'note',$3)",
        [
          randomUUID(),
          id,
          `${summary}${input.nextAction ? `\nNext action: ${input.nextAction}` : ''}\n\n${input.body}`,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return (await pool.query(`${applicationSelect} WHERE a.id=$1`, [id])).rows[0];
  });
  app.get('/api/export', async (_, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const applications = (await client.query(`${applicationSelect} ORDER BY a.id`)).rows;
      const activities = (await client.query(`${activitySelect} ORDER BY e.created_at DESC,e.id`))
        .rows;
      await client.query('COMMIT');
      reply.header('Content-Disposition', 'attachment; filename="application-tracker-export.json"');
      return { schemaVersion: 1, exportedAt: new Date().toISOString(), applications, activities };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });
  const root = options.staticRoot ?? resolve('dist/client');
  if (existsSync(root)) await app.register(staticFiles, { root, index: ['index.html'] });
  return app;
}
