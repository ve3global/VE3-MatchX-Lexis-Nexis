import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('webhooks', () => {
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

  async function createValidWebhook() {
    return request(app).post('/webhooks').set(authed()).send({
      notification_webhook_url: 'https://example.invalid/webhook',
      notification_webhook_secret: 'shhh-its-a-secret',
    });
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/webhooks');
    expect(res.status).toBe(401);
  });

  it('creates a webhook with a valid https url', async () => {
    const res = await createValidWebhook();
    expect(res.status).toBe(201);
    expect(res.body.notification_webhook_url).toBe('https://example.invalid/webhook');
    expect(res.body).not.toHaveProperty('notification_webhook_secret');
  });

  it('rejects a non-https url', async () => {
    const res = await request(app)
      .post('/webhooks')
      .set(authed())
      .send({
        notification_webhook_url: 'http://example.invalid/webhook',
        notification_webhook_secret: 'x',
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.notification_webhook_url[0].code).toBe(1297);
  });

  it('rejects a malformed url', async () => {
    const res = await request(app)
      .post('/webhooks')
      .set(authed())
      .send({ notification_webhook_url: 'not-a-url', notification_webhook_secret: 'x' });

    expect(res.status).toBe(422);
    expect(res.body.errors.notification_webhook_url[0].code).toBe(1295);
  });

  it('requires both fields', async () => {
    const res = await request(app).post('/webhooks').set(authed()).send({});
    expect(res.status).toBe(422);
    expect(res.body.errors.notification_webhook_url[0].code).toBe(1322);
    expect(res.body.errors.notification_webhook_secret[0].code).toBe(1323);
  });

  it('lists webhooks in the paginator envelope', async () => {
    const res = await request(app).get('/webhooks').set(authed());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('links');
    expect(res.body).toHaveProperty('meta');
  });

  it('sends a test delivery with a verifiable signature and no real network call', async () => {
    const createRes = await createValidWebhook();
    const id = createRes.body.id;

    const start = Date.now();
    const res = await request(app).post(`/webhooks/${id}/test`).set(authed());
    const elapsedMs = Date.now() - start;

    expect(res.status).toBe(200);
    expect(['SUCCESS', 'FAILED']).toContain(res.body.status);
    expect(elapsedMs).toBeLessThan(1000);

    const expectedSignature = createHmac('sha256', 'shhh-its-a-secret')
      .update(JSON.stringify(res.body.payload))
      .digest('hex');
    expect(res.body.signature).toBe(expectedSignature);
  });

  it('rejects retry when there is no eligible prior delivery', async () => {
    const createRes = await createValidWebhook();
    const id = createRes.body.id;

    const res = await request(app).post(`/webhooks/${id}/retry`).set(authed());
    expect(res.status).toBe(422);
  });

  it('allows retry after a FAILED delivery', async () => {
    const createRes = await createValidWebhook();
    const id = createRes.body.id;

    await prisma.webhookDelivery.create({
      data: {
        webhookId: id,
        status: 'FAILED',
        payload: { event: 'test' },
        signature: 'irrelevant',
      },
    });

    const res = await request(app).post(`/webhooks/${id}/retry`).set(authed());
    expect(res.status).toBe(200);
  });

  it('rotates the secret and signs subsequent deliveries with the new value', async () => {
    const createRes = await createValidWebhook();
    const id = createRes.body.id;

    const rotateRes = await request(app).post(`/webhooks/${id}/secret`).set(authed());
    expect(rotateRes.status).toBe(200);
    const newSecret = rotateRes.body.notification_webhook_secret;
    expect(newSecret).not.toBe('shhh-its-a-secret');

    const testRes = await request(app).post(`/webhooks/${id}/test`).set(authed());
    const expectedSignature = createHmac('sha256', newSecret)
      .update(JSON.stringify(testRes.body.payload))
      .digest('hex');
    expect(testRes.body.signature).toBe(expectedSignature);
  });

  it('deletes a webhook and cascades its deliveries', async () => {
    const createRes = await createValidWebhook();
    const id = createRes.body.id;
    await request(app).post(`/webhooks/${id}/test`).set(authed());

    const deleteRes = await request(app).delete(`/webhooks/${id}`).set(authed());
    expect(deleteRes.status).toBe(204);

    const remaining = await prisma.webhookDelivery.count({ where: { webhookId: id } });
    expect(remaining).toBe(0);
  });
});
