import { z } from 'zod';
import { chance, subSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

// Codes 1211-1234 confirm exactly 8 required-string MRZ line-2 parts;
// their individual "must be X characters" codes are skipped since the
// doc collapses the length placeholder and this replica has no confirmed
// real value to substitute (see spec.md's "Resolved conflicts").
const schema = z.object({
  passport: z.object({
    mrz_line2: z.object({
      part1: z.string(),
      part2: z.string(),
      part3: z.string(),
      part4: z.string(),
      part5: z.string(),
      part6: z.string(),
      part7: z.string(),
      part8: z.string(),
    }),
  }),
});

const errorCodes: FieldErrorCodeMap = {
  'passport.mrz_line2.part1': { required: 1211, string: 1212 },
  'passport.mrz_line2.part2': { required: 1214, string: 1215 },
  'passport.mrz_line2.part3': { required: 1217, string: 1218 },
  'passport.mrz_line2.part4': { required: 1220, string: 1221 },
  'passport.mrz_line2.part5': { required: 1223, string: 1224 },
  'passport.mrz_line2.part6': { required: 1226, string: 1227 },
  'passport.mrz_line2.part7': { required: 1229, string: 1230 },
  'passport.mrz_line2.part8': { required: 1232, string: 1233 },
};

function build(ctx: ActionContext): Record<string, unknown> {
  const mrz = (ctx.requestBody.passport as { mrz_line2: Record<string, string> }).mrz_line2;
  const mrzSeed = subSeed(ctx.seed, `passport-validation:${Object.values(mrz).join('')}`);
  return {
    passport_valid: chance(subSeed(mrzSeed, 'valid'), 0.9),
    passport_mrz_checksum_valid: chance(subSeed(mrzSeed, 'checksum'), 0.92),
  };
}

export const passportValidation: ActionModule = { schema, errorCodes, build };
