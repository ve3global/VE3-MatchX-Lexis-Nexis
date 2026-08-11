import { addressVerification } from './addressVerification.js';
import { bankAccountValidation } from './bankAccountValidation.js';
import { bankAccountVerification } from './bankAccountVerification.js';
import { deathScreening } from './deathScreening.js';
import { dobVerification } from './dobVerification.js';
import { drivingLicenceValidation } from './drivingLicenceValidation.js';
import { emailRisk } from './emailRisk.js';
import { niNumberValidation } from './niNumberValidation.js';
import { otpEmail } from './otpEmail.js';
import { otpEmailVerification } from './otpEmailVerification.js';
import { otpSms } from './otpSms.js';
import { otpSmsVerification } from './otpSmsVerification.js';
import { passportValidation } from './passportValidation.js';
import { phoneMatch } from './phoneMatch.js';
import { phoneNumberValidation } from './phoneNumberValidation.js';
import { SIMPLE_ACTIONS } from './simpleActions.js';
import type { ActionModule } from './types.js';

/**
 * One module per name in lib/reportActions.ts's `REPORT_ACTIONS`, except
 * `remote-check` — EPIC-12 (phase 2) revised it to a genuinely stateful
 * lifecycle (see planning/specs/epic-12-remote-check-lifecycle/spec.md),
 * handled by `modules/reports/service.ts#runAction`'s own special case
 * rather than a registry module. It's still a valid action *name* in
 * `lib/reportActions.ts` — just not auto-runnable via this registry.
 */
export const ACTION_REGISTRY: Partial<Record<string, ActionModule>> = {
  'address-verification': addressVerification,
  'dob-verification': dobVerification,
  'death-screening': deathScreening,
  'bank-account-validation': bankAccountValidation,
  'bank-account-verification': bankAccountVerification,
  'driving-licence-validation': drivingLicenceValidation,
  'ni-number-validation': niNumberValidation,
  'passport-validation': passportValidation,
  'email-risk': emailRisk,
  'phone-match': phoneMatch,
  'phone-number-validation': phoneNumberValidation,
  'otp-email': otpEmail,
  'otp-email-verification': otpEmailVerification,
  'otp-sms': otpSms,
  'otp-sms-verification': otpSmsVerification,
  ...SIMPLE_ACTIONS,
};
