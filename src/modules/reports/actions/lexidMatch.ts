import { z } from 'zod';
import { chance, int, namespacedSeed } from '../../../lib/determinism.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

/**
 * Previously unimplemented (`planning/api-drift-remediation.md`'s EPIC-7a
 * item). Shape confirmed by the 2026-09-10 capture: `{matched, forename,
 * middlename, surname, dob, uklexid, forename_match, middlename_match,
 * surname_match, dob_match}`, scoring attribute `lexid_match`. Echoes the
 * subject's own submitted identity fields back as the "matched" LexID
 * record when matched — this replica has no separate identity-database
 * concept to diverge from it.
 */
function build(ctx: ActionContext): Record<string, unknown> {
  const s = namespacedSeed(ctx.seed, 'lexid-match');
  return { lexid_match: chance(s('matched'), 0.85) };
}

function buildResponse(ctx: ActionContext, attributes: Record<string, unknown>) {
  const matched = Boolean(attributes.lexid_match);
  const s = namespacedSeed(ctx.seed, 'lexid-match');
  return {
    matched,
    forename: ctx.subject.forename ?? null,
    middlename: ctx.subject.middlename ?? null,
    surname: ctx.subject.surname ?? null,
    dob: ctx.subject.dob ?? null,
    uklexid: matched ? int(s('uklexid'), 1_000_000_000, 9_999_999_999) : null,
    forename_match: matched,
    middlename_match: matched && Boolean(ctx.subject.middlename) && chance(s('middlename'), 0.5),
    surname_match: matched,
    dob_match: matched && chance(s('dob'), 0.7),
  };
}

export const lexidMatch: ActionModule = { schema, errorCodes: {}, build, buildResponse };
