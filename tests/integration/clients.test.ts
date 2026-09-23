import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const PROVISION_KEY_HEADER = 'X-LN-Replica-Provision-Key';
const TEST_KEY = 'test-provision-key';

describe('POST /clients (extension)', () => {
  const app = createApp();
  const originalKey = process.env.CLIENT_PROVISION_KEY;

  beforeAll(() => {
    process.env.CLIENT_PROVISION_KEY = TEST_KEY;
  });

  afterAll(() => {
    process.env.CLIENT_PROVISION_KEY = originalKey;
  });

  it('mints a new client, returning the plaintext secret exactly once', async () => {
    const res = await request(app)
      .post('/lexis-nexis/clients')
      .set(PROVISION_KEY_HEADER, TEST_KEY)
      .send({ name: 'A New Tenant' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'A New Tenant' });
    expect(typeof res.body.data.client_id).toBe('string');
    expect(typeof res.body.data.client_secret).toBe('string');
    expect(res.body.data.client_secret.length).toBeGreaterThan(0);

    const stored = await prisma.client.findUnique({
      where: { clientId: res.body.data.client_id },
    });
    expect(stored).not.toBeNull();
    // Only the hash is ever persisted — never the plaintext secret.
    expect(stored?.clientSecretHash).not.toBe(res.body.data.client_secret);
  });

  it('the minted client can immediately obtain a bearer token', async () => {
    const created = await request(app)
      .post('/lexis-nexis/clients')
      .set(PROVISION_KEY_HEADER, TEST_KEY)
      .send({ name: 'Token Round-trip Tenant' });

    const tokenRes = await request(app).post('/lexis-nexis/oauth/token').send({
      client_id: created.body.data.client_id,
      client_secret: created.body.data.client_secret,
    });

    expect(tokenRes.status).toBe(200);
    expect(typeof tokenRes.body.access_token).toBe('string');
  });

  it('rejects a missing provisioning key (401)', async () => {
    const res = await request(app).post('/lexis-nexis/clients').send({ name: 'Nope' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthenticated' });
  });

  it('rejects a wrong provisioning key (401)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/clients')
      .set(PROVISION_KEY_HEADER, 'wrong-key')
      .send({ name: 'Nope' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Unauthenticated' });
  });

  it('fails closed (500) when CLIENT_PROVISION_KEY is not configured', async () => {
    delete process.env.CLIENT_PROVISION_KEY;
    try {
      const res = await request(app)
        .post('/lexis-nexis/clients')
        .set(PROVISION_KEY_HEADER, TEST_KEY)
        .send({ name: 'Nope' });

      expect(res.status).toBe(500);
    } finally {
      process.env.CLIENT_PROVISION_KEY = TEST_KEY;
    }
  });

  it('allows duplicate names — only client_id is unique', async () => {
    const first = await request(app)
      .post('/lexis-nexis/clients')
      .set(PROVISION_KEY_HEADER, TEST_KEY)
      .send({ name: 'Duplicate Name Co' });
    const second = await request(app)
      .post('/lexis-nexis/clients')
      .set(PROVISION_KEY_HEADER, TEST_KEY)
      .send({ name: 'Duplicate Name Co' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.client_id).not.toBe(second.body.data.client_id);
  });

  it('rejects an empty name (422)', async () => {
    const res = await request(app)
      .post('/lexis-nexis/clients')
      .set(PROVISION_KEY_HEADER, TEST_KEY)
      .send({ name: '' });

    expect(res.status).toBe(422);
    expect(res.body.errors.name[0].code).toBe(1319);
  });
});
