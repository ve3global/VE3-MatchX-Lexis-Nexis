import { describe, expect, it } from 'vitest';
import { parseRateLimit, parseThrottleMode } from '../../src/lib/rateLimitConfig.js';

const silent = () => {};

describe('parseRateLimit', () => {
  it('falls back to 10 when RATE_LIMIT_PER_SECOND is unset', () => {
    expect(parseRateLimit(undefined, silent)).toBe(10);
  });

  it('falls back to 10 silently when RATE_LIMIT_PER_SECOND is empty or whitespace', () => {
    const warnings: string[] = [];
    expect(parseRateLimit('', (m) => warnings.push(m))).toBe(10);
    expect(parseRateLimit('   ', (m) => warnings.push(m))).toBe(10);
    expect(warnings).toHaveLength(0);
  });

  it('uses a valid positive integer as the limit', () => {
    expect(parseRateLimit('50', silent)).toBe(50);
    expect(parseRateLimit(' 50 ', silent)).toBe(50);
  });

  it.each(['0', '-1', 'abc', '2.5', '1e1', '0x10'])(
    'falls back to 10 and warns for invalid value %j',
    (raw) => {
      const warnings: string[] = [];
      expect(parseRateLimit(raw, (m) => warnings.push(m))).toBe(10);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain(raw);
    },
  );
});

describe('parseThrottleMode', () => {
  it('falls back to limiter when THROTTLE_MODE is unset or empty', () => {
    expect(parseThrottleMode(undefined, silent)).toBe('limiter');
    expect(parseThrottleMode('', silent)).toBe('limiter');
  });

  it.each([
    ['limiter', 'limiter'],
    ['run', 'run'],
    ['RUN', 'run'],
    ['  Limiter ', 'limiter'],
  ])('accepts %j as %s', (raw, expected) => {
    const warnings: string[] = [];
    expect(parseThrottleMode(raw, (m) => warnings.push(m))).toBe(expected);
    expect(warnings).toHaveLength(0);
  });

  it.each(['off', 'bypass', 'xyz'])(
    'falls back to limiter and warns for invalid value %j',
    (raw) => {
      const warnings: string[] = [];
      expect(parseThrottleMode(raw, (m) => warnings.push(m))).toBe('limiter');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain(raw);
    },
  );
});
