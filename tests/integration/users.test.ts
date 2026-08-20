import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

/**
 * `demo-client` is a shared, persistent seeded client reused across the
 * whole test suite (and across repeated `npm test` runs) — its
 * self/company/options singleton rows are never reset, so "auto-creates
 * on first access" can't be asserted against it. Each such test creates
 * its own throwaway client instead, guaranteeing genuinely fresh state.
 */
async function createFreshClientToken(app: ReturnType<typeof createApp>): Promise<string> {
  const clientId = `fresh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const secret = 'fresh-secret';
  await prisma.client.create({
    data: { clientId, clientSecretHash: await bcrypt.hash(secret, 4), name: 'Fresh Test Client' },
  });
  const res = await request(app)
    .post('/oauth/token')
    .send({ client_id: clientId, client_secret: secret });
  return res.body.access_token;
}

describe('users module', () => {
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    token = res.body.access_token;
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  describe('self', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/users/self');
      expect(res.status).toBe(401);
    });

    it('auto-creates on first access, with every field null', async () => {
      const freshToken = await createFreshClientToken(app);
      const res = await request(app)
        .get('/users/self')
        .set({ Authorization: `Bearer ${freshToken}` });
      expect(res.status).toBe(200);
      expect(res.body.username).toBeNull();
      expect(res.body.gender).toBeNull();
    });

    it('persists an update', async () => {
      const username = `user_${Date.now()}`;
      const res = await request(app)
        .patch('/users/self')
        .set(authed())
        .send({ username, gender: 'other' });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(username);

      const getRes = await request(app).get('/users/self').set(authed());
      expect(getRes.body.username).toBe(username);
      expect(getRes.body.gender).toBe('other');
    });

    it('rejects an invalid gender', async () => {
      const res = await request(app)
        .patch('/users/self')
        .set(authed())
        .send({ gender: 'not-a-real-option' });
      expect(res.status).toBe(422);
      expect(res.body.errors.gender[0].code).toBe(1210);
    });

    it('allows a client to re-save its own current username (no-op, not a collision)', async () => {
      const username = `selfsame_${Date.now()}`;
      await request(app).patch('/users/self').set(authed()).send({ username });

      const res = await request(app).patch('/users/self').set(authed()).send({ username });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(username);
    });

    it('rejects a username already taken by a different client', async () => {
      const username = `taken_${Date.now()}`;
      const otherClient = await prisma.client.create({
        data: {
          clientId: `other-${Date.now()}`,
          clientSecretHash: 'irrelevant',
          name: 'Other Client',
        },
      });
      await prisma.userProfile.create({ data: { clientId: otherClient.id, username } });

      const res = await request(app).patch('/users/self').set(authed()).send({ username });
      expect(res.status).toBe(422);
      expect(res.body.errors.username[0].code).toBe(1318);
    });
  });

  describe('company', () => {
    it('auto-creates with a null name, then updates', async () => {
      const freshToken = await createFreshClientToken(app);
      const freshAuthed = { Authorization: `Bearer ${freshToken}` };

      const getRes = await request(app).get('/users/company').set(freshAuthed);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBeNull();

      const name = `Company ${Date.now()}`;
      const patchRes = await request(app).patch('/users/company').set(freshAuthed).send({ name });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe(name);
    });
  });

  describe('options', () => {
    it('auto-creates with the confirmed defaults', async () => {
      const freshToken = await createFreshClientToken(app);
      const res = await request(app)
        .get('/users/options')
        .set({ Authorization: `Bearer ${freshToken}` });

      expect(res.status).toBe(200);
      expect(res.body.sanction).toBeUndefined();
      expect(res.body.remote_check).toBe(true);
      expect(res.body.config).toEqual({
        full_er: false,
        age_min: null,
        age_max: null,
        nfi_address: false,
      });
    });

    it('persists a toggle', async () => {
      const patchRes = await request(app)
        .patch('/users/options')
        .set(authed())
        .send({ remote_check: false });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.remote_check).toBe(false);

      const getRes = await request(app).get('/users/options').set(authed());
      expect(getRes.body.remote_check).toBe(false);
    });

    it('rejects config.age_min greater than config.age_max', async () => {
      const res = await request(app)
        .patch('/users/options')
        .set(authed())
        .send({ config: { age_min: 50, age_max: 20 } });

      expect(res.status).toBe(422);
      expect(res.body.errors['config.age_min'][0].code).toBe(1197);
    });

    it('persists bridger_* fields', async () => {
      const res = await request(app)
        .patch('/users/options')
        .set(authed())
        .send({ bridger_client_id: 'abc123', bridger_customer_toggle: true });

      expect(res.status).toBe(200);
      expect(res.body.bridger_client_id).toBe('abc123');
      expect(res.body.bridger_customer_toggle).toBe(true);
    });
  });

  describe('activity-logs', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/users/activity-logs');
      expect(res.status).toBe(401);
    });

    it('records real requests with method/path/status, filterable by status', async () => {
      await request(app).get('/users/self').set(authed());
      await request(app).get('/report-types/00000000-0000-0000-0000-000000000000').set(authed());

      // The write is fire-and-forget (see middleware/activityLog.ts) —
      // give it a moment to land before asserting on it.
      await new Promise((resolve) => setTimeout(resolve, 200));

      const res = await request(app)
        .get('/users/activity-logs')
        .query({ status: 404 })
        .set(authed());
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((entry: { status: number }) => entry.status === 404)).toBe(true);
    });

    it('returns the paginator envelope', async () => {
      const res = await request(app).get('/users/activity-logs').set(authed());
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('links');
      expect(res.body).toHaveProperty('meta');
    });

    it('filters by ip', async () => {
      await request(app).get('/users/self').set(authed());
      await new Promise((resolve) => setTimeout(resolve, 200));

      const unfiltered = await request(app).get('/users/activity-logs').set(authed());
      const ip = unfiltered.body.data[0].ip;
      expect(ip).toBeTruthy();

      const res = await request(app).get('/users/activity-logs').query({ ip }).set(authed());
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((entry: { ip: string }) => entry.ip === ip)).toBe(true);
    });

    it('rejects path_identifier/ip/server_name exceeding the max length', async () => {
      const res = await request(app)
        .get('/users/activity-logs')
        .query({
          path_identifier: 'x'.repeat(256),
          ip: 'x'.repeat(256),
          server_name: 'x'.repeat(256),
        })
        .set(authed());

      expect(res.status).toBe(422);
      expect(res.body.errors.path_identifier[0].code).toBe(1139);
      expect(res.body.errors.ip[0].code).toBe(1142);
      expect(res.body.errors.server_name[0].code).toBe(1143);
    });
  });
});
