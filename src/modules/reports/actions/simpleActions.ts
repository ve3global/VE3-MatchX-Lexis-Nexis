import { chance, subSeed } from '../../../lib/determinism.js';
import { isSanctionedOverride } from '../../../lib/qaOverrides.js';
import { booleanAction, emptyBodySchema } from './helpers.js';
import type { ActionModule } from './types.js';

/**
 * Eleven actions whose only doc evidence is a bare boolean toggle in
 * lib/errorCodes.ts (see lib/reportActions.ts's derivation comment) —
 * every bias below is this replica's own reasonable default, following
 * constitution.md's "normal subject cleanly passes" philosophy: adverse
 * findings (sanction, pep, ccj, insolvency, director match) default rare;
 * neutral/positive lookups (nfi matches, credit activity, address
 * insights) default common.
 */
export const SIMPLE_ACTIONS: Record<string, ActionModule> = {
  'pep-screening': booleanAction('pep-screening', [{ key: 'pep', probability: 0.05 }]),
  'nfi-amberhill': booleanAction('nfi-amberhill', [
    { key: 'nfi_amberhill_match', probability: 0.9 },
  ]),
  'nfi-address': booleanAction('nfi-address', [{ key: 'nfi_address_match', probability: 0.9 }]),
  'property-register-search': booleanAction('property-register-search', [
    { key: 'property_register_match', probability: 0.8 },
  ]),
  'ccj-check': booleanAction('ccj-check', [{ key: 'ccj_found', probability: 0.05 }]),
  'insolvency-check': booleanAction('insolvency-check', [
    { key: 'insolvency_found', probability: 0.03 },
  ]),
  'director-check': booleanAction('director-check', [{ key: 'director_match', probability: 0.1 }]),
  'credit-check': booleanAction('credit-check', [
    { key: 'credit_active', probability: 0.85 },
    { key: 'experian_match', probability: 0.9 },
    { key: 'equifax_match', probability: 0.9 },
  ]),
  'address-insights': {
    schema: emptyBodySchema,
    errorCodes: {},
    build(ctx) {
      const stableSeed = subSeed(ctx.seed, 'address-insights:stable');
      return {
        address_insights_stable: chance(stableSeed, 0.85),
        address_insights_score: Math.round(70 + (subSeed(ctx.seed, 'address-insights:score') % 30)),
      };
    },
  },

  /** QA override (see README): surname "SANCTIONED" forces sanction:true. */
  'sanction-screening': {
    schema: emptyBodySchema,
    errorCodes: {},
    build(ctx) {
      const sanction =
        isSanctionedOverride(ctx.subject) ||
        chance(subSeed(ctx.seed, 'sanction-screening:sanction'), 0.05);
      return { sanction };
    },
  },

  /**
   * age-verification (LN, evidenced by errorCodes.ts's `age` toggle,
   * code 1120) — unlike the pure-chance actions above, this one actually
   * derives its result from the subject's dob rather than a coin flip,
   * since "is this person's age plausible" is directly computable.
   */
  'age-verification': {
    schema: emptyBodySchema,
    errorCodes: {},
    build(ctx) {
      if (!ctx.subject.dob) {
        return { age_verified: chance(subSeed(ctx.seed, 'age-verification:fallback'), 0.9) };
      }
      const dob = new Date(ctx.subject.dob);
      const ageMs = Date.now() - dob.getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      return { age_verified: ageYears >= 18 && ageYears < 115 };
    },
  },
};
