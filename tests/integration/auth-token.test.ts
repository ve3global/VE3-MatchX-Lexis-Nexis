import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('POST /oauth/token', () => {
  const app = createApp();

  beforeAll(async () => {
    const client = await prisma.client.findUnique({ where: { clientId: CLIENT_ID } });
    if (!client) {
      throw new Error(
        `Seeded client "${CLIENT_ID}" not found — run "npm run seed" before the test suite.`,
      );
    }
  });

  it('returns a bearer token for valid credentials', async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ token_type: 'Bearer', expires_in: 1800 });
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.access_token.length).toBeGreaterThan(0);

    const stored = await prisma.accessToken.findUnique({ where: { token: res.body.access_token } });
    expect(stored).not.toBeNull();
  });

  it('returns the doc-compliant 401 body for invalid credentials', async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: 'wrong-secret' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthenticated' });
  });

  it('returns the doc-compliant 401 body for an unknown client_id', async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .send({ client_id: 'no-such-client', client_secret: CLIENT_SECRET });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthenticated' });
  });

  it('returns 422 with field-level detail for a malformed body', async () => {
    const res = await request(app).post('/lexis-nexis/oauth/token').send({ client_id: CLIENT_ID });

    expect(res.status).toBe(422);
    expect(res.body.errors.client_secret[0].code).toBe(1319);
  });
});

describe('POST /oauth/token/revoke (extension)', () => {
  const app = createApp();

  it('revokes all active tokens for the client', async () => {
    await request(app)
      .post('/lexis-nexis/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });

    const res = await request(app)
      .post('/lexis-nexis/oauth/token/revoke')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBeGreaterThanOrEqual(1);

    const remainingActive = await prisma.accessToken.count({
      where: { client: { clientId: CLIENT_ID }, revokedAt: null },
    });
    expect(remainingActive).toBe(0);
  });
});
