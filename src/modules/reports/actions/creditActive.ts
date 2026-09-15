import { z } from 'zod';
import { chance, int, namespacedSeed } from '../../../lib/determinism.js';
import type { ActionContext, ActionModule } from './types.js';

const schema = z.object({});

const LENDER_CATEGORIES = [
  'credit_card',
  'current_account',
  'hp_or_lease',
  'mail_order',
  'other',
  'secured_loan',
  'storecard',
  'unsecured_loan',
  'utilities',
] as const;

/**
 * Doc-confirmed shape (2026-09-10 capture): `{matched, sources: [{source,
 * recency, accounts, lenders, lender_categories}]}`, scoring attribute
 * `credit_lenders` (a lender count, not a boolean) — renamed from the
 * guessed `credit-check`/`credit_active` pair.
 */
function build(ctx: ActionContext): Record<string, unknown> {
  const s = namespacedSeed(ctx.seed, 'credit-active');
  const matched = chance(s('matched'), 0.7);
  return { credit_lenders: matched ? int(s('lenders'), 1, 8) : 0 };
}

function buildResponse(ctx: ActionContext, attributes: Record<string, unknown>) {
  const s = namespacedSeed(ctx.seed, 'credit-active');
  const lenders = Number(attributes.credit_lenders ?? 0);
  if (lenders === 0) {
    return { matched: false, sources: [] };
  }

  const categories = Object.fromEntries(
    LENDER_CATEGORIES.map((category) => [category, chance(s(`category:${category}`), 0.3)]),
  );
  return {
    matched: true,
    sources: [
      {
        source: 'Experian',
        recency: new Date().toISOString().slice(0, 10),
        accounts: lenders + int(s('extra_accounts'), 0, 3),
        lenders,
        lender_categories: categories,
      },
    ],
  };
}

export const creditActive: ActionModule = { schema, errorCodes: {}, build, buildResponse };
