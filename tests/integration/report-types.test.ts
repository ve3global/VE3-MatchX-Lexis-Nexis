import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('report types', () => {
  const app = createApp();
  let token: string;
  let clientId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    token = res.body.access_token;

    const client = await prisma.client.findUniqueOrThrow({ where: { clientId: CLIENT_ID } });
    clientId = client.id;
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/report-types');
    expect(res.status).toBe(401);
  });

  it('creates a report type and returns it active', async () => {
    const res = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-a`, primary_actions: ['address-verification'] });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.primary_actions).toEqual(['address-verification']);
  });

  it('rejects a duplicate name for the same client', async () => {
    const name = `RT ${Date.now()}-dup`;
    await request(app).post('/report-types').set(authed()).send({ name });

    const res = await request(app).post('/report-types').set(authed()).send({ name });

    expect(res.status).toBe(422);
    expect(res.body.errors.name[0].code).toBe(1327);
  });

  it('rejects an unknown report action name', async () => {
    const res = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-badaction`, primary_actions: ['not-a-real-action'] });

    expect(res.status).toBe(422);
    expect(res.body.errors.primary_actions[0].code).toBe(1037);
  });

  it('rejects a duplicate action within the same list', async () => {
    const res = await request(app)
      .post('/report-types')
      .set(authed())
      .send({
        name: `RT ${Date.now()}-dupaction`,
        primary_actions: ['address-verification', 'address-verification'],
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.primary_actions.map((e: { code: number }) => e.code)).toContain(1038);
  });

  it('rejects an action that appears in both primary and secondary lists', async () => {
    const res = await request(app)
      .post('/report-types')
      .set(authed())
      .send({
        name: `RT ${Date.now()}-overlap`,
        primary_actions: ['pep-screening'],
        secondary_actions: ['pep-screening'],
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.primary_actions[0].code).toBe(1347);
    expect(res.body.errors.secondary_actions[0].code).toBe(1348);
  });

  it('rejects a scorecard_id that does not exist', async () => {
    const res = await request(app)
      .post('/report-types')
      .set(authed())
      .send({
        name: `RT ${Date.now()}-badscorecard`,
        scorecard_id: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.scorecard_id[0].code).toBe(1179);
  });

  it('accepts a scorecard_id owned by the same client', async () => {
    const scorecard = await prisma.scorecard.findFirstOrThrow({ where: { clientId } });

    const res = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-goodscorecard`, scorecard_id: scorecard.id });

    expect(res.status).toBe(201);
    expect(res.body.scorecard_id).toBe(scorecard.id);
  });

  it('lists report types in the paginator envelope', async () => {
    const res = await request(app).get('/report-types').set(authed());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('links');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it('404s fetching an unknown report type id', async () => {
    const res = await request(app)
      .get('/report-types/00000000-0000-0000-0000-000000000000')
      .set(authed());

    expect(res.status).toBe(404);
  });

  it('partially updates a report type, leaving other fields untouched', async () => {
    const createRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-patch`, description: 'original', category: 'kyc' });
    const id = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/report-types/${id}`)
      .set(authed())
      .send({ description: 'updated' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.description).toBe('updated');
    expect(patchRes.body.category).toBe('kyc');
    expect(patchRes.body.name).toBe(createRes.body.name);
  });

  it('deactivates and reactivates a report type', async () => {
    const createRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-lifecycle` });
    const id = createRes.body.id;

    const deleteRes = await request(app).delete(`/report-types/${id}`).set(authed());
    expect(deleteRes.status).toBe(204);
    expect(deleteRes.body).toEqual({});

    const getRes = await request(app).get(`/report-types/${id}`).set(authed());
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('INACTIVE');

    const reactivateRes = await request(app).post(`/report-types/${id}/reactivate`).set(authed());
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.status).toBe('ACTIVE');
  });
});
