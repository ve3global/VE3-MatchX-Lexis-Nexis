import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('notifications', () => {
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    token = res.body.access_token;
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/lexis-nexis/notifications');
    expect(res.status).toBe(401);
  });

  it('lists notifications in the paginator envelope', async () => {
    const res = await request(app).get('/lexis-nexis/notifications').set(authed());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('links');
    expect(res.body).toHaveProperty('meta');
  });

  it('rejects a malformed PATCH body', async () => {
    const listRes = await request(app).get('/lexis-nexis/notifications').set(authed());
    const anyId = listRes.body.data[0]?.id ?? '00000000-0000-0000-0000-000000000000';

    const res = await request(app)
      .patch(`/lexis-nexis/notifications/${anyId}`)
      .set(authed())
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.errors.read[0].code).toBe(1281);
  });

  it('creates exactly one notification when a report type with no primary actions completes, and none on re-fetch', async () => {
    const reportTypeRes = await request(app)
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-notif`, primary_actions: [] });

    const before = await request(app)
      .get('/lexis-nexis/notifications')
      .set(authed())
      .query({ per_page: 1 });
    const totalBefore = before.body.meta.total;

    const createRes = await request(app)
      .post('/lexis-nexis/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.data.id });
    expect(createRes.body.data.status).toBe('COMPLETE');

    await request(app).get(`/lexis-nexis/reports/${createRes.body.data.id}`).set(authed());
    await request(app).get(`/lexis-nexis/reports/${createRes.body.data.id}`).set(authed());

    const after = await request(app)
      .get('/lexis-nexis/notifications')
      .set(authed())
      .query({ per_page: 1 });
    expect(after.body.meta.total).toBe(totalBefore + 1);
  });

  it('creates a notification when a report completes via an individually-run action, marks it read', async () => {
    const reportTypeRes = await request(app)
      .post('/lexis-nexis/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-notifmanual`, primary_actions: ['bank-account-validation'] });
    const createRes = await request(app)
      .post('/lexis-nexis/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.data.id });
    expect(createRes.body.data.status).toBe('STARTED');

    await request(app)
      .post(`/lexis-nexis/reports/${createRes.body.data.id}/actions/bank-account-validation`)
      .set(authed())
      .send({ bank_details: { sort_code: '123456', account_number: '12345678' } });

    const listRes = await request(app)
      .get('/lexis-nexis/notifications')
      .set(authed())
      .query({ read: 'false' });
    const notification = listRes.body.data.find((n: { message: string }) =>
      n.message.includes(createRes.body.data.id),
    );
    expect(notification).toBeDefined();
    expect(notification.read).toBe(false);

    const patchRes = await request(app)
      .patch(`/lexis-nexis/notifications/${notification.id}`)
      .set(authed())
      .send({ read: true });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.read).toBe(true);
  });
});
