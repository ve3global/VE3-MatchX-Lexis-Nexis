import { chance, subSeed } from '../../../lib/determinism.js';
import { isSanctionedOverride } from '../../../lib/qaOverrides.js';
import { booleanAction, emptyBodySchema } from './helpers.js';
import type { ActionModule } from './types.js';

/**
 * Actions whose only doc evidence is a bare boolean toggle in
 * lib/errorCodes.ts (see lib/reportActions.ts's derivation comment) —
 * every bias below is this replica's own reasonable default, following
 * constitution.md's "normal subject cleanly passes" philosophy: adverse
 * findings (insolvency) default rare; neutral/positive lookups (nfi
 * matches, address insights) default common. `ccj-check`, `director-check`,
 * `credit-check`, and `nfi-address` moved out to their own doc-confirmed
 * modules (ccjScreening.ts, companyOfficerScreening.ts, creditActive.ts;
 * `nfi-address` was retired outright — see lib/reportActions.ts's
 * derivation comment); `age-verification` moved to ageVerification.ts.
 */
export const SIMPLE_ACTIONS: Record<string, ActionModule> = {
  'pep-screening': booleanAction('pep-screening', [{ key: 'pep', probability: 0.05 }]),
  'nfi-amberhill': booleanAction('nfi-amberhill', [
    { key: 'nfi_amberhill_match', probability: 0.9 },
  ]),
  'property-register-search': booleanAction('property-register-search', [
    { key: 'property_register_match', probability: 0.8 },
  ]),
  'insolvency-check': booleanAction('insolvency-check', [
    { key: 'insolvency_found', probability: 0.03 },
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
};
