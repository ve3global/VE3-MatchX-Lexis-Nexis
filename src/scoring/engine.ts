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
  group_name: string;
  score: number;
  min_score: number;
  passed: boolean;
  rules: RuleAssessment[];
}

export interface Assessment {
  score: number;
  result: 'PASS' | 'REFER' | 'FAIL';
  groups: GroupAssessment[];
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
  return {
    group_name: group.group_name,
    score,
    min_score: group.min_score,
    passed: score >= group.min_score,
    rules,
  };
}

/** Evaluates a report's accumulated attribute values against a scorecard's groups/rules — see constitution.md's scoring section. */
export function evaluateScorecard(
  scorecard: ScorecardInput,
  attributes: Record<string, unknown>,
): Assessment {
  const groups = scorecard.groups.map((group) => evaluateGroup(group, attributes));
  const score = groups.reduce((sum, group) => sum + group.score, 0);

  let result: Assessment['result'];
  if (scorecard.failThreshold !== null && score <= scorecard.failThreshold) {
    result = 'FAIL';
  } else if (scorecard.passThreshold !== null && score >= scorecard.passThreshold) {
    result = 'PASS';
  } else {
    result = 'REFER';
  }

  return { score, result, groups };
}
