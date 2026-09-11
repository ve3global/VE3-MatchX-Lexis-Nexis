import { describe, expect, it } from 'vitest';
import { evaluateScorecard, type ScorecardInput } from '../../src/scoring/engine.js';

const AML_SCORECARD: ScorecardInput = {
  id: 'aml-scorecard',
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
  it('sums each group score from its rules, keyed by scorecard_id', () => {
    const assessment = evaluateScorecard(AML_SCORECARD, {
      address_verified: true,
      dob_count: 1,
      sanction: false,
      pep: false,
    });

    expect(assessment.scorecard_id).toBe('aml-scorecard');
    expect(assessment.score_breakdown).toEqual([
      {
        group: 'identity',
        group_score: 60,
        rules: [
          { attribute: 'address_verified', matched: true, score: 30 },
          { attribute: 'dob_count', matched: true, score: 30 },
        ],
      },
      {
        group: 'screening',
        group_score: 40,
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
      id: 'refer-scorecard',
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
    expect(assessment.score_breakdown[0].rules[0]).toEqual({
      attribute: 'address_verified',
      matched: false,
      score: -30,
    });
  });

  it('never triggers a null threshold branch', () => {
    const assessment = evaluateScorecard(
      { id: 'empty-scorecard', passThreshold: null, failThreshold: null, groups: [] },
      {},
    );
    expect(assessment.score).toBe(0);
    expect(assessment.result).toBe('REFER');
  });

  it('emits a reasons entry for every matched, nonzero-score rule, in group/rule order', () => {
    const assessment = evaluateScorecard(AML_SCORECARD, {
      address_verified: true,
      dob_count: 1,
      sanction: true,
      pep: false,
    });
    expect(assessment.reasons).toEqual([
      { label: 'Address verified', indicator: 'POSITIVE' },
      { label: 'Dob count', indicator: 'POSITIVE' },
      { label: expect.any(String), indicator: 'NEGATIVE' },
    ]);
  });

  it('omits a matched rule worth zero points from reasons', () => {
    const scorecard: ScorecardInput = {
      id: 'zero-score-scorecard',
      passThreshold: null,
      failThreshold: null,
      groups: [
        {
          group_name: 'bonus',
          min_score: 0,
          rules: [{ attribute: 'ccj', match_score: 0, no_match_score: 0 }],
        },
      ],
    };
    const assessment = evaluateScorecard(scorecard, { ccj: true });
    expect(assessment.reasons).toEqual([]);
  });

  it('uses the doc-confirmed label for a known attribute and a humanized fallback for an unknown one', () => {
    const scorecard: ScorecardInput = {
      id: 'label-scorecard',
      passThreshold: null,
      failThreshold: null,
      groups: [
        {
          group_name: 'g',
          min_score: 0,
          rules: [
            { attribute: 'lexid_match', match_score: 5, no_match_score: 0 },
            { attribute: 'phone_match', match_score: 5, no_match_score: 0 },
          ],
        },
      ],
    };
    const assessment = evaluateScorecard(scorecard, { lexid_match: true, phone_match: true });
    expect(assessment.reasons).toEqual([
      { label: 'LexID has been validated against input data', indicator: 'POSITIVE' },
      { label: 'Phone match', indicator: 'POSITIVE' },
    ]);
  });
});
