import { z } from 'zod';
import { chance, int, namespacedSeed } from '../../../lib/determinism.js';
import type { FieldErrorCodeMap } from '../../../lib/validation.js';
import type { ActionContext, ActionModule } from './types.js';

/**
 * Doc-confirmed request shape (2026-09-10 sandbox capture,
 * `planning/api-drift-remediation.md`) — a nested `config` object, not the
 * old flat `full_er` guess. `config.full_er`/`config.nfi_address` (codes
 * 1160/1257) were previously wired to `PATCH /users/options`'s own
 * `config` sub-object instead; the capture is the only real evidence
 * either code's meaning was ever confirmed against, so they move here.
 */
const schema = z.object({
  config: z
    .object({
      full_er: z.boolean().optional(),
      nfi_address: z.boolean().optional(),
    })
    .optional(),
});

const errorCodes: FieldErrorCodeMap = {
  'config.full_er': { string: 1160 },
  'config.nfi_address': { string: 1257 },
};

const ER_START_YEAR = new Date().getFullYear();

function electoralRollSources(seed: number, fromYear: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const year = fromYear - i;
    return {
      source: `ER${year}`,
      description: `${year} UK Open Electoral Register`,
      recency: `${year - 1}-10-15`,
    };
  });
}

/** Shared by `build`/`buildResponse` so the request-body cast isn't repeated. */
function getConfig(ctx: ActionContext): { full_er?: boolean; nfi_address?: boolean } {
  return (ctx.requestBody.config ?? {}) as { full_er?: boolean; nfi_address?: boolean };
}

/**
 * All 16 `nfi_address`-gated attributes double as an NFI data source
 * (`address_nfi_sources` itself is just their match count, not a source).
 * A 2026-09-17 pension-source capture (MatchX/07-reports-pension-source.md)
 * showed `address_personal_licence`/`address_right_to_buy` sources too —
 * previously only the 3 nfi_address's own doc example happened to have
 * matched (pensions/payroll/transport_pass) were wired up.
 */
const NFI_SOURCES = [
  { key: 'address_council_tax', source: 'NFI_COUNCIL_TAX', description: 'NFI - Council tax' },
  {
    key: 'address_council_tax_reduction_scheme',
    source: 'NFI_COUNCIL_TAX_REDUCTION_SCHEME',
    description: 'NFI - Council tax reduction scheme',
  },
  {
    key: 'address_deferred_pensions',
    source: 'NFI_DEFERRED_PENSIONS',
    description: 'NFI - Deferred pensions',
  },
  {
    key: 'address_housing_benefits',
    source: 'NFI_HOUSING_BENEFITS',
    description: 'NFI - Housing benefits',
  },
  {
    key: 'address_housing_tenants',
    source: 'NFI_HOUSING_TENANTS',
    description: 'NFI - Housing tenants',
  },
  { key: 'address_payroll', source: 'NFI_PAYROLL', description: 'NFI - Payroll' },
  { key: 'address_pensions', source: 'NFI_PENSIONS', description: 'NFI - Pensions' },
  {
    key: 'address_pensions_gratuities',
    source: 'NFI_PENSIONS_GRATUITIES',
    description: 'NFI - Pensions gratuities',
  },
  {
    key: 'address_personal_licence',
    source: 'NFI_PERSONAL_LICENCE',
    description: 'NFI - Personal licence',
  },
  { key: 'address_right_to_buy', source: 'NFI_RIGHT_TO_BUY', description: 'NFI - Right to buy' },
  {
    key: 'address_state_benefits',
    source: 'NFI_STATE_BENEFITS',
    description: 'NFI - State benefits',
  },
  {
    key: 'address_student_loans',
    source: 'NFI_STUDENT_LOANS',
    description: 'NFI - Student loans',
  },
  { key: 'address_taxi_drivers', source: 'NFI_TAXI_DRIVERS', description: 'NFI - Taxi drivers' },
  {
    key: 'address_transport_pass',
    source: 'NFI_TRANSPORT_PASS',
    description: 'NFI - Transport pass',
  },
  { key: 'address_waiting_list', source: 'NFI_WAITING_LIST', description: 'NFI - Waiting list' },
];

/**
 * Doc-confirmed base attribute set (~9 names) plus the `config.nfi_address`
 * -gated extension (~17 more) — a live sandbox capture (2026-09-10) that
 * supersedes the previous "representative subset, count only" guess.
 */
function buildAttributes(ctx: ActionContext, nfiAddress: boolean): Record<string, unknown> {
  const s = namespacedSeed(ctx.seed, 'address-verification');
  const attributes: Record<string, unknown> = {
    address_verified: chance(s('verified'), 0.95),
    address_current_er: chance(s('current_er'), 0.5),
    address_gone_away_high: chance(s('gone_away_high'), 0.08),
    address_gone_away_very_high: chance(s('gone_away_very_high'), 0.05),
    address_historic_er: chance(s('historic_er'), 0.6),
    address_companies_house: chance(s('companies_house'), 0.1),
    address_insolvency_service: chance(s('insolvency_service'), 0.05),
    address_registry_trust: chance(s('registry_trust'), 0.05),
    address_telephone_directory: chance(s('telephone_directory'), 0.15),
    address_tracesmart_register: chance(s('tracesmart_register'), 0.15),
  };

  if (nfiAddress) {
    Object.assign(attributes, {
      address_council_tax: chance(s('council_tax'), 0.3),
      address_council_tax_reduction_scheme: chance(s('council_tax_reduction_scheme'), 0.1),
      address_deferred_pensions: chance(s('deferred_pensions'), 0.1),
      address_housing_benefits: chance(s('housing_benefits'), 0.1),
      address_housing_tenants: chance(s('housing_tenants'), 0.1),
      address_nfi_sources: int(s('nfi_sources'), 0, 5),
      address_payroll: chance(s('payroll'), 0.3),
      address_pensions: chance(s('pensions'), 0.3),
      address_pensions_gratuities: chance(s('pensions_gratuities'), 0.05),
      address_personal_budgets: chance(s('personal_budgets'), 0.05),
      address_personal_licence: chance(s('personal_licence'), 0.05),
      address_right_to_buy: chance(s('right_to_buy'), 0.05),
      address_state_benefits: chance(s('state_benefits'), 0.1),
      address_student_loans: chance(s('student_loans'), 0.1),
      address_taxi_drivers: chance(s('taxi_drivers'), 0.05),
      address_transport_pass: chance(s('transport_pass'), 0.3),
      address_waiting_list: chance(s('waiting_list'), 0.05),
    });
  }

  return attributes;
}

function build(ctx: ActionContext): Record<string, unknown> {
  return buildAttributes(ctx, Boolean(getConfig(ctx).nfi_address));
}

/**
 * The rich response block the capture shows — distinct from the flat
 * scoring `attributes` above (e.g. `verified` here vs. `address_verified`
 * there). The verified address is the subject's own submitted address,
 * reformatted the way a real electoral-roll match comes back (uppercase,
 * no county line) — designed, not transcribed, since the doc never shows
 * the addressing logic itself, only sample output.
 */
function buildResponse(ctx: ActionContext, attributes: Record<string, unknown>) {
  const s = namespacedSeed(ctx.seed, 'address-verification');
  const nfiAddress = Boolean(getConfig(ctx).nfi_address);
  const verified = Boolean(attributes.address_verified);
  const goneAway = Boolean(
    attributes.address_gone_away_high || attributes.address_gone_away_very_high,
  );
  const firstSeen = ER_START_YEAR - int(s('first_seen_offset'), 5, 20);
  const lastSeen = firstSeen + int(s('last_seen_offset'), 0, ER_START_YEAR - firstSeen);
  const erCount = int(s('er_count'), 3, 8);
  const address = ctx.subject.address ?? {};

  const sources = electoralRollSources(s('er_years'), lastSeen, erCount);
  if (nfiAddress) {
    for (const nfi of NFI_SOURCES) {
      if (attributes[nfi.key]) {
        sources.push({ source: nfi.source, description: nfi.description, recency: '2020-09-14' });
      }
    }
  }
  // Both captures (2026-09-08's MatchX/06, 2026-09-17's MatchX/07) show NFI
  // entries interleaved among the electoral-roll ones by `recency` date, not
  // appended after them — a single descending sort reproduces both.
  sources.sort((a, b) => (a.recency < b.recency ? 1 : a.recency > b.recency ? -1 : 0));

  return {
    verified,
    address_found: verified || chance(s('address_found_fallback'), 0.3),
    gone_away: goneAway,
    date_first_seen: firstSeen,
    date_last_seen: lastSeen,
    address: {
      id: int(s('address_id'), 10_000_000, 99_999_999),
      address1: (address.address1 ?? '').toUpperCase(),
      address2: '',
      address3: '',
      address4: '',
      address5: '',
      postcode: address.postcode ?? '',
    },
    telephones: [],
    sources,
  };
}

export const addressVerification: ActionModule = { schema, errorCodes, build, buildResponse };
