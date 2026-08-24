import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';
const HEADER = 'X-LN-Replica-Force-Status';

describe('fault injection', () => {
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

  it.each([500, 502, 503, 504])(
    'forces a %i response on an authenticated route',
    async (status) => {
      const res = await request(app)
        .get('/lexis-nexis/report-types')
        .set(authed())
        .set(HEADER, String(status));

      expect(res.status).toBe(status);
      expect(res.body.injected).toBe(true);
      expect(typeof res.body.correlationId).toBe('string');
      expect(res.body.message).toBeTruthy();
    },
  );

  it('applies to /up, an unauthenticated route mounted before auth', async () => {
    const res = await request(app).get('/up').set(HEADER, '503');

    expect(res.status).toBe(503);
    expect(res.body.injected).toBe(true);
  });

  it('applies to /oauth/token, an unauthenticated route mounted before auth', async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .set(HEADER, '500')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });

    expect(res.status).toBe(500);
    expect(res.body.injected).toBe(true);
  });

  it('ignores an out-of-whitelist value and proceeds normally', async () => {
    const res = await request(app).get('/up').set(HEADER, '404');

    expect(res.status).toBe(200);
    expect(res.body.injected).toBeUndefined();
  });

  it('ignores a malformed value and proceeds normally', async () => {
    const res = await request(app).get('/up').set(HEADER, 'not-a-status');

    expect(res.status).toBe(200);
  });

  it('has no effect when the header is absent', async () => {
    const res = await request(app).get('/up');

    expect(res.status).toBe(200);
    expect(res.body.injected).toBeUndefined();
  });

  describe('kill switch', () => {
    afterEach(() => {
      delete process.env.FAULT_INJECTION_ENABLED;
      vi.resetModules();
    });

    it('ignores the header entirely when FAULT_INJECTION_ENABLED=false', async () => {
      process.env.FAULT_INJECTION_ENABLED = 'false';
      vi.resetModules();
      const { createApp: createDisabledApp } = await import('../../src/app.js');

      const res = await request(createDisabledApp()).get('/up').set(HEADER, '503');

      expect(res.status).toBe(200);
      expect(res.body.injected).toBeUndefined();
    });
  });
});
