import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { logSecurityEvent } from '../../lib/securityLog.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { CREATE_CLIENT_ERROR_CODES, createClientSchema } from './schema.js';
import { createClient } from './service.js';

export const clientsRouter = Router();

const PROVISION_KEY_HEADER = 'x-ln-replica-provision-key';

/** Constant-time compare so response timing can't leak how much of a guessed key matched. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Replica-only extension (see constitution.md) — mints a new tenant's
 * client_id/client_secret on demand. No LN doc equivalent: today's only
 * client-provisioning path is prisma/seed.ts's hardcoded demo client.
 * Mounted pre-auth (like /oauth/token, see app.ts) since a caller can't
 * hold a bearer token before it has credentials — gated instead by its
 * own shared secret (CLIENT_PROVISION_KEY), sent as a header rather than
 * a body field so it never gets logged/echoed alongside ordinary request
 * validation errors. Unconfigured (no env var set) fails closed: the
 * route 500s rather than silently accepting any/no key.
 */
clientsRouter.post('/clients', async (req, res, next) => {
  const configuredKey = process.env.CLIENT_PROVISION_KEY;
  if (!configuredKey) {
    next(new Error('CLIENT_PROVISION_KEY is not configured'));
    return;
  }

  const providedKey = req.header(PROVISION_KEY_HEADER);
  if (!providedKey || !safeEqual(providedKey, configuredKey)) {
    logSecurityEvent({
      event: 'client_provision_rejected',
      reason: providedKey ? 'invalid_key' : 'missing_key',
      correlationId: req.correlationId,
    });
    res.status(401).json({ message: 'Unauthenticated' });
    return;
  }

  const parsed = createClientSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, CREATE_CLIENT_ERROR_CODES));
    return;
  }

  try {
    const client = await createClient(parsed.data.name);
    res.status(201).json({
      data: {
        id: client.id,
        client_id: client.clientId,
        client_secret: client.clientSecret,
        name: client.name,
        created_at: client.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});
