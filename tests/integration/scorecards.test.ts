import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('scorecards', () => {
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

  async function createValidScorecard(name: string) {
    return request(app)
      .post('/scorecards')
      .set(authed())
      .send({
        name,
        pass_threshold: 80,
        fail_threshold: 40,
        groups: [
          {
            group_name: 'identity',
            min_score: 50,
            rules: [{ attribute: 'address_verified', match_score: 30, no_match_score: -30 }],
          },
        ],
      });
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/scorecards');
    expect(res.status).toBe(401);
  });

  it('creates a scorecard as DRAFT, version 1', async () => {
    const res = await createValidScorecard(`SC ${Date.now()}-a`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.version).toBe(1);
  });

  it('rejects pass_threshold <= fail_threshold', async () => {
    const res = await request(app)
      .post('/scorecards')
      .set(authed())
      .send({
        name: `SC ${Date.now()}-badthreshold`,
        pass_threshold: 10,
        fail_threshold: 40,
        groups: [],
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.pass_threshold[0].code).toBe(1163);
  });

  it('rejects an unknown rule attribute', async () => {
    const res = await request(app)
      .post('/scorecards')
      .set(authed())
      .send({
        name: `SC ${Date.now()}-badattr`,
        groups: [
          {
            group_name: 'identity',
            min_score: 50,
            rules: [{ attribute: 'not_a_real_attribute', match_score: 1, no_match_score: -1 }],
          },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.errors['groups.0.rules.0.attribute'][0].code).toBe(1171);
  });

  it('rejects a duplicate attribute within one group', async () => {
    const res = await request(app)
      .post('/scorecards')
      .set(authed())
      .send({
        name: `SC ${Date.now()}-duprule`,
        groups: [
          {
            group_name: 'identity',
            min_score: 50,
            rules: [
              { attribute: 'pep', match_score: 1, no_match_score: -1 },
              { attribute: 'pep', match_score: 2, no_match_score: -2 },
            ],
          },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.errors['groups.0.rules'][0].code).toBe(1173);
  });

  it('rejects duplicate group_name across groups', async () => {
    const res = await request(app)
      .post('/scorecards')
      .set(authed())
      .send({
        name: `SC ${Date.now()}-dupgroup`,
        groups: [
          { group_name: 'identity', min_score: 50, rules: [] },
          { group_name: 'identity', min_score: 60, rules: [] },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.groups[0].code).toBe(1166);
  });

  it('rejects a duplicate scorecard name for the same client', async () => {
    const name = `SC ${Date.now()}-dupname`;
    await createValidScorecard(name);

    const res = await createValidScorecard(name);

    expect(res.status).toBe(422);
    expect(res.body.errors.name[0].code).toBe(1326);
  });

  it('lists scorecards in the paginator envelope', async () => {
    const res = await request(app).get('/scorecards').set(authed());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('links');
    expect(res.body).toHaveProperty('meta');
  });

  it('404s fetching an unknown scorecard id', async () => {
    const res = await request(app)
      .get('/scorecards/00000000-0000-0000-0000-000000000000')
      .set(authed());
    expect(res.status).toBe(404);
  });

  it('bumps version on every successful update', async () => {
    const createRes = await createValidScorecard(`SC ${Date.now()}-version`);
    const id = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/scorecards/${id}`)
      .set(authed())
      .send({ pass_threshold: 90 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.version).toBe(2);
    expect(patchRes.body.pass_threshold).toBe(90);
  });

  it('rejects editing a RETIRED scorecard', async () => {
    const createRes = await createValidScorecard(`SC ${Date.now()}-editretired`);
    const id = createRes.body.id;
    await request(app).post(`/scorecards/${id}/retire`).set(authed());

    const patchRes = await request(app)
      .patch(`/scorecards/${id}`)
      .set(authed())
      .send({ pass_threshold: 90 });

    expect(patchRes.status).toBe(422);
  });

  it('publishes and retires a scorecard, including no-op re-calls', async () => {
    const createRes = await createValidScorecard(`SC ${Date.now()}-lifecycle`);
    const id = createRes.body.id;

    const publishRes = await request(app).post(`/scorecards/${id}/publish`).set(authed());
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.status).toBe('PUBLISHED');

    const publishAgainRes = await request(app).post(`/scorecards/${id}/publish`).set(authed());
    expect(publishAgainRes.status).toBe(200);
    expect(publishAgainRes.body.status).toBe('PUBLISHED');

    const retireRes = await request(app).post(`/scorecards/${id}/retire`).set(authed());
    expect(retireRes.status).toBe(200);
    expect(retireRes.body.status).toBe('RETIRED');

    const retireAgainRes = await request(app).post(`/scorecards/${id}/retire`).set(authed());
    expect(retireAgainRes.status).toBe(200);
    expect(retireAgainRes.body.status).toBe('RETIRED');
  });

  it('rejects deleting a scorecard attached to a report type, then allows it once detached', async () => {
    const createRes = await createValidScorecard(`SC ${Date.now()}-attached`);
    const scorecardId = createRes.body.id;

    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-attached`, scorecard_id: scorecardId });
    expect(reportTypeRes.status).toBe(201);

    const deleteRes = await request(app).delete(`/scorecards/${scorecardId}`).set(authed());
    expect(deleteRes.status).toBe(422);
    expect(deleteRes.body.errors.scorecard_id[0].code).toBe(1241);

    await prisma.reportType.update({
      where: { id: reportTypeRes.body.id },
      data: { scorecardId: null },
    });

    const deleteAgainRes = await request(app).delete(`/scorecards/${scorecardId}`).set(authed());
    expect(deleteAgainRes.status).toBe(204);

    const getRes = await request(app).get(`/scorecards/${scorecardId}`).set(authed());
    expect(getRes.status).toBe(404);
  });

  it('rejects assigning a RETIRED scorecard as a new report type scorecard_id', async () => {
    const createRes = await createValidScorecard(`SC ${Date.now()}-retiredassign`);
    const scorecardId = createRes.body.id;
    await request(app).post(`/scorecards/${scorecardId}/retire`).set(authed());

    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-retiredassign`, scorecard_id: scorecardId });

    expect(reportTypeRes.status).toBe(422);
    expect(reportTypeRes.body.errors.scorecard_id[0].code).toBe(1179);
  });
});
