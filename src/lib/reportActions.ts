/**
 * The doc's fixed report-action-name enum (appendix "List of report
 * actions", 27 entries). Every name here traces to real evidence, not
 * invention — see
 * planning/specs/epic-7a-identity-address-actions/spec.md's "Resolved
 * conflicts" for the full derivation. Three tiers:
 *
 * 1. The 15 EPIC-7c actions — doc-derived, explicitly listed in
 *    constitution.md's ticket → epic map (no ticket number, confirmed
 *    from the doc's own action-list appendix).
 * 2. The 4 EPIC-1-seeded actions — address-verification, dob-verification,
 *    sanction-screening, pep-screening — used by the seed scorecard since
 *    EPIC-1, predating this file.
 * 3. 8 more, one per remaining EPIC-7a/7b ticket (LN32-36/39,
 *    LN43-46/48/49), each justified by a specific `lib/errorCodes.ts`
 *    entry matching the doc's own "`<name>` field must be true or false"
 *    action-enablement-toggle pattern (the same pattern that already
 *    confirms bank_account_validation/driving_licence_validation/
 *    ni_number_validation/passport_validation/email_risk/otp_email/
 *    otp_sms/phone_match/phone_number_validation/remote_check/
 *    nfi_amberhill/sanction/pep/death as action names):
 *      - `address_insights` (code 1180) → address-insights
 *      - `age` (code 1120) → age-verification
 *      - `nfi_address` (code 1253, distinct from nfi_amberhill/1254) → nfi-address
 *      - `property_register_search` (code 1266) → property-register-search
 *      - `ccj` (code 1057) → ccj-check
 *      - `insolvency` (code 1058) → insolvency-check
 *      - `director` (code 1076) → director-check
 *      - `experian`/`equifax`/`credit_activity`/`credit_active_mode`/
 *        `credit_active_primary` (codes 1074/1075/1048/1082/1083) →
 *        bundled into one credit-check action, matching how real UK
 *        bureau-aggregator checks (Experian/Equifax + CCJ/insolvency +
 *        director search) are typically offered as one product
 *
 * Exact request/response field shapes beyond what a ticket/error-code
 * confirms are this replica's own reasonable design — flagged per-module
 * in modules/reports/actions/, same "designed, not transcribed" practice
 * as EPIC-3's address-lookup response shape.
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
  'nfi-address',
  'property-register-search',
  'ccj-check',
  'insolvency-check',
  'director-check',
  'credit-check',
] as const;

export type ReportAction = (typeof REPORT_ACTIONS)[number];

export function isReportAction(value: string): value is ReportAction {
  return (REPORT_ACTIONS as readonly string[]).includes(value);
}
