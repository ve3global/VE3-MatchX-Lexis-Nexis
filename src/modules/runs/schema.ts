import { z } from 'zod';
import type { FieldErrorCodeMap } from '../../lib/validation.js';

/**
 * Replica-only extension (see constitution.md, .scratch/run-simulation/spec.md)
 * — no LN doc equivalent, so the supported set is scoped to exactly what the
 * feature was designed for: the 3 fault-injection-style 5xx-adjacent
 * statuses this replica already fabricates elsewhere, plus 422/429 (a
 * deliberate departure from fault injection, which never touches either).
 */
export const RUN_STATUSES = [200, 422, 429, 500, 502, 503, 504] as const;
export type RunStatusCode = (typeof RUN_STATUSES)[number];

function isRunStatus(value: number): value is RunStatusCode {
  return (RUN_STATUSES as readonly number[]).includes(value);
}

const distributionEntrySchema = z.object({
  status: z.number().int(),
  weight: z.number().int().min(0).max(100),
});

/**
 * Cross-field checks a flat per-field codeMap can't express: every status
 * must be one of RUN_STATUSES, no status may repeat, and the weights must
 * sum to exactly 100 — a run is meant to fully account for every request
 * under it, not leave an implicit remainder.
 */
function validateDistribution(
  distribution: z.infer<typeof distributionEntrySchema>[],
  ctx: z.RefinementCtx,
): void {
  const seenStatuses = new Set<number>();
  let totalWeight = 0;

  distribution.forEach((entry, index) => {
    if (!isRunStatus(entry.status)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['distribution', index, 'status'],
        message: 'The distribution.status is not a supported status code',
        params: { code: 1319 },
      });
    }
    if (seenStatuses.has(entry.status)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['distribution', index, 'status'],
        message: 'The distribution contains a duplicate status',
        params: { code: 1319 },
      });
    }
    seenStatuses.add(entry.status);
    totalWeight += entry.weight;
  });

  if (totalWeight !== 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['distribution'],
      message: 'The distribution weights must sum to exactly 100',
      params: { code: 1319 },
    });
  }
}

export const createRunSchema = z
  .object({
    distribution: z.array(distributionEntrySchema).min(1),
    expected_requests: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => validateDistribution(data.distribution, ctx));

export type CreateRunRequest = z.infer<typeof createRunSchema>;

/**
 * No LN doc code table entry exists for this replica-only resource at all —
 * 1319 ("The request contains invalid parameters") is the doc's own generic
 * catch-all, same precedent POST /clients's own schema already uses for the
 * same reason.
 */
export const RUN_ERROR_CODES: FieldErrorCodeMap = {
  distribution: { required: 1319, string: 1319, min: 1319 },
  'distribution.status': { required: 1319, string: 1319 },
  'distribution.weight': { required: 1319, string: 1319, min: 1319, max: 1319 },
  expected_requests: { string: 1319, min: 1319 },
};
