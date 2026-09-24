import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';
const PROVISION_KEY_HEADER = 'X-LN-Replica-Provision-Key';
const TEST_PROVISION_KEY = 'runs-test-provision-key';

const VALID_DISTRIBUTION = [
  { status: 500, weight: 20 },
  { status: 422, weight: 20 },
  { status: 429, weight: 10 },
  { status: 200, weight: 50 },
];

describe('runs (extension)', () => {
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

  it('creates a run with an all-zero tally and echoes the config back', async () => {
    const res = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: VALID_DISTRIBUTION, expected_requests: 100000 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      distribution: VALID_DISTRIBUTION,
      expected_requests: 100000,
      status: 'ACTIVE',
      closed_at: null,
      tally: { '200': 0, '422': 0, '429': 0, '500': 0, '502': 0, '503': 0, '504': 0 },
    });
    expect(typeof res.body.data.run_id).toBe('string');
    expect(res.body.data.run_id.length).toBeGreaterThan(0);
    expect(typeof res.body.data.created_at).toBe('string');
  });

  it('creates a run without expected_requests (purely optional)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: [{ status: 500, weight: 100 }] });

    expect(res.status).toBe(201);
    expect(res.body.data.expected_requests).toBeNull();
  });

  it('rejects an empty distribution (422)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: [] });

    expect(res.status).toBe(422);
    expect(res.body.errors.distribution[0].code).toBe(1319);
  });

  it('rejects a distribution missing entirely (422)', async () => {
    const res = await request(app).post('/lexis-nexis/runs').set(authed()).send({});

    expect(res.status).toBe(422);
    expect(res.body.errors.distribution[0].code).toBe(1319);
  });

  it('rejects an unsupported status code (422)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: [{ status: 404, weight: 100 }] });

    expect(res.status).toBe(422);
    expect(res.body.errors['distribution.0.status'][0].code).toBe(1319);
  });

  it('rejects a duplicate status entry (422)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({
        distribution: [
          { status: 200, weight: 50 },
          { status: 200, weight: 50 },
        ],
      });

    expect(res.status).toBe(422);
    // The second (duplicate) entry is the one flagged, at index 1.
    expect(res.body.errors['distribution.1.status']).toBeDefined();
  });

  it('rejects weights that do not sum to 100 (422)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({
        distribution: [
          { status: 200, weight: 50 },
          { status: 500, weight: 30 },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.distribution[0].code).toBe(1319);
  });

  it('rejects a non-positive expected_requests (422)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: [{ status: 200, weight: 100 }], expected_requests: 0 });

    expect(res.status).toBe(422);
    expect(res.body.errors.expected_requests[0].code).toBe(1319);
  });

  it('fetches a run by id', async () => {
    const created = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: VALID_DISTRIBUTION });

    const res = await request(app)
      .get(`/lexis-nexis/runs/${created.body.data.run_id}`)
      .set(authed());

    expect(res.status).toBe(200);
    expect(res.body.data.run_id).toBe(created.body.data.run_id);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('404s fetching an unknown run id', async () => {
    const res = await request(app)
      .get('/lexis-nexis/runs/00000000-0000-0000-0000-000000000000')
      .set(authed());

    expect(res.status).toBe(404);
  });

  it('closes a run, setting status and closed_at, and it remains fetchable', async () => {
    const created = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: VALID_DISTRIBUTION });
    const runId = created.body.data.run_id;

    const closeRes = await request(app).post(`/lexis-nexis/runs/${runId}/close`).set(authed());
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.status).toBe('CLOSED');
    expect(typeof closeRes.body.data.closed_at).toBe('string');

    const fetchRes = await request(app).get(`/lexis-nexis/runs/${runId}`).set(authed());
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.data.status).toBe('CLOSED');
  });

  it('closing an already-closed run is a no-op, not an error', async () => {
    const created = await request(app)
      .post('/lexis-nexis/runs')
      .set(authed())
      .send({ distribution: VALID_DISTRIBUTION });
    const runId = created.body.data.run_id;

    await request(app).post(`/lexis-nexis/runs/${runId}/close`).set(authed());
    const secondClose = await request(app).post(`/lexis-nexis/runs/${runId}/close`).set(authed());

    expect(secondClose.status).toBe(200);
    expect(secondClose.body.data.status).toBe('CLOSED');
  });

  describe('cross-client isolation', () => {
    const originalKey = process.env.CLIENT_PROVISION_KEY;
    let otherToken: string;

    beforeAll(async () => {
      process.env.CLIENT_PROVISION_KEY = TEST_PROVISION_KEY;
      const created = await request(app)
        .post('/lexis-nexis/clients')
        .set(PROVISION_KEY_HEADER, TEST_PROVISION_KEY)
        .send({ name: 'Runs Isolation Tenant' });
      const tokenRes = await request(app).post('/lexis-nexis/oauth/token').send({
        client_id: created.body.data.client_id,
        client_secret: created.body.data.client_secret,
      });
      otherToken = tokenRes.body.access_token;
    });

    afterAll(() => {
      process.env.CLIENT_PROVISION_KEY = originalKey;
    });

    it("a different client can't fetch this client's run", async () => {
      const created = await request(app)
        .post('/lexis-nexis/runs')
        .set(authed())
        .send({ distribution: VALID_DISTRIBUTION });

      const res = await request(app)
        .get(`/lexis-nexis/runs/${created.body.data.run_id}`)
        .set({ Authorization: `Bearer ${otherToken}` });

      expect(res.status).toBe(404);
    });

    it("a different client can't close this client's run", async () => {
      const created = await request(app)
        .post('/lexis-nexis/runs')
        .set(authed())
        .send({ distribution: VALID_DISTRIBUTION });

      const res = await request(app)
        .post(`/lexis-nexis/runs/${created.body.data.run_id}/close`)
        .set({ Authorization: `Bearer ${otherToken}` });

      expect(res.status).toBe(404);

      const stillOpen = await request(app)
        .get(`/lexis-nexis/runs/${created.body.data.run_id}`)
        .set(authed());
      expect(stillOpen.body.data.status).toBe('ACTIVE');
    });
  });

  describe('run injection (live traffic)', () => {
    const RUN_ID_HEADER = 'X-LN-Replica-Run-Id';
    // Any real, cheap, side-effect-free authenticated GET is fine here —
    // report-types, mirroring the same target faultInjection.test.ts uses.
    const TARGET = '/lexis-nexis/report-types';

    async function createRun(distribution: { status: number; weight: number }[]): Promise<string> {
      const res = await request(app).post('/lexis-nexis/runs').set(authed()).send({ distribution });
      return res.body.data.run_id;
    }

    it.each([500, 502, 503, 504])(
      'forces a %i response shaped exactly like fault injection',
      async (status) => {
        const runId = await createRun([{ status, weight: 100 }]);
        const res = await request(app).get(TARGET).set(authed()).set(RUN_ID_HEADER, runId);

        expect(res.status).toBe(status);
        expect(res.body.injected).toBe(true);
        expect(typeof res.body.correlationId).toBe('string');
      },
    );

    it('forces a 429 shaped exactly like the real rate limiter response', async () => {
      const runId = await createRun([{ status: 429, weight: 100 }]);
      const res = await request(app).get(TARGET).set(authed()).set(RUN_ID_HEADER, runId);

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBe('1');
      expect(res.body).toEqual({
        message: 'Too many requests — rate limit exceeded for this client.',
        retry_after_seconds: 1,
      });
    });

    it('forces a generic 422 distinct from real field-level validation errors', async () => {
      const runId = await createRun([{ status: 422, weight: 100 }]);
      const res = await request(app).get(TARGET).set(authed()).set(RUN_ID_HEADER, runId);

      expect(res.status).toBe(422);
      expect(res.body.errors._run[0].code).toBe(1319);
    });

    it('a 200 roll proceeds through completely real business logic, not a synthetic placeholder', async () => {
      const runId = await createRun([{ status: 200, weight: 100 }]);
      const res = await request(app).get(TARGET).set(authed()).set(RUN_ID_HEADER, runId);

      expect(res.status).toBe(200);
      // The real paginator envelope — a run-fabricated body never has this shape.
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('links');
      expect(res.body).toHaveProperty('meta');
    });

    it('applies uniformly across different real endpoints under the same run', async () => {
      const runId = await createRun([{ status: 500, weight: 100 }]);

      const reportTypesRes = await request(app)
        .get('/lexis-nexis/report-types')
        .set(authed())
        .set(RUN_ID_HEADER, runId);
      const scorecardsRes = await request(app)
        .get('/lexis-nexis/scorecards')
        .set(authed())
        .set(RUN_ID_HEADER, runId);

      expect(reportTypesRes.status).toBe(500);
      expect(scorecardsRes.status).toBe(500);
    });

    it('has no effect when the header is absent', async () => {
      const res = await request(app).get(TARGET).set(authed());
      expect(res.status).toBe(200);
    });

    it('fails open for an unrecognized run id', async () => {
      const res = await request(app)
        .get(TARGET)
        .set(authed())
        .set(RUN_ID_HEADER, '00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(200);
    });

    it('fails open for a closed run', async () => {
      const runId = await createRun([{ status: 500, weight: 100 }]);
      await request(app).post(`/lexis-nexis/runs/${runId}/close`).set(authed());

      const res = await request(app).get(TARGET).set(authed()).set(RUN_ID_HEADER, runId);
      expect(res.status).toBe(200);
    });

    it("fails open for a different client's run id, even with a valid bearer token", async () => {
      const originalKey = process.env.CLIENT_PROVISION_KEY;
      process.env.CLIENT_PROVISION_KEY = TEST_PROVISION_KEY;
      try {
        const created = await request(app)
          .post('/lexis-nexis/clients')
          .set(PROVISION_KEY_HEADER, TEST_PROVISION_KEY)
          .send({ name: 'Injection Isolation Tenant' });
        const tokenRes = await request(app).post('/lexis-nexis/oauth/token').send({
          client_id: created.body.data.client_id,
          client_secret: created.body.data.client_secret,
        });
        const otherToken = tokenRes.body.access_token;

        const runId = await createRun([{ status: 500, weight: 100 }]);

        const res = await request(app)
          .get(TARGET)
          .set({ Authorization: `Bearer ${otherToken}` })
          .set(RUN_ID_HEADER, runId);

        expect(res.status).toBe(200);
      } finally {
        process.env.CLIENT_PROVISION_KEY = originalKey;
      }
    });

    it('tallies every roll accurately, including real pass-throughs, under concurrent load', async () => {
      const runId = await createRun([{ status: 500, weight: 100 }]);

      // Fired concurrently and well over the real rate limiter's 10/sec
      // threshold — but the real limiter is skipped entirely under
      // NODE_ENV=test (set automatically by Vitest, see rateLimiter.ts),
      // the same environmental constraint the rate limiter feature itself
      // lives with (only ever live-validated via Postman/Newman, never
      // Vitest). What this test *can* prove in this environment: every one
      // of these concurrent requests reliably gets the run's own fabricated
      // outcome, and the tally counts every one of them accurately — the
      // full "never collides with a genuine rate-limit rejection" claim is
      // covered by manual/Newman verification instead.
      await Promise.all(
        Array.from({ length: 15 }, () =>
          request(app).get(TARGET).set(authed()).set(RUN_ID_HEADER, runId),
        ),
      );

      const reportRes = await request(app).get(`/lexis-nexis/runs/${runId}`).set(authed());
      expect(reportRes.body.data.tally['500']).toBe(15);
    });

    it('a mixed distribution produces both configured outcomes over enough requests (statistical smoke test)', async () => {
      const runId = await createRun([
        { status: 200, weight: 50 },
        { status: 500, weight: 50 },
      ]);

      const results = await Promise.all(
        Array.from({ length: 40 }, () =>
          request(app).get(TARGET).set(authed()).set(RUN_ID_HEADER, runId),
        ),
      );
      const statuses = results.map((res) => res.status);

      expect(statuses).toContain(200);
      expect(statuses).toContain(500);

      const reportRes = await request(app).get(`/lexis-nexis/runs/${runId}`).set(authed());
      expect(reportRes.body.data.tally['200'] + reportRes.body.data.tally['500']).toBe(40);
    });
  });
});
