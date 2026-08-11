import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

export const tokenRequestSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
});

export type TokenRequest = z.infer<typeof tokenRequestSchema>;

/**
 * The doc's error-code appendix has no dedicated codes for `client_id`/
 * `client_secret` (they're not referenced anywhere in the 1000-1348 table —
 * confirmed by full transcription). 1319 ("The request contains invalid
 * parameters") is the table's own generic catch-all, used here for both
 * fields rather than inventing codes the doc doesn't define.
 */
export const TOKEN_REQUEST_ERROR_CODES: FieldErrorCodeMap = {
  client_id: { required: 1319, string: 1319 },
  client_secret: { required: 1319, string: 1319 },
};
