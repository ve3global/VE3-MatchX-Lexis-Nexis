import { z } from 'zod';
import { chance, int, subSeed } from '../../../lib/determinism.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

/**
 * Doc-confirmed shape (2026-09-10 capture): `{matched, sources: [{source,
 * dob_count, day_match, month_match, year_match}]}` — richer than the old
 * flat `{dob_verified, dob_count}` guess. `dob_verified` is kept as a
 * back-compat scoring attribute (EPIC-1's seed scorecard already rules on
 * it, and it's not shown one way or the other in the capture's own
 * `attributes` bag, only `dob_count` is); `dob_count` matches the capture
 * verbatim.
 */
function build(ctx: ActionContext): Record<string, unknown> {
  const s = (key: string) => subSeed(ctx.seed, `dob-verification:${key}`);
  return {
    dob_verified: chance(s('verified'), 0.95),
    dob_count: int(s('count'), 0, 3),
  };
}

function buildResponse(ctx: ActionContext, attributes: Record<string, unknown>) {
  const s = (key: string) => subSeed(ctx.seed, `dob-verification:${key}`);
  const dobCount = Number(attributes.dob_count ?? 0);
  const matched = Boolean(attributes.dob_verified) && dobCount > 0;
  return {
    matched,
    sources: [
      {
        source: 'LexisNexis',
        dob_count: dobCount,
        day_match: matched && chance(s('day_match'), 0.8),
        month_match: matched && chance(s('month_match'), 0.8),
        year_match: matched && chance(s('year_match'), 0.9),
      },
    ],
  };
}

export const dobVerification: ActionModule = { schema, errorCodes: {}, build, buildResponse };
