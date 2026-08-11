import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({
  driving_licence_number: z.string().min(8).max(18),
});

const errorCodes: FieldErrorCodeMap = {
  driving_licence_number: { required: 1236, string: 1237, min: 1238, max: 1239 },
};

function build(ctx: ActionContext): Record<string, unknown> {
  const { driving_licence_number } = ctx.requestBody as { driving_licence_number: string };
  const licenceSeed = subSeed(ctx.seed, `driving-licence-validation:${driving_licence_number}`);
  return {
    driving_licence_valid: chance(subSeed(licenceSeed, 'valid'), 0.9),
    // The doc's real UK driving-licence number embeds the holder's dob —
    // this replica doesn't decode it (format not confirmed), just checks
    // a subject dob was actually given to compare against (code 1240,
    // "dob does not match the format X", covers the real embedded check).
    driving_licence_dob_match: ctx.subject.dob
      ? chance(subSeed(licenceSeed, 'dob_match'), 0.9)
      : false,
  };
}

export const drivingLicenceValidation: ActionModule = { schema, errorCodes, build };
