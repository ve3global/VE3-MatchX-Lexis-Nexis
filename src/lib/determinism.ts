/**
 * Deterministic fake-data engine (see constitution.md's "Determinism
 * engine" section). Everything here traces back to `seedFrom`'s inputs —
 * no `Math.random`, no wall-clock, no external state — so the same subject
 * always produces the same result on any run, any machine.
 */

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalize(part: string): string {
  return part.toLowerCase().trim();
}

/** Stable hash of the given parts — same parts always hash to the same number. */
export function seedFrom(...parts: string[]): number {
  return fnv1a(parts.map(normalize).join('|'));
}

/** Derives an independent child seed for one attribute/purpose off a root seed. */
export function subSeed(seed: number, salt: string): number {
  return fnv1a(`${seed}:${normalize(salt)}`);
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded coin flip: true with the given probability (0-1). */
export function chance(seed: number, probability: number): boolean {
  return mulberry32(seed)() < probability;
}

/** Seeded deterministic choice from a non-empty list. */
export function pick<T>(seed: number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick() requires a non-empty list');
  }
  const index = Math.floor(mulberry32(seed)() * items.length);
  return items[Math.min(index, items.length - 1)];
}

/** Seeded deterministic integer in [min, max] inclusive. */
export function int(seed: number, min: number, max: number): number {
  return min + Math.floor(mulberry32(seed)() * (max - min + 1));
}
