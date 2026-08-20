import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('remote-check lifecycle', () => {
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

  async function createInlineReport(surname: string) {
    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({
        forename: 'Bella',
        surname,
        dob: '1980-01-01',
        address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
        enduser_agreement: true,
      });
    return res.body.data.id;
  }

  it('rejects an unauthenticated request', async () => {
    const id = await createInlineReport('RemoteCheckUnauth');
    const res = await request(app).post(`/reports/${id}/actions/remote-check`);
    expect(res.status).toBe(401);
  });

  it('starts a transaction, rejecting a second start while in progress (1312)', async () => {
    const id = await createInlineReport('RemoteCheckStart');

    const startRes = await request(app)
      .post(`/reports/${id}/actions/remote-check`)
      .set(authed())
      .send({});
    expect(startRes.status).toBe(200);
    expect(startRes.body.data['remote-check'].remote_check_status).toBe('IN_PROGRESS');

    const secondStartRes = await request(app)
      .post(`/reports/${id}/actions/remote-check`)
      .set(authed())
      .send({});
    expect(secondStartRes.status).toBe(422);
  });

  it('resolves results deterministically and idempotently, then blocks re-running remote-check (1313) and any other action (1325)', async () => {
    const id = await createInlineReport('RemoteCheckResolve');
    await request(app).post(`/reports/${id}/actions/remote-check`).set(authed()).send({});

    const firstResults = await request(app)
      .get(`/reports/${id}/actions/remote-check/results`)
      .set(authed());
    expect(firstResults.status).toBe(200);
    expect(firstResults.body.data.remote_check_status).toBe('COMPLETED');
    expect(['PASS', 'FAIL']).toContain(firstResults.body.data.remote_check_result);

    const secondResults = await request(app)
      .get(`/reports/${id}/actions/remote-check/results`)
      .set(authed());
    expect(secondResults.body.data).toEqual(firstResults.body.data);

    const rerunRes = await request(app)
      .post(`/reports/${id}/actions/remote-check`)
      .set(authed())
      .send({});
    expect(rerunRes.status).toBe(422);
    expect(rerunRes.body.errors._remote_check[0].code).toBe(1313);

    const otherActionRes = await request(app)
      .post(`/reports/${id}/actions/dob-verification`)
      .set(authed())
      .send({});
    expect(otherActionRes.status).toBe(422);
    expect(otherActionRes.body.errors._report[0].code).toBe(1325);

    const reportRes = await request(app).get(`/reports/${id}`).set(authed());
    expect(reportRes.body.data['remote-check']).toHaveProperty('remote_check_completed', true);
  });

  it('cancel: 422/1321 with no transaction, succeeds while in progress, allows restarting after cancel', async () => {
    const id = await createInlineReport('RemoteCheckCancel');

    const noTransactionRes = await request(app)
      .post(`/reports/${id}/actions/remote-check/cancel`)
      .set(authed());
    expect(noTransactionRes.status).toBe(422);

    await request(app).post(`/reports/${id}/actions/remote-check`).set(authed()).send({});
    const cancelRes = await request(app)
      .post(`/reports/${id}/actions/remote-check/cancel`)
      .set(authed());
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.remote_check_status).toBe('CANCELLED');

    const restartRes = await request(app)
      .post(`/reports/${id}/actions/remote-check`)
      .set(authed())
      .send({});
    expect(restartRes.status).toBe(200);
    expect(restartRes.body.data['remote-check'].remote_check_status).toBe('IN_PROGRESS');
  });

  it('resend: 422/1338 when not in progress, succeeds while in progress', async () => {
    const id = await createInlineReport('RemoteCheckResend');

    const noTransactionRes = await request(app)
      .post(`/reports/${id}/actions/remote-check/resend`)
      .set(authed());
    expect(noTransactionRes.status).toBe(422);

    await request(app).post(`/reports/${id}/actions/remote-check`).set(authed()).send({});
    const resendRes = await request(app)
      .post(`/reports/${id}/actions/remote-check/resend`)
      .set(authed());
    expect(resendRes.status).toBe(200);
    expect(resendRes.body.data.remote_check_status).toBe('IN_PROGRESS');

    await request(app).get(`/reports/${id}/actions/remote-check/results`).set(authed());
    const resendAfterCompleteRes = await request(app)
      .post(`/reports/${id}/actions/remote-check/resend`)
      .set(authed());
    expect(resendAfterCompleteRes.status).toBe(422);
  });

  it('pdf: 422 before completion, a stub payload after', async () => {
    const id = await createInlineReport('RemoteCheckPdf');
    await request(app).post(`/reports/${id}/actions/remote-check`).set(authed()).send({});

    const tooEarlyRes = await request(app)
      .get(`/reports/${id}/actions/remote-check/pdf`)
      .set(authed());
    expect(tooEarlyRes.status).toBe(422);

    await request(app).get(`/reports/${id}/actions/remote-check/results`).set(authed());
    const pdfRes = await request(app).get(`/reports/${id}/actions/remote-check/pdf`).set(authed());
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.data.content_type).toBe('application/pdf');
  });
});
