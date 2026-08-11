import { z } from 'zod';
import { isReportAttribute } from '../../lib/reportAttributes.js';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

const ruleSchema = z.object({
  attribute: z.string(),
  match_score: z.number().int(),
  no_match_score: z.number().int(),
});

const groupSchema = z.object({
  group_name: z.string().min(2).max(255),
  min_score: z.number().int(),
  rules: z.array(ruleSchema),
});

function validateGroups(groups: z.infer<typeof groupSchema>[], ctx: z.RefinementCtx): void {
  const seenGroupNames = new Set<string>();
  groups.forEach((group, groupIndex) => {
    if (seenGroupNames.has(group.group_name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['groups'],
        message: 'The groups.group_name field has a duplicate value',
        params: { code: 1166 },
      });
    }
    seenGroupNames.add(group.group_name);

    const seenAttributes = new Set<string>();
    group.rules.forEach((rule, ruleIndex) => {
      if (!isReportAttribute(rule.attribute)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['groups', groupIndex, 'rules', ruleIndex, 'attribute'],
          message: 'The groups.rules.attribute is not a valid report attribute',
          params: { code: 1171 },
        });
      }
      if (seenAttributes.has(rule.attribute)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['groups', groupIndex, 'rules'],
          message: 'The groups.rules contains a duplicate rule',
          params: { code: 1173 },
        });
      }
      seenAttributes.add(rule.attribute);
    });
  });
}

function validateThresholds(
  passThreshold: number | undefined,
  failThreshold: number | undefined,
  ctx: z.RefinementCtx,
): void {
  if (
    passThreshold !== undefined &&
    failThreshold !== undefined &&
    passThreshold <= failThreshold
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pass_threshold'],
      message: 'The scorecard pass threshold must be greater than the failure threshold',
      params: { code: 1163 },
    });
  }
}

const scorecardFields = {
  name: z.string(),
  pass_threshold: z.number().int().optional(),
  fail_threshold: z.number().int().optional(),
  groups: z.array(groupSchema).optional().default([]),
};

export const createScorecardSchema = z.object(scorecardFields).superRefine((data, ctx) => {
  validateGroups(data.groups, ctx);
  validateThresholds(data.pass_threshold, data.fail_threshold, ctx);
});

export type CreateScorecardRequest = z.infer<typeof createScorecardSchema>;

export const updateScorecardSchema = z
  .object(scorecardFields)
  .partial()
  .superRefine((data, ctx) => {
    if (data.groups) {
      validateGroups(data.groups, ctx);
    }
    validateThresholds(data.pass_threshold, data.fail_threshold, ctx);
  });

export type UpdateScorecardRequest = z.infer<typeof updateScorecardSchema>;

/**
 * Codes 1162/1164 (thresholds), 1165/1167-1170/1174/1175 (groups/rules
 * shape) are the doc's dedicated codes. Scorecard name-uniqueness has no
 * code explicitly labeled for scorecards — 1326 ("template name...") is
 * the closest doc-transcribed analog (see spec.md's "Resolved conflicts").
 */
export const SCORECARD_ERROR_CODES: FieldErrorCodeMap = {
  name: { required: 1001, string: 1000 },
  pass_threshold: { string: 1162 },
  fail_threshold: { string: 1164 },
  groups: { string: 1165 },
  'groups.group_name': { string: 1167, min: 1176, max: 1177 },
  'groups.min_score': { string: 1168 },
  'groups.rules': { string: 1169 },
  'groups.rules.attribute': { required: 1170 },
  'groups.rules.match_score': { string: 1174 },
  'groups.rules.no_match_score': { string: 1175 },
};
