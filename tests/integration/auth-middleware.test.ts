import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { auth } from '../../src/middleware/auth.js';
import { correlationId } from '../../src/middleware/correlationId.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { prisma } from '../../src/lib/prisma.js';
import { issueToken, revokeTokens } from '../../src/modules/auth/service.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

// No real protected route exists yet (first lands in EPIC-3/4) — this
// temporary route exercises the shared `auth` middleware in isolation, per
// planning/specs/epic-2-auth/plan.md's verification section.
function protectedTestApp() {
  const app = express();
  app.use(correlationId);
  app.get('/protected', auth, (req, res) => {
    res.status(200).json({ clientId: req.client?.clientId });
  });
  app.use(errorHandler);
  return app;
}

describe('bearer auth middleware', () => {
  const app = protectedTestApp();

  beforeAll(async () => {
    const client = await prisma.client.findUnique({ where: { clientId: CLIENT_ID } });
    if (!client) {
      throw new Error(
        `Seeded client "${CLIENT_ID}" not found — run "npm run seed" before the test suite.`,
      );
    }
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: 'Unauthenticated', reason: 'missing_token' });
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Token abc');
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe('invalid_token');
  });

  it('rejects an unknown token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe('invalid_token');
  });

  it('accepts a valid token and attaches the client to the request', async () => {
    const { accessToken } = await issueToken(CLIENT_ID, CLIENT_SECRET);
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.clientId).toBe(CLIENT_ID);
  });

  it('rejects an expired token', async () => {
    const { accessToken } = await issueToken(CLIENT_ID, CLIENT_SECRET);
    await prisma.accessToken.update({
      where: { token: accessToken },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe('token_expired');
  });

  it('rejects a revoked token', async () => {
    const { accessToken } = await issueToken(CLIENT_ID, CLIENT_SECRET);
    await revokeTokens(CLIENT_ID, CLIENT_SECRET);

    const res = await request(app).get('/protected').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
    expect(res.body.reason).toBe('token_revoked');
  });
});
