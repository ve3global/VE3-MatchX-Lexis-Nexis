import type { RouteInfo } from './collectRoutes.js';

/**
 * Every replica-only extension route (see README.md's "Known replica-
 * only extensions" and each owning epic's spec.md under "Resolved
 * conflicts"). EPIC-8's doc-parity check cross-references this list
 * against the live route surface both ways: every entry here must be a
 * real route (catches a stale allowlist), and — manually, since this
 * replica has no machine-readable copy of the real doc to diff against —
 * every route NOT here is assumed doc-compliant, verified by a one-time
 * human cross-check against IDU_REST_API_Documentation.pdf (constitution.md).
 */
export const EXTENSION_ROUTES: RouteInfo[] = [
  { method: 'POST', path: '/oauth/token/revoke' }, // EPIC-2, LN9
  { method: 'GET', path: '/addresses' }, // EPIC-3, LN10
  { method: 'GET', path: '/addresses/search' }, // EPIC-3, LN11
  { method: 'GET', path: '/addresses/:reference' }, // EPIC-3, LN12
  { method: 'POST', path: '/report-types/:id/reactivate' }, // EPIC-5, LN24
  { method: 'POST', path: '/scorecards/:id/publish' }, // EPIC-6, LN29
  { method: 'POST', path: '/scorecards/:id/retire' }, // EPIC-6, LN29
  // EPIC-11 (phase 2): no dedicated error-code evidence for a company
  // resource at all — only `company_id` as a foreign-key-shaped field
  // elsewhere (see epic-11-users-module/spec.md). Unlike self/options/
  // activity-logs (real field clusters, just assembled into one
  // resource), this one's fields are this replica's own invention.
  { method: 'GET', path: '/users/company' },
  { method: 'PATCH', path: '/users/company' },
];
