import { describe, expect, it } from 'vitest';
import { addressVerification } from '../../src/modules/reports/actions/addressVerification.js';
import type { ActionContext } from '../../src/modules/reports/actions/types.js';
import { evaluateScorecard } from '../../src/scoring/engine.js';

const ER_SOURCE = /^ER\d{4}$/;

function run(seed: number, config?: { nfi_address?: boolean }) {
  const ctx: ActionContext = {
    subject: { address: { address1: '1 Test Street', postcode: 'TE1 1ST' } },
    requestBody: config ? { config } : {},
    seed,
    priorResults: {},
  };
  const attributes = addressVerification.build(ctx);
  const response = addressVerification.buildResponse!(ctx, attributes) as {
    sources: { source: string }[];
  };
  return { attributes, erSources: response.sources.filter((s) => ER_SOURCE.test(s.source)) };
}

const SEEDS = Array.from({ length: 400 }, (_, i) => i);

// MatchX's own scorecard rule, verbatim from MatchX/05-scorecards.md ("Role" included).
const MATCHX_SCORECARD = {
  id: 'matchx',
  passThreshold: null,
  failThreshold: null,
  groups: [
    {
      group_name: 'Electoral Role Address Verification',
      min_score: 0,
      rules: [{ attribute: 'address_verified', match_score: 10, no_match_score: 0 }],
    },
  ],
};

describe('address-verification: address_verified ⇔ Electoral Register sources', () => {
  it('is verified exactly when the response has at least one ER source, with or without NFI', () => {
    for (const config of [undefined, { nfi_address: true }]) {
      for (const seed of SEEDS) {
        const { attributes, erSources } = run(seed, config);
        expect(attributes.address_verified, `seed ${seed}`).toBe(erSources.length > 0);
      }
    }
  });

  it('covers both outcomes in the sample (guards against a vacuous pass)', () => {
    const verified = SEEDS.map((seed) => run(seed).attributes.address_verified);
    expect(verified).toContain(true);
    expect(verified).toContain(false);
  });

  it('keeps 3-8 ER sources for a verified subject', () => {
    for (const seed of SEEDS) {
      const { attributes, erSources } = run(seed);
      if (attributes.address_verified) {
        expect(erSources.length).toBeGreaterThanOrEqual(3);
        expect(erSources.length).toBeLessThanOrEqual(8);
      }
    }
  });

  it('scores 10 on MatchX’s address_verified rule when ER sources are present, 0 when absent', () => {
    for (const seed of SEEDS) {
      const { attributes, erSources } = run(seed);
      const { score } = evaluateScorecard(MATCHX_SCORECARD, attributes);
      expect(score, `seed ${seed}`).toBe(erSources.length > 0 ? 10 : 0);
    }
  });
});
