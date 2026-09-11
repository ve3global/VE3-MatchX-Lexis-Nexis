import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

/**
 * Doc-confirmed shape (2026-09-10 capture): `{matched}`, scoring attribute
 * `ccj` — renamed from the guessed `ccj-check`/`ccj_found` pair, whose
 * names never had direct evidence.
 */
function build(ctx: ActionContext): Record<string, unknown> {
  return { ccj: chance(subSeed(ctx.seed, 'ccj-screening:ccj'), 0.05) };
}

function buildResponse(_ctx: ActionContext, attributes: Record<string, unknown>) {
  return { matched: Boolean(attributes.ccj) };
}

export const ccjScreening: ActionModule = { schema, errorCodes: {}, build, buildResponse };
