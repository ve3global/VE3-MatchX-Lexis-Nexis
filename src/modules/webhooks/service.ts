import { createHmac, randomBytes } from 'node:crypto';
import type { Webhook, WebhookDelivery } from '@prisma/client';
import { chance, subSeed } from '../../lib/determinism.js';
import { prisma } from '../../lib/prisma.js';
import { singleFieldError } from '../../lib/validation.js';
import { ApiError } from '../../middleware/errorHandler.js';
import type { CreateWebhookRequest, UpdateWebhookRequest } from './schema.js';

export function serializeWebhook(webhook: Webhook) {
  return {
    id: webhook.id,
    notification_webhook_url: webhook.url,
    created_at: webhook.createdAt.toISOString(),
    updated_at: webhook.updatedAt.toISOString(),
  };
}

export function serializeDelivery(delivery: WebhookDelivery) {
  return {
    id: delivery.id,
    status: delivery.status,
    payload: delivery.payload,
    signature: delivery.signature,
    created_at: delivery.createdAt.toISOString(),
    updated_at: delivery.updatedAt.toISOString(),
  };
}

function signPayload(secret: string, payload: unknown): string {
  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

export async function createWebhook(
  clientId: string,
  input: CreateWebhookRequest,
): Promise<Webhook> {
  return prisma.webhook.create({
    data: {
      clientId,
      url: input.notification_webhook_url,
      secret: input.notification_webhook_secret,
    },
  });
}

export async function listWebhooks(
  clientId: string,
  page: number,
  perPage: number,
): Promise<{ items: Webhook[]; total: number }> {
  const where = { clientId };
  const [items, total] = await Promise.all([
    prisma.webhook.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.webhook.count({ where }),
  ]);
  return { items, total };
}

export async function findWebhook(clientId: string, id: string): Promise<Webhook> {
  const webhook = await prisma.webhook.findUnique({ where: { id } });
  if (!webhook || webhook.clientId !== clientId) {
    throw new ApiError(404, { message: 'Not found' });
  }
  return webhook;
}

export async function updateWebhook(
  clientId: string,
  id: string,
  input: UpdateWebhookRequest,
): Promise<Webhook> {
  await findWebhook(clientId, id);
  return prisma.webhook.update({
    where: { id },
    data: {
      ...(input.notification_webhook_url !== undefined && { url: input.notification_webhook_url }),
      ...(input.notification_webhook_secret !== undefined && {
        secret: input.notification_webhook_secret,
      }),
    },
  });
}

export async function deleteWebhook(clientId: string, id: string): Promise<void> {
  await findWebhook(clientId, id);
  await prisma.webhook.delete({ where: { id } });
}

/**
 * Deterministic, seeded outcome — never a real HTTP request (see
 * spec.md's "Resolved conflicts"). 85% success, matching the "normal
 * case works" bias used everywhere else in this replica.
 */
async function simulateDelivery(webhook: Webhook, payload: unknown): Promise<WebhookDelivery> {
  const attemptCount = await prisma.webhookDelivery.count({ where: { webhookId: webhook.id } });
  const succeeded = chance(subSeed(subSeed(0, webhook.id), `delivery:${attemptCount}`), 0.85);
  return prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      status: succeeded ? 'SUCCESS' : 'FAILED',
      payload: payload as object,
      signature: signPayload(webhook.secret, payload),
    },
  });
}

export async function testWebhook(clientId: string, id: string): Promise<WebhookDelivery> {
  const webhook = await findWebhook(clientId, id);
  const payload = { event: 'test', message: 'This is a test webhook delivery.' };
  return simulateDelivery(webhook, payload);
}

/** 422/1303 unless the most recent delivery is FAILED/RETRYING (doc-confirmed business rule). */
export async function retryWebhook(clientId: string, id: string): Promise<WebhookDelivery> {
  const webhook = await findWebhook(clientId, id);
  const latest = await prisma.webhookDelivery.findFirst({
    where: { webhookId: id },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest || (latest.status !== 'FAILED' && latest.status !== 'RETRYING')) {
    throw new ApiError(422, singleFieldError('_webhook', 1303));
  }
  return simulateDelivery(webhook, latest.payload);
}

/** Replica-only design for the doc-named "secret" action (see spec.md) — rotates and returns the new value once. */
export async function rotateSecret(
  clientId: string,
  id: string,
): Promise<{ webhook: Webhook; secret: string }> {
  await findWebhook(clientId, id);
  const secret = randomBytes(32).toString('hex');
  const webhook = await prisma.webhook.update({ where: { id }, data: { secret } });
  return { webhook, secret };
}
