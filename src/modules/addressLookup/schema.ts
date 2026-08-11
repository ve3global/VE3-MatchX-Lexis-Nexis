import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

export const addressLookupSchema = z
  .object({
    postcode: z.string().max(64).optional(),
    full_address: z.string().max(255).optional(),
    house: z.string().max(255).optional(),
    street: z.string().max(255).optional(),
    town: z.string().max(255).optional(),
    fuzzy: z.boolean().optional(),
    alias: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.postcode ?? data.full_address), {
    message: 'The request contains invalid parameters',
    path: ['_lookup'],
  });

export type AddressLookupRequest = z.infer<typeof addressLookupSchema>;

/**
 * Codes 1024-1035 are the doc's dedicated address-lookup field codes.
 * "At least one of postcode/full_address" has no dedicated code (see
 * spec.md's "Resolved conflicts") — falls back to the doc's generic 1319,
 * same precedent as EPIC-2's client_id/client_secret mapping.
 */
export const ADDRESS_LOOKUP_ERROR_CODES: FieldErrorCodeMap = {
  _lookup: { custom: 1319 },
  full_address: { string: 1024, max: 1025 },
  house: { string: 1026, max: 1027 },
  street: { string: 1028, max: 1029 },
  town: { string: 1030, max: 1031 },
  postcode: { string: 1032, max: 1033 },
  fuzzy: { string: 1034 },
  alias: { string: 1035 },
};
