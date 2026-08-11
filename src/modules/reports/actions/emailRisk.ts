import { z } from 'zod';
import { int, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z
  .object({
    emails: z
      .array(
        z.object({
          email: z.string().email(),
          role: z.string().optional(),
        }),
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const entry of data.emails) {
      if (seen.has(entry.email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['emails'],
          message: 'The emails.email field has a duplicate value',
          params: { code: 1109 },
        });
      }
      seen.add(entry.email);
    }
  });

const errorCodes: FieldErrorCodeMap = {
  emails: { required: 1110, string: 1105 },
  'emails.email': { required: 1107, invalid: 1108 },
};

function build(ctx: ActionContext): Record<string, unknown> {
  const emails = (ctx.requestBody.emails as { email: string }[]).map((e) => e.email);
  const seed = subSeed(ctx.seed, `email-risk:${emails.join(',')}`);
  const score = int(seed, 0, 100);
  return {
    email_risk_score: score,
    email_high_risk: score >= 80,
  };
}

export const emailRisk: ActionModule = { schema, errorCodes, build };
