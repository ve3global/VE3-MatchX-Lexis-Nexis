import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({
  ni_number: z.string().max(9),
});

const errorCodes: FieldErrorCodeMap = {
  ni_number: { required: 1203, string: 1204, max: 1262 },
};

function build(ctx: ActionContext): Record<string, unknown> {
  const { ni_number } = ctx.requestBody as { ni_number: string };
  return {
    ni_number_valid: chance(subSeed(ctx.seed, `ni-number-validation:${ni_number}`), 0.9),
  };
}

export const niNumberValidation: ActionModule = { schema, errorCodes, build };
