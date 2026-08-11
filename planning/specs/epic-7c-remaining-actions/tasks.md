# EPIC-7c: Remaining report actions — Tasks

- [x] `lib/qaOverrides.ts` — `isDeathOverride()`
- [x] `deathScreening.ts` (bespoke, QA override, exact 3 attributes)
- [x] `bankAccountValidation.ts` / `bankAccountVerification.ts`
- [x] `drivingLicenceValidation.ts`
- [x] `niNumberValidation.ts`
- [x] `passportValidation.ts`
- [x] `emailRisk.ts`
- [x] `phoneMatch.ts` / `phoneNumberValidation.ts`
- [x] `otpEmail.ts` / `otpEmailVerification.ts` / `otpSms.ts` /
      `otpSmsVerification.ts` (incl. `priorResults` cross-action lookup +
      1294 error)
- [x] `remoteCheck.ts`
- [x] `nfi-amberhill` in `simpleActions.ts`
- [x] Register all 15 in `ACTION_REGISTRY`
- [x] Extend `modules/reports/service.ts#getInputData` with bank/NI
      masking + email/phone/passport/driving-licence echo
- [x] Expand `lib/reportAttributes.ts` with this epic's output attributes
- [x] Integration test: bank-account-validation format validation + happy
      path
- [x] Integration test: full otp-email send/verify flow incl. 1294 on no
      prior send
- [x] Integration test: input-data masking for bank account + NI number
- [x] Integration test: death-screening QA override
- [x] Integration test: registry completeness (shared across EPIC-7)
