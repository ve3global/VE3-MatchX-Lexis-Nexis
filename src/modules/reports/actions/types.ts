import type { ZodTypeAny } from 'zod';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';

export interface ActionSubject {
  forename?: string | null;
  middlename?: string | null;
  surname?: string | null;
  dob?: string | null;
  address?: { address1?: string; postcode?: string } | null;
}

export interface ActionContext {
  subject: ActionSubject;
  /** The action's own validated request body (`{}` for actions with no request fields). */
  requestBody: Record<string, unknown>;
  /** Root seed for this report's subject (see lib/determinism.ts) — same subject, same seed, every run. */
  seed: number;
  /** `resultPayload` of every action already run on this report, keyed by action name — lets e.g. otp-*-verification check a prior otp-* run. */
  priorResults: Record<string, Record<string, unknown>>;
}

export interface ActionModule {
  schema: ZodTypeAny;
  errorCodes: FieldErrorCodeMap;
  /** The flat, score-relevant attributes this action contributes (merged into the report's `attributes` bag). */
  build: (ctx: ActionContext) => Record<string, unknown>;
  /**
   * Optional doc-confirmed response envelope, richer than the flat
   * `build` attributes (e.g. address-verification's nested `address`/
   * `sources` block, or dob-verification's `matched`/`sources` shape).
   * Falls back to `build`'s own return value when absent — every action
   * without direct evidence of a richer response shape.
   */
  buildResponse?: (
    ctx: ActionContext,
    attributes: Record<string, unknown>,
  ) => Record<string, unknown>;
}
