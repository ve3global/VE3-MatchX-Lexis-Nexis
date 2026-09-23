export interface ScoreRule {
  attribute: string;
  match_score: number;
  no_match_score: number;
}

export interface ScoreGroup {
  group_name: string;
  min_score: number;
  rules: ScoreRule[];
}

export interface ScorecardInput {
  id: string;
  passThreshold: number | null;
  failThreshold: number | null;
  groups: ScoreGroup[];
}

export interface RuleAssessment {
  attribute: string;
  matched: boolean;
  score: number;
}

export interface GroupAssessment {
  group: string;
  group_score: number;
  rules: RuleAssessment[];
}

export interface Reason {
  label: string;
  indicator: 'POSITIVE' | 'NEGATIVE';
}

export interface Assessment {
  scorecard_id: string;
  score: number;
  result: 'PASS' | 'REFER' | 'FAIL';
  reasons: Reason[];
  score_breakdown: GroupAssessment[];
}

/**
 * Human-readable `reasons` labels — doc-confirmed for exactly 4
 * (`address_verified`/`address_current_er`/`address_historic_er`/
 * `lexid_match`, from the 2026-09-08 pension-source capture,
 * `planning/api-drift-remediation.md`). The rest come from the doc's own
 * worked scorecard example (`MatchX/05-scorecards.md`) ruling on them, so a
 * matched rule still needs *some* label — designed, not transcribed, same
 * precedent as address-verification's own nfi_address extension fields.
 * Anything outside this set (a scorecard can rule on any confirmed report
 * attribute) falls back to a humanized attribute name.
 */
const REASON_LABELS: Partial<Record<string, string>> = {
  address_verified: 'Address verified',
  address_current_er: 'On the current electoral register',
  address_historic_er: 'On previous electoral registers',
  lexid_match: 'LexID has been validated against input data',
  credit_lenders: 'Credit lenders found',
  address_gone_away_high: 'High probability the subject has gone away',
  address_gone_away_very_high: 'Very high probability the subject has gone away',
  company_officer_current: 'Currently an active company officer',
  company_officer_historic: 'Previously a company officer',
  address_tracesmart_register: 'Found on the Tracesmart register',
  address_companies_house: 'Found on Companies House records',
  address_insolvency_service: 'Found on Insolvency Service records',
  address_telephone_directory: 'Found in the telephone directory',
  address_registry_trust: 'Found on the Registry Trust register',
  ccj: 'County court judgment found',
  // "NFI address <name> source found" — doc-confirmed for exactly
  // personal_licence/right_to_buy (2026-09-17 pension-source capture,
  // MatchX/07-reports-pension-source.md); the rest of the nfi_address-gated
  // attributes follow the same pattern (same "still needs *some* label"
  // precedent this file's own header comment describes).
  address_council_tax: 'NFI address council tax source found',
  address_council_tax_reduction_scheme: 'NFI address council tax reduction scheme source found',
  address_deferred_pensions: 'NFI address deferred pensions source found',
  address_housing_benefits: 'NFI address housing benefits source found',
  address_housing_tenants: 'NFI address housing tenants source found',
  address_payroll: 'NFI address payroll source found',
  address_pensions: 'NFI address pensions source found',
  address_pensions_gratuities: 'NFI address pensions gratuities source found',
  address_personal_licence: 'NFI address personal licence source found',
  address_right_to_buy: 'NFI address right to buy source found',
  address_state_benefits: 'NFI address state benefits source found',
  address_student_loans: 'NFI address student loans source found',
  address_taxi_drivers: 'NFI address taxi drivers source found',
  address_transport_pass: 'NFI address transport pass source found',
  address_waiting_list: 'NFI address waiting list source found',
};

function labelFor(attribute: string): string {
  return (
    REASON_LABELS[attribute] ?? attribute.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  );
}

/**
 * A rule "matches" when its attribute's accumulated value is truthy (a
 * boolean `true`, or a non-zero count) — `sanction: true` matches the
 * `sanction` rule just as `dob_count: 3` matches the `dob_count` rule. A
 * missing attribute (not yet run/collected) is treated as not-matched,
 * not as an error — scoring only ever reflects what's been collected so
 * far (see constitution.md: recomputed on every action run).
 */
function evaluateRule(rule: ScoreRule, attributes: Record<string, unknown>): RuleAssessment {
  const matched = Boolean(attributes[rule.attribute]);
  return {
    attribute: rule.attribute,
    matched,
    score: matched ? rule.match_score : rule.no_match_score,
  };
}

function evaluateGroup(group: ScoreGroup, attributes: Record<string, unknown>): GroupAssessment {
  const rules = group.rules.map((rule) => evaluateRule(rule, attributes));
  const score = rules.reduce((sum, rule) => sum + rule.score, 0);
  return { group: group.group_name, group_score: score, rules };
}

/**
 * `reasons` surfaces every matched rule that actually moved the score —
 * doc-confirmed shape from the 2026-09-08 pension-source capture (see
 * `labelFor`'s comment). A matched rule worth 0 points carries no signal,
 * so it's excluded rather than emitted as a reason either way.
 */
function buildReasons(groups: GroupAssessment[]): Reason[] {
  const reasons: Reason[] = [];
  for (const group of groups) {
    for (const rule of group.rules) {
      if (rule.matched && rule.score !== 0) {
        reasons.push({
          label: labelFor(rule.attribute),
          indicator: rule.score > 0 ? 'POSITIVE' : 'NEGATIVE',
        });
      }
    }
  }
  return reasons;
}

/** Evaluates a report's accumulated attribute values against a scorecard's groups/rules — see constitution.md's scoring section. */
export function evaluateScorecard(
  scorecard: ScorecardInput,
  attributes: Record<string, unknown>,
): Assessment {
  const groups = scorecard.groups.map((group) => evaluateGroup(group, attributes));
  const score = groups.reduce((sum, group) => sum + group.group_score, 0);

  let result: Assessment['result'];
  if (scorecard.failThreshold !== null && score <= scorecard.failThreshold) {
    result = 'FAIL';
  } else if (scorecard.passThreshold !== null && score >= scorecard.passThreshold) {
    result = 'PASS';
  } else {
    result = 'REFER';
  }

  return {
    scorecard_id: scorecard.id,
    score,
    result,
    reasons: buildReasons(groups),
    score_breakdown: groups,
  };
}
