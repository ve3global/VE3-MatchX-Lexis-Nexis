import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

export const createClientSchema = z.object({
  name: z.string().min(1).max(255),
});

export type CreateClientRequest = z.infer<typeof createClientSchema>;

/**
 * Replica-only extension (see constitution.md) — no LN doc code table entry
 * exists for this endpoint at all. 1319 ("The request contains invalid
 * parameters") is the doc's own generic catch-all, same precedent
 * auth/schema.ts's TOKEN_REQUEST_ERROR_CODES uses for client_id/client_secret.
 */
export const CREATE_CLIENT_ERROR_CODES: FieldErrorCodeMap = {
  name: { required: 1319, string: 1319, min: 1319, max: 1319 },
};
