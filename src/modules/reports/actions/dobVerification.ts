import { z } from 'zod';
import { chance, int, subSeed } from '../../../lib/determinism.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

/** `dob_verified`/`dob_count` — the exact two attribute names EPIC-1's seed scorecard already uses. */
function build(ctx: ActionContext): Record<string, unknown> {
  return {
    dob_verified: chance(subSeed(ctx.seed, 'dob-verification:verified'), 0.95),
    dob_count: int(subSeed(ctx.seed, 'dob-verification:count'), 0, 3),
  };
}

export const dobVerification: ActionModule = { schema, errorCodes: {}, build };
