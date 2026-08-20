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
      .post('/lexis-nexis/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    token = res.body.access_token;

    const client = await prisma.client.findUniqueOrThrow({ where: { clientId: CLIENT_ID } });
    clientId = client.id;
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/lexis-nexis/report-types');
    expect(res.status).toBe(401);
  });

  it('creates a report type and returns it active', async () => {
    const res = await request(app)
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-a`, primary_actions: ['address-verification'] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.primary_actions).toEqual(['address-verification']);
  });

  it('rejects a duplicate name for the same client', async () => {
    const name = `RT ${Date.now()}-dup`;
    await request(app).post('/lexis-nexis/report-types').set(authed()).send({ name });

    const res = await request(app).post('/lexis-nexis/report-types').set(authed()).send({ name });

    expect(res.status).toBe(422);
    expect(res.body.errors.name[0].code).toBe(1327);
  });

  it('rejects an unknown report action name', async () => {
    const res = await request(app)
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-badaction`, primary_actions: ['not-a-real-action'] });

    expect(res.status).toBe(422);
    expect(res.body.errors.primary_actions[0].code).toBe(1037);
  });

  it('rejects a duplicate action within the same list', async () => {
    const res = await request(app)
      .post('/lexis-nexis/report-types')
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
      .post('/lexis-nexis/report-types')
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
      .post('/lexis-nexis/report-types')
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
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-goodscorecard`, scorecard_id: scorecard.id });

    expect(res.status).toBe(201);
    expect(res.body.data.scorecard_id).toBe(scorecard.id);
  });

  it('lists report types in the paginator envelope', async () => {
    const res = await request(app).get('/lexis-nexis/report-types').set(authed());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('links');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBeGreaterThan(0);
  });

  it('404s fetching an unknown report type id', async () => {
    const res = await request(app)
      .get('/lexis-nexis/report-types/00000000-0000-0000-0000-000000000000')
      .set(authed());

    expect(res.status).toBe(404);
  });

  it('partially updates a report type, leaving other fields untouched', async () => {
    const createRes = await request(app)
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-patch`, description: 'original', category: 'kyc' });
    const id = createRes.body.data.id;

    const patchRes = await request(app)
      .patch(`/lexis-nexis/report-types/${id}`)
      .set(authed())
      .send({ description: 'updated' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.description).toBe('updated');
    expect(patchRes.body.data.category).toBe('kyc');
    expect(patchRes.body.data.name).toBe(createRes.body.data.name);
  });

  it('deactivates and reactivates a report type', async () => {
    const createRes = await request(app)
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-lifecycle` });
    const id = createRes.body.data.id;

    const deleteRes = await request(app).delete(`/lexis-nexis/report-types/${id}`).set(authed());
    expect(deleteRes.status).toBe(204);
    expect(deleteRes.body).toEqual({});

    const getRes = await request(app).get(`/lexis-nexis/report-types/${id}`).set(authed());
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('INACTIVE');

    const reactivateRes = await request(app)
      .post(`/lexis-nexis/report-types/${id}/reactivate`)
      .set(authed());
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.status).toBe('ACTIVE');
  });

  it("filters by username — matches the caller's own profile, empty for any other username", async () => {
    await request(app)
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-usernamefilter` });
    const selfRes = await request(app).get('/lexis-nexis/users/self').set(authed());
    const username = selfRes.body.username as string | null;

    if (username) {
      const matchRes = await request(app)
        .get('/lexis-nexis/report-types')
        .query({ username })
        .set(authed());
      expect(matchRes.status).toBe(200);
      expect(matchRes.body.meta.total).toBeGreaterThan(0);
    }

    const noMatchRes = await request(app)
      .get('/lexis-nexis/report-types')
      .query({ username: `nobody-${Date.now()}` })
      .set(authed());
    expect(noMatchRes.status).toBe(200);
    expect(noMatchRes.body.data.length).toBe(0);
  });

  it('orders by name, ascending and descending', async () => {
    // Asserts the returned page is itself sorted, rather than looking for
    // two fixtures landing on the same page — this demo-client's report
    // types accumulate across every run of this suite (and the Postman
    // collection), so a fixed per_page can't assume any two rows share a
    // page.
    const ascRes = await request(app)
      .get('/lexis-nexis/report-types')
      .query({ order_by: 'name', order: 'asc', per_page: '100' })
      .set(authed());
    const ascNames: string[] = ascRes.body.data.map((rt: { name: string }) => rt.name);
    // Plain code-unit comparison, not localeCompare — matches Postgres's
    // byte-order ("C") default collation, which locale-aware comparison
    // can disagree with (case-folding, punctuation weighting).
    expect(ascNames).toEqual([...ascNames].sort());

    const descRes = await request(app)
      .get('/lexis-nexis/report-types')
      .query({ order_by: 'name', order: 'desc', per_page: '100' })
      .set(authed());
    const descNames: string[] = descRes.body.data.map((rt: { name: string }) => rt.name);
    expect(descNames).toEqual([...descNames].sort().reverse());
  });

  it('rejects an invalid order_by value (422/1319)', async () => {
    const res = await request(app)
      .get('/lexis-nexis/report-types')
      .query({ order_by: 'not_a_real_column' })
      .set(authed());
    expect(res.status).toBe(422);
    expect(res.body.errors.order_by[0].code).toBe(1319);
  });
});
