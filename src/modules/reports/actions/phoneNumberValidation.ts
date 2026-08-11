import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({
  phone_code: z.string().regex(/^\+?\d{1,4}$/),
  phone_number: z.string().min(4).max(20).regex(/^\d+$/),
});

// Codes 1272-1276 (format/min/max) and 1341-1342 (string-type) are this
// action's own confirmed pair; no dedicated "required" code exists for
// either field here (that's 1284/1285, used by otp-sms's own request
// instead — see spec.md's "Resolved conflicts") so a missing field falls
// back to the generic 1319, same precedent as prior epics.
const errorCodes: FieldErrorCodeMap = {
  phone_code: { required: 1319, string: 1342, invalid: 1272, max: 1273 },
  phone_number: { required: 1319, string: 1341, invalid: 1274, min: 1275, max: 1276 },
};

function build(ctx: ActionContext): Record<string, unknown> {
  const { phone_code, phone_number } = ctx.requestBody as {
    phone_code: string;
    phone_number: string;
  };
  return {
    phone_number_valid: chance(
      subSeed(ctx.seed, `phone-number-validation:${phone_code}:${phone_number}`),
      0.9,
    ),
  };
}

export const phoneNumberValidation: ActionModule = { schema, errorCodes, build };
