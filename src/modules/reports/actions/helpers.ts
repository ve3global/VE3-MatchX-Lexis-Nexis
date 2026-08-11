import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { ActionContext, ActionModule } from './types.js';

/** No request fields at all — most of the thin-evidence actions take none beyond the subject already on the report. */
export const emptyBodySchema = z.object({});

export interface BooleanAttribute {
  key: string;
  /** Probability this attribute comes back `true` — see each caller for the doc-derived or reasonable-default bias. */
  probability: number;
}

/**
 * A module whose request body is empty and whose result is one or more
 * independent seeded boolean flags. Covers every EPIC-7a/7b action built
 * from a bare error-code toggle with no further doc detail (see
 * lib/reportActions.ts's derivation comment) — kept honestly uniform
 * rather than inventing bespoke behavior this replica has no evidence for.
 */
export function booleanAction(actionName: string, attributes: BooleanAttribute[]): ActionModule {
  return {
    schema: emptyBodySchema,
    errorCodes: {},
    build(ctx: ActionContext) {
      const result: Record<string, boolean> = {};
      for (const attribute of attributes) {
        const attributeSeed = subSeed(ctx.seed, `${actionName}:${attribute.key}`);
        result[attribute.key] = chance(attributeSeed, attribute.probability);
      }
      return result;
    },
  };
}
