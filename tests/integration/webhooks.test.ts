import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('webhooks', () => {
  const app = createApp();
  let token: string;
  let clientRowId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    token = res.body.access_token;
    const client = await prisma.client.findUniqueOrThrow({ where: { clientId: CLIENT_ID } });
    clientRowId = client.id;
  });

  function authed() {
    return { Authorization: `Bearer ${token}` };
  }

  async function resetWebhookConfig() {
    await prisma.client.update({
      where: { id: clientRowId },
      data: { notificationWebhookUrl: null, notificationWebhookSecret: null },
    });
  }

  async function configureWebhook() {
    await request(app)
      .put('/users/self/webhook-url')
      .set(authed())
      .send({ notification_webhook_url: 'https://example.invalid/webhook' });
    const res = await request(app).put('/users/self/webhook-secret').set(authed());
    return res.body.secret as string;
  }

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/webhooks?date_from=2021-01-01T00:00:00Z');
    expect(res.status).toBe(401);
  });

  it('rejects generating a secret with no webhook URL configured (428)', async () => {
    await resetWebhookConfig();
    const res = await request(app).put('/users/self/webhook-secret').set(authed());
    expect(res.status).toBe(428);
  });

  it('rejects a non-https url', async () => {
    const res = await request(app)
      .put('/users/self/webhook-url')
      .set(authed())
      .send({ notification_webhook_url: 'http://example.invalid/webhook' });
    expect(res.status).toBe(422);
    expect(res.body.errors.notification_webhook_url[0].code).toBe(1297);
  });

  it('rejects a malformed url', async () => {
    const res = await request(app)
      .put('/users/self/webhook-url')
      .set(authed())
      .send({ notification_webhook_url: 'not-a-url' });
    expect(res.status).toBe(422);
    expect(res.body.errors.notification_webhook_url[0].code).toBe(1295);
  });

  it('sets a url and generates a secret once it exists', async () => {
    await resetWebhookConfig();
    const urlRes = await request(app)
      .put('/users/self/webhook-url')
      .set(authed())
      .send({ notification_webhook_url: 'https://example.invalid/webhook' });
    expect(urlRes.status).toBe(200);

    const secretRes = await request(app).put('/users/self/webhook-secret').set(authed());
    expect(secretRes.status).toBe(200);
    expect(typeof secretRes.body.secret).toBe('string');
    expect(secretRes.body.secret.length).toBeGreaterThan(0);
  });

  it('requires date_from on the list endpoint (1299)', async () => {
    const res = await request(app).get('/webhooks').set(authed());
    expect(res.status).toBe(422);
    expect(res.body.errors.date_from[0].code).toBe(1299);
  });

  it('rejects date_to before date_from (1300)', async () => {
    const res = await request(app)
      .get('/webhooks?date_from=2021-08-10T08:32:28Z&date_to=2021-08-09T08:32:28Z')
      .set(authed());
    expect(res.status).toBe(422);
    expect(res.body.errors.date_to[0].code).toBe(1300);
  });

  it('lists webhook messages in the paginator envelope', async () => {
    const res = await request(app).get('/webhooks?date_from=2021-01-01T00:00:00Z').set(authed());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('links');
    expect(res.body).toHaveProperty('meta');
  });

  it('automatically delivers a remote-check.check-completed message when a check resolves', async () => {
    await configureWebhook();

    const reportRes = await request(app)
      .post('/reports')
      .set(authed())
      .send({
        forename: 'Bella',
        surname: `RC${Date.now()}`,
        dob: '1980-01-01',
        address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
        enduser_agreement: true,
      });
    const reportId = reportRes.body.data.id;

    await request(app).post(`/reports/${reportId}/actions/remote-check`).set(authed()).send({});
    await request(app).get(`/reports/${reportId}/actions/remote-check/results`).set(authed());

    const messages = await prisma.webhookMessage.findMany({
      where: { clientId: clientRowId, type: 'remote-check.check-completed' },
      orderBy: { createdAt: 'desc' },
      include: { attempts: true },
    });
    expect(messages[0].payload).toMatchObject({
      type: 'remote-check.check-completed',
      data: { report_id: reportId },
    });
    expect(messages[0].attempts.length).toBeGreaterThan(0);

    const getRes = await request(app).get(`/webhooks/${messages[0].id}`).set(authed());
    expect(getRes.status).toBe(200);
    expect(getRes.body.type).toBe('remote-check.check-completed');
    expect(getRes.body.attempts.length).toBeGreaterThan(0);
  });

  it('rejects retry when the message is not in a failed/retrying state (1303)', async () => {
    await configureWebhook();
    const message = await prisma.webhookMessage.create({
      data: {
        clientId: clientRowId,
        type: 'remote-check.check-completed',
        status: 'SUCCESS',
        payload: {},
      },
    });

    const res = await request(app).post(`/webhooks/${message.id}/retry`).set(authed());
    expect(res.status).toBe(422);
    expect(res.body.errors._webhook[0].code).toBe(1303);
  });

  it('allows retry after a FAILED message and records a new attempt', async () => {
    await configureWebhook();
    const message = await prisma.webhookMessage.create({
      data: {
        clientId: clientRowId,
        type: 'remote-check.check-completed',
        status: 'FAILED',
        payload: {},
      },
    });

    const res = await request(app).post(`/webhooks/${message.id}/retry`).set(authed());
    expect(res.status).toBe(202);

    const attempts = await prisma.webhookAttempt.count({ where: { messageId: message.id } });
    expect(attempts).toBeGreaterThan(0);
  });

  it('sends a test message without persisting it to message history', async () => {
    await configureWebhook();
    const before = await prisma.webhookMessage.count({ where: { clientId: clientRowId } });

    const start = Date.now();
    const res = await request(app)
      .post('/webhooks/test')
      .set(authed())
      .send({ event_type: 'remote-check.invitation-expired' });
    const elapsedMs = Date.now() - start;

    expect([200, 500]).toContain(res.status);
    expect(res.body.data.http_message_payload.type).toBe('remote-check.invitation-expired');
    expect(elapsedMs).toBeLessThan(1000);

    const after = await prisma.webhookMessage.count({ where: { clientId: clientRowId } });
    expect(after).toBe(before);
  });

  it('signs a test message with an invalid secret when valid_signature is false', async () => {
    await configureWebhook();
    const res = await request(app)
      .post('/webhooks/test')
      .set(authed())
      .send({ valid_signature: false, event_type: 'remote-check.check-completed' });

    expect([200, 500]).toContain(res.status);
    expect(res.body.data.http_message_payload).toHaveProperty('signature');
  });
});
