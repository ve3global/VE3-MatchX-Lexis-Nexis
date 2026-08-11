import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('reports', () => {
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

  const validInline = {
    forename: 'Bella',
    surname: 'Henderson',
    dob: '1980-01-01',
    address: { address1: '204 Julius Road', postcode: 'BS7 8EU' },
    enduser_agreement: true,
  };

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/reports');
    expect(res.status).toBe(401);
  });

  it('creates an inline report as STARTED', async () => {
    const res = await request(app).post('/reports').set(authed()).send(validInline);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('STARTED');
    expect(res.body.forename).toBe('Bella');
    expect(res.body.address).toEqual({ address1: '204 Julius Road', postcode: 'BS7 8EU' });
    expect(res.body.attributes).toEqual({});
    expect(res.body.assessment).toBeNull();
  });

  it('rejects an inline report missing required fields', async () => {
    const res = await request(app).post('/reports').set(authed()).send({});

    expect(res.status).toBe(422);
    expect(res.body.errors.forename[0].code).toBe(1007);
    expect(res.body.errors.surname[0].code).toBe(1010);
    expect(res.body.errors.enduser_agreement[0].code).toBe(1055);
    expect(res.body.errors.dob[0].code).toBe(1052);
    expect(res.body.errors['address.address1'][0].code).toBe(1053);
    expect(res.body.errors['address.postcode'][0].code).toBe(1054);
  });

  it('rejects report_type_id combined with inline fields', async () => {
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-combo` });

    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id, forename: 'Bella' });

    expect(res.status).toBe(422);
    expect(res.body.errors.forename[0].code).toBe(1149);
  });

  it('rejects a nonexistent report_type_id', async () => {
    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(422);
    expect(res.body.errors.report_type_id).toBeDefined();
  });

  it('completes immediately for a report type with no primary actions', async () => {
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-noactions`, primary_actions: [] });

    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETE');
  });

  it('completes immediately for a primary action needing no input beyond the subject (EPIC-7)', async () => {
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-autorun`, primary_actions: ['address-verification'] });

    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETE');
    expect(res.body['address-verification']).toHaveProperty('address_verified');
    expect(res.body.attributes).toHaveProperty('address_verified');
  });

  it('stays STARTED for a primary action needing input the create-report request never collects', async () => {
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-needsinput`, primary_actions: ['bank-account-validation'] });

    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('STARTED');
  });

  it('rejects creating against a report type with reference_required and no reference', async () => {
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-refreq`, reference_required: true });

    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });

    expect(res.status).toBe(422);
    expect(res.body.errors.reference[0].code).toBe(1250);
  });

  it('rejects creating against an inactive report type', async () => {
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-inactive` });
    await request(app).delete(`/report-types/${reportTypeRes.body.id}`).set(authed());

    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });

    expect(res.status).toBe(422);
  });

  it('carries the report type scorecard onto the report and computes an assessment', async () => {
    const scorecardRes = await request(app)
      .post('/scorecards')
      .set(authed())
      .send({
        name: `SC ${Date.now()}-assess`,
        pass_threshold: 80,
        fail_threshold: 40,
        groups: [
          {
            group_name: 'identity',
            min_score: 0,
            rules: [{ attribute: 'address_verified', match_score: 30, no_match_score: -30 }],
          },
        ],
      });
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({
        name: `RT ${Date.now()}-scored`,
        scorecard_id: scorecardRes.body.id,
        primary_actions: [],
      });

    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });

    expect(res.status).toBe(201);
    expect(res.body.assessment).toEqual({ score: -30, result: 'FAIL', groups: expect.any(Array) });
  });

  it('fetches a report by id and 404s for an unknown id', async () => {
    const createRes = await request(app).post('/reports').set(authed()).send(validInline);

    const getRes = await request(app).get(`/reports/${createRes.body.id}`).set(authed());
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(createRes.body.id);

    const notFoundRes = await request(app)
      .get('/reports/00000000-0000-0000-0000-000000000000')
      .set(authed());
    expect(notFoundRes.status).toBe(404);
  });

  it('lists reports in the paginator envelope, filterable by surname', async () => {
    const surname = `Unique${Date.now()}`;
    await request(app)
      .post('/reports')
      .set(authed())
      .send({ ...validInline, surname });

    const res = await request(app).get('/reports').query({ surname }).set(authed());

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((r: { surname: string }) => r.surname === surname)).toBe(true);
  });

  it('soft-deletes a report — subsequent GET 404s', async () => {
    const createRes = await request(app).post('/reports').set(authed()).send(validInline);
    const id = createRes.body.id;

    const deleteRes = await request(app).delete(`/reports/${id}`).set(authed());
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/reports/${id}`).set(authed());
    expect(getRes.status).toBe(404);
  });

  it('filters by postcode (JSON path) and by date_from/date_to', async () => {
    const postcode = `PC${Date.now()}`;
    const createRes = await request(app)
      .post('/reports')
      .set(authed())
      .send({ ...validInline, address: { address1: '1 Test Street', postcode } });
    expect(createRes.status).toBe(201);

    const postcodeRes = await request(app).get('/reports').query({ postcode }).set(authed());
    expect(postcodeRes.status).toBe(200);
    expect(postcodeRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(postcodeRes.body.data.every((r: { id: string }) => r.id === createRes.body.id)).toBe(
      true,
    );

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const dateRangeRes = await request(app)
      .get('/reports')
      .query({ postcode, date_from: today, date_to: tomorrow })
      .set(authed());
    expect(dateRangeRes.status).toBe(200);
    expect(dateRangeRes.body.data.some((r: { id: string }) => r.id === createRes.body.id)).toBe(
      true,
    );

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const outOfRangeRes = await request(app)
      .get('/reports')
      .query({ postcode, date_from: yesterday, date_to: yesterday })
      .set(authed());
    expect(outOfRangeRes.body.data.length).toBe(0);
  });

  it('records audit log entries for create and delete', async () => {
    const createRes = await request(app).post('/reports').set(authed()).send(validInline);
    const id = createRes.body.id;

    await request(app).delete(`/reports/${id}`).set(authed());

    const auditRes = await request(app).get(`/reports/${id}/audit`).set(authed());
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.map((e: { event_type: string }) => e.event_type)).toEqual([
      'CREATED',
      'DELETED',
    ]);
  });

  it('returns submitted subject fields as input-data', async () => {
    const createRes = await request(app).post('/reports').set(authed()).send(validInline);

    const res = await request(app).get(`/reports/${createRes.body.id}/input-data`).set(authed());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      forename: 'Bella',
      middlename: null,
      surname: 'Henderson',
      dob: '1980-01-01',
      address: { address1: '204 Julius Road', postcode: 'BS7 8EU' },
      reference: null,
    });
  });
});
