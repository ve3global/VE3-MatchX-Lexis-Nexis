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
  build: (ctx: ActionContext) => Record<string, unknown>;
}
