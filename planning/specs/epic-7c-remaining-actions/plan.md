# EPIC-7c: Remaining report actions — Plan

## Modules

One file per action under `modules/reports/actions/`:
`bankAccountValidation.ts`, `bankAccountVerification.ts`,
`deathScreening.ts`, `drivingLicenceValidation.ts`, `emailRisk.ts`,
`niNumberValidation.ts`, `otpEmail.ts`, `otpEmailVerification.ts`,
`otpSms.ts`, `otpSmsVerification.ts`, `passportValidation.ts`,
`phoneMatch.ts`, `phoneNumberValidation.ts`, `remoteCheck.ts` (14 files;
`nfi-amberhill` lives in `simpleActions.ts` alongside EPIC-7a/7b's
thin-evidence actions, since it's the same "bare boolean toggle, no
further detail" shape).

## Cross-action state: `ActionContext.priorResults`

`otp-email-verification`/`otp-sms-verification` need to see the *other*
action's own prior result on the same report (the code it generated) —
`modules/reports/service.ts#runAction` builds `priorResults` from every
existing `ReportActionResult` row on the report before calling
`build()`. Missing prior send → `build()` throws `ApiError(422,
singleFieldError('code', 1294))` directly (reusing the same generic
mechanism EPIC-5/6 introduced for business-rule 422s) rather than
threading a special-case return value through the router.

## `lib/qaOverrides.ts`

`isDeathOverride(subject)` — `subject.dob === '1900-01-01'` exactly
(string comparison against the report's stored `YYYY-MM-DD` date, not a
`Date` object comparison, since that's the shape `ActionSubject.dob`
carries). Shared file with EPIC-7b's `isSanctionedOverride`.

## `modules/reports/service.ts#getInputData` extension

Iterates `report.actionResults`, branching on `actionName` to fold in
`bank_details` (masked), `ni_number` (masked), `emails`, `passport`,
`driving_licence_number`, or telephone/mobile/extension fields — additive
to EPIC-4's existing base-report fields, no changes to that endpoint's
signature.

## Verification

1. `bank-account-validation` with a malformed sort code/account number →
   422 with codes 1095/1098; a well-formed one → 200 with
   `bank_account_valid`.
2. `otp-email` → `otp_code` (6 digits); `otp-email-verification` with no
   prior send → 422/1294; with the wrong code → `otp_email_verified:
   false`; with the right code → `true`.
3. `email-risk` with a duplicate address in the `emails` array → 422/1109.
4. dob `"1900-01-01"` → `death-screening` always returns all three flags
   `true`.
5. `GET /reports/{id}/input-data` after running
   `bank-account-validation`/`ni-number-validation` → `account_number`
   masked to last 4, `ni_number` masked per the doc's rule.
6. `remote-check` → `remote_check_completed: true` immediately, no
   pending/async state.
