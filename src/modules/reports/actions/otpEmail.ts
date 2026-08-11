import { z } from 'zod';
import { int, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({
  email: z.string().email(),
});

const errorCodes: FieldErrorCodeMap = {
  email: { required: 1289, invalid: 1290 },
};

/**
 * `otp_code` is a replica-only convenience field (see constitution.md) —
 * a real send-OTP response would never echo the code, but this replica
 * has no real inbox for a caller to read it from, so it's returned here
 * for otp-email-verification (or a human tester) to use.
 */
function build(ctx: ActionContext): Record<string, unknown> {
  const { email } = ctx.requestBody as { email: string };
  const code = String(int(subSeed(ctx.seed, `otp-email:${email}`), 100000, 999999));
  return { otp_email_sent: true, otp_code: code };
}

export const otpEmail: ActionModule = { schema, errorCodes, build };
