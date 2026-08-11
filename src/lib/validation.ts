import type { ZodError, ZodIssue } from 'zod';
import { errorMessage } from './errorCodes.js';

export type RuleType = 'required' | 'string' | 'min' | 'max' | 'invalid' | 'duplicate' | 'custom';

export type FieldErrorCodeMap = Record<string, Partial<Record<RuleType, number>>>;

export interface ValidationErrorBody {
  message: string;
  errors: Record<string, { code: number; message: string }[]>;
}

function ruleTypeFor(issue: ZodIssue): RuleType {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' ? 'required' : 'string';
    case 'too_small':
      return 'min';
    case 'too_big':
      return 'max';
    case 'invalid_string':
    case 'invalid_enum_value':
      return 'invalid';
    default:
      return 'custom';
  }
}

/**
 * Maps Zod validation issues to the doc's numbered error codes (see
 * lib/errorCodes.ts). Every field a schema can fail on must have a
 * corresponding entry in `codeMap` for every rule type it can violate —
 * this throws rather than silently falling back, so a missing mapping is
 * caught in development/tests, not shipped as a vague error to a consumer.
 *
 * Exception: a `custom` (superRefine-raised) issue may carry its own code
 * via `params.code`, bypassing `codeMap` entirely. This is how a single
 * field (e.g. `primary_actions`) reports several distinct doc codes —
 * "does not exist" vs "duplicate value" vs "in both lists" — that a flat
 * `{field: {ruleType: code}}` map can't disambiguate on its own.
 *
 * `codeMap` keys are array-index-agnostic (e.g. `"groups.rules.attribute"`,
 * never `"groups.0.rules.1.attribute"`) since the map is defined once per
 * field *shape*, not per element — the response body itself still reports
 * the precise indexed path so a caller knows exactly which element failed.
 */
export function mapZodError(error: ZodError, codeMap: FieldErrorCodeMap): ValidationErrorBody {
  const errors: ValidationErrorBody['errors'] = {};

  for (const issue of error.issues) {
    const field = issue.path.join('.');
    const codeMapKey = issue.path.filter((segment) => typeof segment !== 'number').join('.');
    const explicitCode =
      issue.code === 'custom' && typeof issue.params?.code === 'number'
        ? issue.params.code
        : undefined;
    const code = explicitCode ?? codeMap[codeMapKey]?.[ruleTypeFor(issue)];
    if (code === undefined) {
      throw new Error(
        `No error code mapped for field "${codeMapKey}" rule "${ruleTypeFor(issue)}" (zod code: ${issue.code})`,
      );
    }
    errors[field] = errors[field] ?? [];
    errors[field].push({ code, message: errorMessage(code) });
  }

  const firstError = Object.values(errors)[0]?.[0];
  return {
    message: firstError?.message ?? 'The given data was invalid.',
    errors,
  };
}

/** Builds the same `{message, errors}` shape as `mapZodError` for a single business-rule violation. */
export function singleFieldError(field: string, code: number): ValidationErrorBody {
  return {
    message: errorMessage(code),
    errors: { [field]: [{ code, message: errorMessage(code) }] },
  };
}
