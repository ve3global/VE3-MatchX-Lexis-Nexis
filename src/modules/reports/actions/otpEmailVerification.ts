import { z } from 'zod';
import { singleFieldError } from '../../../lib/validation.js';
import { ApiError } from '../../../middleware/errorHandler.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

const errorCodes: FieldErrorCodeMap = {
  code: { required: 1292, invalid: 1293 },
};

/** Doc code 1294 ("An OTP code must be generated first") fires when no otp-email action has run yet on this report. */
function build(ctx: ActionContext): Record<string, unknown> {
  const priorCode = ctx.priorResults['otp-email']?.otp_code;
  if (typeof priorCode !== 'string') {
    throw new ApiError(422, singleFieldError('code', 1294));
  }
  const { code } = ctx.requestBody as { code: string };
  return { otp_email_verified: code === priorCode };
}

export const otpEmailVerification: ActionModule = { schema, errorCodes, build };
