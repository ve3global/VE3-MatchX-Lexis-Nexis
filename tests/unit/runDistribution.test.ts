import { describe, expect, it } from 'vitest';
import { pickOutcome, type DistributionEntry } from '../../src/lib/runDistribution.js';

const FOUR_WAY: DistributionEntry[] = [
  { status: 500, weight: 20 },
  { status: 422, weight: 20 },
  { status: 429, weight: 10 },
  { status: 200, weight: 50 },
];

describe('pickOutcome', () => {
  it('selects the first entry for a roll near the very start of the range', () => {
    expect(pickOutcome(FOUR_WAY, () => 0)).toBe(500);
  });

  it('selects the last entry for a roll near the very end of the range', () => {
    expect(pickOutcome(FOUR_WAY, () => 0.999999)).toBe(200);
  });

  it('falls back to the last entry when the roll reaches exactly the top of the range', () => {
    // rng() = 1 -> roll = 100, which is not strictly less than the last
    // entry's own cumulative upper bound (100) — the post-loop fallback
    // is what makes this still resolve to the last entry.
    expect(pickOutcome(FOUR_WAY, () => 1)).toBe(200);
  });

  it('assigns a roll exactly on a cumulative-weight boundary to the next bucket (inclusive lower bound)', () => {
    // Cumulative weights: 500 -> 20, 422 -> 40, 429 -> 50, 200 -> 100.
    // A roll of exactly 20 must NOT select 500 (whose upper bound is 20);
    // it belongs to the next bucket, 422.
    expect(pickOutcome(FOUR_WAY, () => 0.2)).toBe(422);
    // Just under the boundary still selects the earlier bucket.
    expect(pickOutcome(FOUR_WAY, () => 0.1999)).toBe(500);
  });

  it('assigns a roll exactly on the second boundary to the third bucket', () => {
    expect(pickOutcome(FOUR_WAY, () => 0.4)).toBe(429);
    expect(pickOutcome(FOUR_WAY, () => 0.3999)).toBe(422);
  });

  it('always returns the same status for a single-entry, 100%-weighted distribution', () => {
    const single: DistributionEntry[] = [{ status: 500, weight: 100 }];
    expect(pickOutcome(single, () => 0)).toBe(500);
    expect(pickOutcome(single, () => 0.5)).toBe(500);
    expect(pickOutcome(single, () => 0.999999)).toBe(500);
    expect(pickOutcome(single, () => 1)).toBe(500);
  });

  it('defaults to Math.random when no rng is supplied', () => {
    const result = pickOutcome(FOUR_WAY);
    expect(FOUR_WAY.map((entry) => entry.status)).toContain(result);
  });
});
