import { z } from 'zod';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

function ageFromDob(dob: string): number {
  const ageMs = Date.now() - new Date(dob).getTime();
  return ageMs / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Doc-confirmed shape (2026-09-10 capture): `{verified, reason?}`, not the
 * old flat `age_verified` boolean guess — and no scoring attribute at all
 * (the capture's `attributes` bag carries `age_min`/`age_max` straight
 * from the report's context, never anything age-verification itself
 * produces). `reason` mirrors the capture's two observed values:
 * `NO_DOB_FOUND` (no dob on file) and `DOB_MISMATCH` (a prior lexid-match
 * result's dob disagrees with the subject's own).
 */
function build(ctx: ActionContext): Record<string, unknown> {
  if (!ctx.subject.dob) {
    return { verified: false, reason: 'NO_DOB_FOUND' };
  }

  const lexidMatch = ctx.priorResults['lexid-match'] as { dob?: string } | undefined;
  if (lexidMatch?.dob && lexidMatch.dob !== ctx.subject.dob) {
    return { verified: false, reason: 'DOB_MISMATCH' };
  }

  const age = ageFromDob(ctx.subject.dob);
  return age >= 18 && age < 115 ? { verified: true } : { verified: false, reason: 'OUT_OF_RANGE' };
}

export const ageVerification: ActionModule = { schema, errorCodes: {}, build };
