export interface DistributionEntry {
  status: number;
  weight: number;
}

/**
 * Picks one status from a run's distribution — an independent roll per call,
 * not a shared per-subject seed like determinism.ts's chance(), since a run
 * has no per-record identity to key off of. `rng` defaults to Math.random
 * but is injectable so tests can assert exact bucket selection without
 * statistical flakiness.
 *
 * Boundary convention: a roll lands in a bucket when it's strictly less than
 * that bucket's cumulative upper bound (inclusive lower bound, exclusive
 * upper bound). The last entry also catches a roll that reaches exactly 100
 * (rng() returning 1, or floating-point rounding), so the function always
 * returns a status even at the extreme edge.
 */
export function pickOutcome(
  distribution: DistributionEntry[],
  rng: () => number = Math.random,
): number {
  const roll = rng() * 100;
  let cumulative = 0;
  for (const entry of distribution) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      return entry.status;
    }
  }
  return distribution[distribution.length - 1].status;
}
