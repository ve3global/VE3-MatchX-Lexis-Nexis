import { z } from 'zod';
import { chance, int, namespacedSeed } from '../../../lib/determinism.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

/**
 * Doc-confirmed shape (2026-09-10 capture): `{matched, active_appointment_count,
 * resigned_appointment_count, inactive_appointment_count}`, scoring
 * attributes `company_officer_current`/`company_officer_historic` —
 * renamed from the guessed `director-check`/`director_match` pair.
 */
function build(ctx: ActionContext): Record<string, unknown> {
  const s = namespacedSeed(ctx.seed, 'company-officer-screening');
  return {
    company_officer_current: chance(s('current'), 0.1),
    company_officer_historic: chance(s('historic'), 0.15),
  };
}

function buildResponse(ctx: ActionContext, attributes: Record<string, unknown>) {
  const s = namespacedSeed(ctx.seed, 'company-officer-screening');
  const activeCount = attributes.company_officer_current ? int(s('active_count'), 1, 3) : 0;
  const resignedCount = attributes.company_officer_historic ? int(s('resigned_count'), 1, 3) : 0;
  const inactiveCount = attributes.company_officer_historic ? int(s('inactive_count'), 0, 2) : 0;
  return {
    matched: activeCount > 0 || resignedCount > 0 || inactiveCount > 0,
    active_appointment_count: activeCount,
    resigned_appointment_count: resignedCount,
    inactive_appointment_count: inactiveCount,
  };
}

export const companyOfficerScreening: ActionModule = {
  schema,
  errorCodes: {},
  build,
  buildResponse,
};
