import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { ACTION_REGISTRY } from '../../src/modules/reports/actions/registry.js';
import { REPORT_ACTIONS } from '../../src/lib/reportActions.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('report actions', () => {
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

  async function createInlineReport() {
    const res = await request(app)
      .post('/reports')
      .set(authed())
      .send({
        forename: 'Bella',
        surname: 'Henderson',
        dob: '1980-01-01',
        address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
        enduser_agreement: true,
      });
    return res.body.id;
  }

  it('registers exactly one module per name in the 27-action list, except remote-check (EPIC-12 lifecycle special-case)', () => {
    expect(REPORT_ACTIONS.length).toBe(27);
    for (const action of REPORT_ACTIONS) {
      if (action === 'remote-check') {
        expect(ACTION_REGISTRY[action]).toBeUndefined();
        continue;
      }
      expect(ACTION_REGISTRY[action]).toBeDefined();
    }
  });

  it('rejects an unauthenticated request', async () => {
    const id = await createInlineReport();
    const res = await request(app).post(`/reports/${id}/actions/dob-verification`);
    expect(res.status).toBe(401);
  });

  it('404s for an unknown action name', async () => {
    const id = await createInlineReport();
    const res = await request(app)
      .post(`/reports/${id}/actions/not-a-real-action`)
      .set(authed())
      .send({});
    expect(res.status).toBe(404);
  });

  it('runs a no-body action and merges its result into the report', async () => {
    const id = await createInlineReport();

    const runRes = await request(app)
      .post(`/reports/${id}/actions/dob-verification`)
      .set(authed())
      .send({});
    expect(runRes.status).toBe(200);
    expect(runRes.body.data['dob-verification']).toHaveProperty('dob_verified');

    const getRes = await request(app).get(`/reports/${id}`).set(authed());
    expect(getRes.body['dob-verification']).toEqual(runRes.body.data['dob-verification']);
    expect(getRes.body.attributes).toMatchObject(runRes.body.data['dob-verification']);
  });

  it('returns identical results for the same subject across separate reports (determinism)', async () => {
    const id1 = await createInlineReport();
    const id2 = await createInlineReport();

    const res1 = await request(app)
      .post(`/reports/${id1}/actions/address-verification`)
      .set(authed())
      .send({});
    const res2 = await request(app)
      .post(`/reports/${id2}/actions/address-verification`)
      .set(authed())
      .send({});

    expect(res1.body.data).toEqual(res2.body.data);
  });

  it('rejects a malformed request body with the action-specific error code', async () => {
    const id = await createInlineReport();
    const res = await request(app)
      .post(`/reports/${id}/actions/ni-number-validation`)
      .set(authed())
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors.ni_number[0].code).toBe(1203);
  });

  it('validates bank details format and runs bank-account-validation', async () => {
    const id = await createInlineReport();

    const badRes = await request(app)
      .post(`/reports/${id}/actions/bank-account-validation`)
      .set(authed())
      .send({ bank_details: { sort_code: 'abc', account_number: '123' } });
    expect(badRes.status).toBe(422);
    expect(badRes.body.errors['bank_details.sort_code'][0].code).toBe(1095);
    expect(badRes.body.errors['bank_details.account_number'][0].code).toBe(1098);

    const goodRes = await request(app)
      .post(`/reports/${id}/actions/bank-account-validation`)
      .set(authed())
      .send({ bank_details: { sort_code: '123456', account_number: '12345678' } });
    expect(goodRes.status).toBe(200);
    expect(goodRes.body.data['bank-account-validation']).toHaveProperty('bank_account_valid');
  });

  it('masks bank account number and NI number on input-data', async () => {
    const id = await createInlineReport();
    await request(app)
      .post(`/reports/${id}/actions/bank-account-validation`)
      .set(authed())
      .send({ bank_details: { sort_code: '123456', account_number: '12345678' } });
    await request(app)
      .post(`/reports/${id}/actions/ni-number-validation`)
      .set(authed())
      .send({ ni_number: 'AB123456C' });

    const res = await request(app).get(`/reports/${id}/input-data`).set(authed());

    expect(res.body.data.bank_details).toEqual({ sort_code: '123456', account_number: '****5678' });
    expect(res.body.data.ni_number).toBe('AB******C');
  });

  it('completes the otp-email send/verify flow and 422s without a prior send', async () => {
    const id = await createInlineReport();

    const missingRes = await request(app)
      .post(`/reports/${id}/actions/otp-email-verification`)
      .set(authed())
      .send({ code: '123456' });
    expect(missingRes.status).toBe(422);
    expect(missingRes.body.errors.code[0].code).toBe(1294);

    const sendRes = await request(app)
      .post(`/reports/${id}/actions/otp-email`)
      .set(authed())
      .send({ email: 'test@example.com' });
    expect(sendRes.status).toBe(200);
    const otpCode = sendRes.body.data['otp-email'].otp_code;
    expect(otpCode).toMatch(/^\d{6}$/);

    const wrongRes = await request(app)
      .post(`/reports/${id}/actions/otp-email-verification`)
      .set(authed())
      .send({ code: '000000' });
    expect(wrongRes.status).toBe(200);
    expect(wrongRes.body.data['otp-email-verification'].otp_email_verified).toBe(false);

    const verifyRes = await request(app)
      .post(`/reports/${id}/actions/otp-email-verification`)
      .set(authed())
      .send({ code: otpCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data['otp-email-verification'].otp_email_verified).toBe(true);
  });

  it('re-running an action upserts rather than duplicating', async () => {
    const id = await createInlineReport();
    await request(app).post(`/reports/${id}/actions/dob-verification`).set(authed()).send({});
    await request(app).post(`/reports/${id}/actions/dob-verification`).set(authed()).send({});

    const auditRes = await request(app).get(`/reports/${id}/audit`).set(authed());
    const actionRunEvents = auditRes.body.data.filter(
      (e: { event_type: string }) => e.event_type === 'ACTION_RUN',
    );
    expect(actionRunEvents.length).toBe(2);

    const getRes = await request(app).get(`/reports/${id}`).set(authed());
    expect(Object.keys(getRes.body.attributes).sort()).toEqual(['dob_count', 'dob_verified']);
  });

  it('recomputes report status to COMPLETE once every primary action has run individually', async () => {
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({ name: `RT ${Date.now()}-manual`, primary_actions: ['bank-account-validation'] });
    const createRes = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });
    expect(createRes.body.status).toBe('STARTED');

    const runRes = await request(app)
      .post(`/reports/${createRes.body.id}/actions/bank-account-validation`)
      .set(authed())
      .send({ bank_details: { sort_code: '123456', account_number: '12345678' } });
    expect(runRes.status).toBe(200);

    const getRes = await request(app).get(`/reports/${createRes.body.id}`).set(authed());
    expect(getRes.body.status).toBe('COMPLETE');
  });

  it('QA override: surname SANCTIONED forces sanction:true', async () => {
    const createRes = await request(app)
      .post('/reports')
      .set(authed())
      .send({
        forename: 'Test',
        surname: 'SANCTIONED',
        dob: '1980-01-01',
        address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
        enduser_agreement: true,
      });

    const res = await request(app)
      .post(`/reports/${createRes.body.id}/actions/sanction-screening`)
      .set(authed())
      .send({});
    expect(res.body.data['sanction-screening'].sanction).toBe(true);
  });

  it('QA override: dob 1900-01-01 forces all death-screening flags true', async () => {
    const createRes = await request(app)
      .post('/reports')
      .set(authed())
      .send({
        forename: 'Test',
        surname: 'Death',
        dob: '1900-01-01',
        address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
        enduser_agreement: true,
      });

    const res = await request(app)
      .post(`/reports/${createRes.body.id}/actions/death-screening`)
      .set(authed())
      .send({});
    expect(res.body.data['death-screening']).toEqual({
      death_ddri: true,
      death_gro: true,
      death_halo: true,
    });
  });

  it('computes an assessment from action-produced attributes on GET', async () => {
    const scorecardRes = await request(app)
      .post('/scorecards')
      .set(authed())
      .send({
        name: `SC ${Date.now()}-actions`,
        pass_threshold: 20,
        fail_threshold: -20,
        groups: [
          {
            group_name: 'screening',
            min_score: 0,
            rules: [{ attribute: 'sanction', match_score: -100, no_match_score: 20 }],
          },
        ],
      });
    const reportTypeRes = await request(app)
      .post('/report-types')
      .set(authed())
      .send({
        name: `RT ${Date.now()}-actions`,
        scorecard_id: scorecardRes.body.id,
        primary_actions: [],
      });
    const createRes = await request(app)
      .post('/reports')
      .set(authed())
      .send({ report_type_id: reportTypeRes.body.id });

    const runRes = await request(app)
      .post(`/reports/${createRes.body.id}/actions/sanction-screening`)
      .set(authed())
      .send({});
    const sanction = runRes.body.data['sanction-screening'].sanction as boolean;

    const getRes = await request(app).get(`/reports/${createRes.body.id}`).set(authed());
    const expectedScore = sanction ? -100 : 20;
    expect(getRes.body.assessment.score).toBe(expectedScore);
    expect(getRes.body.assessment.result).toBe(sanction ? 'FAIL' : 'PASS');
  });
});
