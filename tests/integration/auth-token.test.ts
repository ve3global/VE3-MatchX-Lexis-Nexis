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

  it('accepts HTTP Basic Auth credentials with a grant_type body (real sandbox client shape)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .auth(CLIENT_ID, CLIENT_SECRET)
      .send({ grant_type: 'client_credentials' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ token_type: 'Bearer', expires_in: 1800 });
    expect(typeof res.body.access_token).toBe('string');

    const stored = await prisma.accessToken.findUnique({ where: { token: res.body.access_token } });
    expect(stored).not.toBeNull();
  });

  it('rejects Basic Auth credentials that are wrong, same as a bad JSON body', async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .auth(CLIENT_ID, 'wrong-secret')
      .send({ grant_type: 'client_credentials' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthenticated' });
  });

  it('prefers Basic Auth credentials over a mismatched JSON body when both are present', async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .auth(CLIENT_ID, CLIENT_SECRET)
      .send({ client_id: 'no-such-client', client_secret: 'wrong-secret' });

    expect(res.status).toBe(200);
    expect(typeof res.body.access_token).toBe('string');
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
