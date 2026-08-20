import { createHmac, randomBytes } from 'node:crypto';
import type { WebhookAttempt, WebhookMessage } from '@prisma/client';
import { chance, subSeed } from '../../lib/determinism.js';
import { prisma } from '../../lib/prisma.js';
import { singleFieldError } from '../../lib/validation.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { WEBHOOK_EVENT_TYPES, type TestWebhookRequest } from './schema.js';

type MessageWithAttempts = WebhookMessage & { attempts: WebhookAttempt[] };

export function serializeMessage(message: WebhookMessage) {
  return {
    webhook_id: message.id,
    type: message.type,
    status: message.status,
    payload: message.payload,
    created_at: message.createdAt.toISOString(),
    updated_at: message.updatedAt.toISOString(),
  };
}

export function serializeMessageWithAttempts(message: MessageWithAttempts) {
  return {
    ...serializeMessage(message),
    attempts: message.attempts.map((attempt) => ({
      id: attempt.id,
      attempt_number: attempt.attemptNumber,
      succeeded: attempt.succeeded,
      signature: attempt.signature,
      created_at: attempt.createdAt.toISOString(),
    })),
  };
}

function signPayload(secret: string, payload: unknown): string {
  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

/** Replica-only extension (see spec.md) — the doc has no endpoint for setting the URL itself. */
export async function setWebhookUrl(clientId: string, url: string): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: { notificationWebhookUrl: url },
  });
}

/**
 * Doc: "Generate a new webhook secret ... Requires a webhook URL to be
 * configured first" — 428 otherwise. Always server-generated, never
 * caller-supplied (see spec.md's "Resolved conflicts").
 */
export async function rotateSecret(clientId: string): Promise<string> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!client.notificationWebhookUrl) {
    throw new ApiError(428, {
      message: 'A webhook URL must be configured before generating a secret',
    });
  }
  const secret = randomBytes(32).toString('hex');
  await prisma.client.update({
    where: { id: clientId },
    data: { notificationWebhookSecret: secret },
  });
  return secret;
}

export async function listMessages(
  clientId: string,
  dateFrom: string,
  dateTo: string | undefined,
  page: number,
  perPage: number,
): Promise<{ items: WebhookMessage[]; total: number }> {
  const where = {
    clientId,
    createdAt: { gte: new Date(dateFrom), lte: dateTo ? new Date(dateTo) : new Date() },
  };
  const [items, total] = await Promise.all([
    prisma.webhookMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.webhookMessage.count({ where }),
  ]);
  return { items, total };
}

export async function findMessage(clientId: string, id: string): Promise<MessageWithAttempts> {
  const message = await prisma.webhookMessage.findUnique({
    where: { id },
    include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
  });
  if (!message || message.clientId !== clientId) {
    throw new ApiError(404, { message: 'Not found' });
  }
  return message;
}

/**
 * Deterministic, seeded outcome — never a real HTTP request (see
 * spec.md's "Resolved conflicts"). 85% success, matching the "normal
 * case works" bias used everywhere else in this replica.
 */
async function attemptDelivery(message: WebhookMessage, secret: string): Promise<WebhookMessage> {
  const attemptNumber =
    (await prisma.webhookAttempt.count({ where: { messageId: message.id } })) + 1;
  const succeeded = chance(subSeed(subSeed(0, message.id), `attempt:${attemptNumber}`), 0.85);

  await prisma.webhookAttempt.create({
    data: {
      messageId: message.id,
      attemptNumber,
      succeeded,
      signature: signPayload(secret, message.payload),
    },
  });

  return prisma.webhookMessage.update({
    where: { id: message.id },
    data: { status: succeeded ? 'SUCCESS' : 'FAILED' },
  });
}

/**
 * Creates a webhook message and immediately attempts delivery — the
 * automatic push side of the webhooks user story. Called only from the
 * one place a remote check resolves (see modules/reports/service.ts). A
 * no-op when the client has no webhook URL configured.
 */
export async function deliverEvent(
  clientId: string,
  type: (typeof WEBHOOK_EVENT_TYPES)[number],
  data: Record<string, unknown>,
): Promise<void> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!client.notificationWebhookUrl || !client.notificationWebhookSecret) {
    return;
  }
  const message = await prisma.webhookMessage.create({
    data: {
      clientId,
      type,
      payload: { type, timestamp: new Date().toISOString(), data } as object,
    },
  });
  await attemptDelivery(message, client.notificationWebhookSecret);
}

/** 422/1303 unless the message is FAILED/RETRYING (doc-confirmed business rule). */
export async function retryMessage(clientId: string, id: string): Promise<WebhookMessage> {
  const message = await findMessage(clientId, id);
  if (message.status !== 'FAILED' && message.status !== 'RETRYING') {
    throw new ApiError(422, singleFieldError('_webhook', 1303));
  }
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  if (!client.notificationWebhookSecret) {
    throw new ApiError(428, {
      message: 'A webhook URL must be configured before retrying deliveries',
    });
  }
  await prisma.webhookMessage.update({ where: { id }, data: { status: 'RETRYING' } });
  return attemptDelivery(message, client.notificationWebhookSecret);
}

/**
 * Doc: "Test webhooks are not logged in your webhook message history" —
 * no `WebhookMessage` row is created. Simulates an immediate delivery and
 * returns the outcome directly.
 */
export async function sendTestMessage(
  clientId: string,
  input: TestWebhookRequest,
): Promise<{
  http_status_code: number;
  http_headers: Record<string, string>;
  http_message_payload: unknown;
}> {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const eventType =
    input.event_type ?? WEBHOOK_EVENT_TYPES[Math.floor(Math.random() * WEBHOOK_EVENT_TYPES.length)];
  const payload = {
    type: eventType,
    timestamp: new Date().toISOString(),
    data: {
      report_id: randomBytes(16).toString('hex'),
      remote_check_id: randomBytes(16).toString('hex'),
    },
  };
  const secret = input.valid_signature
    ? (client.notificationWebhookSecret ?? 'unconfigured')
    : 'invalid-secret';
  const succeeded = chance(subSeed(0, `test:${randomBytes(4).toString('hex')}`), 0.85);

  return {
    http_status_code: succeeded ? 200 : 500,
    http_headers: { 'webhook-test': 'true' },
    http_message_payload: { ...payload, signature: signPayload(secret, payload) },
  };
}
