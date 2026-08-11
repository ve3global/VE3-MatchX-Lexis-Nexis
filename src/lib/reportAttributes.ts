/**
 * The doc's fixed report-attribute-name enum (appendix "List of report
 * attributes", ~55 entries). The original 8 (EPIC-6) were confirmed from
 * EPIC-1's seed scorecard; the rest are this replica's own output field
 * names for the 27 action modules built in
 * EPIC-7a/7b/7c (see each module under modules/reports/actions/ — most
 * attribute *names* are designed, not transcribed, since the doc's own
 * ~55-name list isn't available; only the action *names themselves* and,
 * for death-screening/address-verification, doc-confirmed field counts
 * are real evidence). Still under 55 entries, so there's room to grow
 * without ever needing to shrink — same note as lib/reportActions.ts.
 */
export const REPORT_ATTRIBUTES = [
  // EPIC-6-confirmed.
  'address_verified',
  'dob_verified',
  'dob_count',
  'sanction',
  'pep',
  'death_ddri',
  'death_gro',
  'death_halo',
  // address-verification (representative subset of the doc's ~25).
  'address_matched',
  'address_current',
  'address_previous_count',
  'address_first_seen_years',
  'address_electoral_roll',
  'address_nfi_match',
  'address_council_tax',
  'address_confidence_score',
  'address_full_er_match',
  // bank-account-validation / bank-account-verification.
  'bank_account_valid',
  'bank_account_exists',
  'bank_account_name_matches',
  'bank_account_verified',
  // driving-licence-validation.
  'driving_licence_valid',
  'driving_licence_dob_match',
  // ni-number-validation.
  'ni_number_valid',
  // passport-validation.
  'passport_valid',
  'passport_mrz_checksum_valid',
  // email-risk.
  'email_risk_score',
  'email_high_risk',
  // phone-match / phone-number-validation.
  'phone_match',
  'phone_number_valid',
  // otp-email(-verification) / otp-sms(-verification).
  'otp_email_sent',
  'otp_email_verified',
  'otp_sms_sent',
  'otp_sms_verified',
  'otp_code',
  // remote-check.
  'remote_check_completed',
  'remote_check_result',
  // EPIC-7a/7b additions (see lib/reportActions.ts's derivation comment).
  'nfi_amberhill_match',
  'nfi_address_match',
  'property_register_match',
  'ccj_found',
  'insolvency_found',
  'director_match',
  'credit_active',
  'experian_match',
  'equifax_match',
  'address_insights_stable',
  'address_insights_score',
  'age_verified',
] as const;

export type ReportAttribute = (typeof REPORT_ATTRIBUTES)[number];

export function isReportAttribute(value: string): value is ReportAttribute {
  return (REPORT_ATTRIBUTES as readonly string[]).includes(value);
}
