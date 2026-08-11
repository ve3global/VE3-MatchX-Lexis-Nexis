import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import { isDeathOverride } from '../../../lib/qaOverrides.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

/**
 * `death_ddri`/`death_gro`/`death_halo` — the exact three attributes
 * confirmed ahead of this epic (see epic-7c's spec.md). QA override
 * (README): dob "1900-01-01" forces all three true.
 */
function build(ctx: ActionContext): Record<string, unknown> {
  const overridden = isDeathOverride(ctx.subject);
  return {
    death_ddri: overridden || chance(subSeed(ctx.seed, 'death-screening:ddri'), 0.03),
    death_gro: overridden || chance(subSeed(ctx.seed, 'death-screening:gro'), 0.03),
    death_halo: overridden || chance(subSeed(ctx.seed, 'death-screening:halo'), 0.03),
  };
}

export const deathScreening: ActionModule = { schema, errorCodes: {}, build };
