/**
 * The doc's fixed report-attribute-name enum (appendix "List of report
 * attributes", ~55 entries). The original 8 (EPIC-6) were confirmed from
 * EPIC-1's seed scorecard; the address-verification/company-officer/ccj/
 * credit/lexid-match entries are confirmed by a live sandbox capture
 * (2026-09-10, `planning/api-drift-remediation.md`) — including its own
 * worked scorecard example, which literally rules on these exact names.
 * The remainder are this replica's own output field names for the
 * still-unconfirmed EPIC-7a/7b/7c action modules (see each module under
 * modules/reports/actions/ — designed, not transcribed). Still under 55
 * entries, so there's room to grow without ever needing to shrink — same
 * note as lib/reportActions.ts.
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
  // address-verification — base set (2026-09-10 capture).
  'address_current_er',
  'address_gone_away_high',
  'address_gone_away_very_high',
  'address_historic_er',
  'address_companies_house',
  'address_insolvency_service',
  'address_registry_trust',
  'address_telephone_directory',
  'address_tracesmart_register',
  // address-verification — nfi_address-gated extension (same capture).
  'address_council_tax',
  'address_council_tax_reduction_scheme',
  'address_deferred_pensions',
  'address_housing_benefits',
  'address_housing_tenants',
  'address_nfi_sources',
  'address_payroll',
  'address_pensions',
  'address_pensions_gratuities',
  'address_personal_budgets',
  'address_personal_licence',
  'address_right_to_buy',
  'address_state_benefits',
  'address_student_loans',
  'address_taxi_drivers',
  'address_transport_pass',
  'address_waiting_list',
  // company-officer-screening (same capture; renamed from director-check).
  'company_officer_current',
  'company_officer_historic',
  // ccj-screening (same capture; renamed from ccj-check).
  'ccj',
  // credit-active (same capture; renamed from credit-check).
  'credit_lenders',
  // lexid-match (same capture; newly implemented).
  'lexid_match',
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
  // EPIC-7a/7b additions still unconfirmed (see lib/reportActions.ts's
  // derivation comment) — out of scope for the 2026-09-10 capture.
  'nfi_amberhill_match',
  'property_register_match',
  'insolvency_found',
  'address_insights_stable',
  'address_insights_score',
  'age_verified',
] as const;

export type ReportAttribute = (typeof REPORT_ATTRIBUTES)[number];

export function isReportAttribute(value: string): value is ReportAttribute {
  return (REPORT_ATTRIBUTES as readonly string[]).includes(value);
}
