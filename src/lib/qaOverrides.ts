import type { ActionSubject } from '../modules/reports/actions/types.js';

/**
 * Magic trigger values (documented in README.md) that force deterministic
 * pass/refer/fail scenarios on demand, layered on top of the normal
 * seeded-chance engine — lets QA force a scenario without hand-crafting a
 * subject that happens to hash into it.
 */
export function isSanctionedOverride(subject: ActionSubject): boolean {
  return subject.surname?.trim().toUpperCase() === 'SANCTIONED';
}

export function isDeathOverride(subject: ActionSubject): boolean {
  return subject.dob === '1900-01-01';
}
