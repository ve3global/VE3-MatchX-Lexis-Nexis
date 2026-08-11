import { z } from 'zod';
import { chance, int, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({
  // Doc-confirmed toggle (errorCodes.ts 1046/1160 — "full_er field must be
  // true or false") — whether to additionally check the full electoral
  // roll, not just the standard one.
  full_er: z.boolean().optional(),
});

const errorCodes: FieldErrorCodeMap = {
  full_er: { string: 1046 },
};

/**
 * The doc's appendix reportedly lists ~25 `address_*` attributes for this
 * action (see epic-7a's spec.md) — this is a representative subset, not
 * the full list, since only the count (not the individual names) is
 * confirmed. Bias per constitution.md's determinism section:
 * `address_verified` defaults true (~95%), matching "a normal subject
 * cleanly passes."
 */
function build(ctx: ActionContext): Record<string, unknown> {
  const result: Record<string, unknown> = {
    address_verified: chance(subSeed(ctx.seed, 'address-verification:verified'), 0.95),
    address_matched: chance(subSeed(ctx.seed, 'address-verification:matched'), 0.9),
    address_current: chance(subSeed(ctx.seed, 'address-verification:current'), 0.85),
    address_previous_count: int(subSeed(ctx.seed, 'address-verification:previous_count'), 0, 5),
    address_first_seen_years: int(subSeed(ctx.seed, 'address-verification:first_seen'), 1, 20),
    address_electoral_roll: chance(subSeed(ctx.seed, 'address-verification:electoral_roll'), 0.85),
    address_nfi_match: chance(subSeed(ctx.seed, 'address-verification:nfi_match'), 0.85),
    address_council_tax: chance(subSeed(ctx.seed, 'address-verification:council_tax'), 0.8),
    address_confidence_score: int(subSeed(ctx.seed, 'address-verification:confidence'), 0, 100),
  };

  if (ctx.requestBody.full_er) {
    result.address_full_er_match = chance(subSeed(ctx.seed, 'address-verification:full_er'), 0.8);
  }

  return result;
}

export const addressVerification: ActionModule = { schema, errorCodes, build };
