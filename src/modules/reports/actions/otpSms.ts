import { z } from 'zod';
import { int, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({
  phone_code: z.string(),
  phone_number: z.string(),
});

// 1284/1285 are this action's own "required" pair (distinct from
// phone-number-validation's 1272-1276/1341-1342 — see that module's
// comment for the split rationale).
const errorCodes: FieldErrorCodeMap = {
  phone_code: { required: 1284, string: 1284 },
  phone_number: { required: 1285, string: 1285 },
};

/** `otp_code` is a replica-only convenience field, same rationale as otp-email's. */
function build(ctx: ActionContext): Record<string, unknown> {
  const { phone_code, phone_number } = ctx.requestBody as {
    phone_code: string;
    phone_number: string;
  };
  const code = String(
    int(subSeed(ctx.seed, `otp-sms:${phone_code}:${phone_number}`), 100000, 999999),
  );
  return { otp_sms_sent: true, otp_code: code };
}

export const otpSms: ActionModule = { schema, errorCodes, build };
