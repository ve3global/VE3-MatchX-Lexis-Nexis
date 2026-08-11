import { describe, expect, it } from 'vitest';
import { evaluateScorecard, type ScorecardInput } from '../../src/scoring/engine.js';

const AML_SCORECARD: ScorecardInput = {
  passThreshold: 80,
  failThreshold: 40,
  groups: [
    {
      group_name: 'identity',
      min_score: 50,
      rules: [
        { attribute: 'address_verified', match_score: 30, no_match_score: -30 },
        { attribute: 'dob_count', match_score: 30, no_match_score: -30 },
      ],
    },
    {
      group_name: 'screening',
      min_score: 50,
      rules: [
        { attribute: 'sanction', match_score: -100, no_match_score: 20 },
        { attribute: 'pep', match_score: -50, no_match_score: 20 },
      ],
    },
  ],
};

describe('evaluateScorecard', () => {
  it('sums each group score from its rules and flags passed via min_score', () => {
    const assessment = evaluateScorecard(AML_SCORECARD, {
      address_verified: true,
      dob_count: 1,
      sanction: false,
      pep: false,
    });

    expect(assessment.groups).toEqual([
      {
        group_name: 'identity',
        score: 60,
        min_score: 50,
        passed: true,
        rules: [
          { attribute: 'address_verified', matched: true, score: 30 },
          { attribute: 'dob_count', matched: true, score: 30 },
        ],
      },
      {
        group_name: 'screening',
        score: 40,
        min_score: 50,
        passed: false,
        rules: [
          { attribute: 'sanction', matched: false, score: 20 },
          { attribute: 'pep', matched: false, score: 20 },
        ],
      },
    ]);
  });

  it('returns PASS when the total score meets pass_threshold', () => {
    const assessment = evaluateScorecard(AML_SCORECARD, {
      address_verified: true,
      dob_count: 1,
      sanction: false,
      pep: false,
    });
    expect(assessment.score).toBe(100);
    expect(assessment.result).toBe('PASS');
  });

  it('returns FAIL when the total score is at or below fail_threshold, even if pass_threshold would otherwise be met', () => {
    const assessment = evaluateScorecard(AML_SCORECARD, {
      address_verified: false,
      dob_count: 0,
      sanction: true,
      pep: true,
    });
    expect(assessment.score).toBe(-210);
    expect(assessment.result).toBe('FAIL');
  });

  it('returns REFER when the score is between the thresholds', () => {
    const scorecard: ScorecardInput = {
      passThreshold: 80,
      failThreshold: 40,
      groups: [
        {
          group_name: 'identity',
          min_score: 0,
          rules: [{ attribute: 'address_verified', match_score: 60, no_match_score: 0 }],
        },
      ],
    };
    const assessment = evaluateScorecard(scorecard, { address_verified: true });
    expect(assessment.score).toBe(60);
    expect(assessment.result).toBe('REFER');
  });

  it('treats a missing attribute as not-matched rather than throwing', () => {
    const assessment = evaluateScorecard(AML_SCORECARD, {});
    expect(assessment.groups[0].rules[0]).toEqual({
      attribute: 'address_verified',
      matched: false,
      score: -30,
    });
  });

  it('never triggers a null threshold branch', () => {
    const assessment = evaluateScorecard(
      { passThreshold: null, failThreshold: null, groups: [] },
      {},
    );
    expect(assessment.score).toBe(0);
    expect(assessment.result).toBe('REFER');
  });
});
