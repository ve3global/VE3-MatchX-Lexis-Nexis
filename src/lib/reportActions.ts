import type { RefinementCtx } from 'zod';

/**
 * The doc's fixed report-action-name enum (appendix "List of report
 * actions", 27 entries). Every name here traces to real evidence, not
 * invention — see
 * planning/specs/epic-7a-identity-address-actions/spec.md's "Resolved
 * conflicts" for the full derivation. Four tiers:
 *
 * 1. The 15 EPIC-7c actions — doc-derived, explicitly listed in
 *    constitution.md's ticket → epic map (no ticket number, confirmed
 *    from the doc's own action-list appendix).
 * 2. The 4 EPIC-1-seeded actions — address-verification, dob-verification,
 *    sanction-screening, pep-screening — used by the seed scorecard since
 *    EPIC-1, predating this file.
 * 3. 5 more, one per remaining EPIC-7a/7b ticket (LN36/39,
 *    LN43-44/46), each justified by a specific `lib/errorCodes.ts`
 *    entry matching the doc's own "`<name>` field must be true or false"
 *    action-enablement-toggle pattern (the same pattern that already
 *    confirms bank_account_validation/driving_licence_validation/
 *    ni_number_validation/passport_validation/email_risk/otp_email/
 *    otp_sms/phone_match/phone_number_validation/remote_check/
 *    nfi_amberhill/sanction/pep/death as action names):
 *      - `address_insights` (code 1180) → address-insights
 *      - `property_register_search` (code 1266) → property-register-search
 *      - `insolvency` (code 1058) → insolvency-check
 *
 * 4. 7 actions whose real request/response shape is now confirmed by a
 *    live sandbox capture (2026-09-10, `planning/api-drift-remediation.md`),
 *    superseding the bare error-code-toggle guesses tier 3 above still
 *    uses for everything *not* in this capture:
 *      - `age-verification` — `age` toggle (code 1120), shape confirmed
 *      - `ccj-screening` — renamed from the guessed `ccj-check` slug
 *        (code 1057's field is `ccj`, matching the doc's own action-name
 *        convention better than "-check")
 *      - `company-officer-screening` — renamed from the guessed
 *        `director-check` slug (code 1076's field is `director`, but the
 *        capture's response key is `company_officer_screening`)
 *      - `credit-active` — renamed from the guessed `credit-check` slug;
 *        still one bundled action (see tier 3's `experian`/`equifax`/
 *        `credit_activity` derivation above), the capture's own action
 *        name is `credit-active`
 *      - `lexid-match` — previously unimplemented; the capture's
 *        `lexid_match` response block confirms both the name and shape
 *      - `address-verification` — shape confirmed (nested `config`
 *        request, rich response block, ~26 doc-confirmed attributes)
 *      - `dob-verification` — shape confirmed (`matched`/`sources`, not
 *        the old flat `dob_verified`/`dob_count` guess)
 *    The standalone `nfi-address` action (tier 3, code 1253) is retired:
 *    the capture shows `nfi_address` is address-verification's own
 *    `config.nfi_address` toggle, not a separate action (see
 *    api-drift-remediation.md's 2026-09-10 entry).
 *
 * Exact request/response field shapes beyond what a ticket/error-code/
 * capture confirms are this replica's own reasonable design — flagged
 * per-module in modules/reports/actions/, same "designed, not
 * transcribed" practice as EPIC-3's address-lookup response shape.
 */
export const REPORT_ACTIONS = [
  'address-verification',
  'dob-verification',
  'sanction-screening',
  'pep-screening',
  'bank-account-validation',
  'bank-account-verification',
  'death-screening',
  'driving-licence-validation',
  'email-risk',
  'nfi-amberhill',
  'ni-number-validation',
  'otp-email',
  'otp-email-verification',
  'otp-sms',
  'otp-sms-verification',
  'passport-validation',
  'phone-match',
  'phone-number-validation',
  'remote-check',
  'address-insights',
  'age-verification',
  'property-register-search',
  'ccj-screening',
  'insolvency-check',
  'company-officer-screening',
  'credit-active',
  'lexid-match',
] as const;

export type ReportAction = (typeof REPORT_ACTIONS)[number];

export function isReportAction(value: string): value is ReportAction {
  return (REPORT_ACTIONS as readonly string[]).includes(value);
}

/**
 * Shared by report-types' `primary_actions`/`secondary_actions` and
 * reports' inline `actions` (epic-4-reports-core/spec.md) — every list of
 * action-name strings gets the same "does this action exist" / "no
 * duplicates" treatment, just against different doc error codes per field.
 */
export function validateActionList(
  list: string[],
  field: 'primary_actions' | 'secondary_actions' | 'actions',
  codes: { notExist: number; duplicate: number },
  ctx: RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const action of list) {
    if (!isReportAction(action)) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: `The ${action} report action does not exist`,
        params: { code: codes.notExist },
      });
    }
    if (seen.has(action)) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: `The ${field} field has a duplicate value`,
        params: { code: codes.duplicate },
      });
    }
    seen.add(action);
  }
}
