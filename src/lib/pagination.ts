import { z } from 'zod';
import type { FieldErrorCodeMap } from './validation.js';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(15),
});

export const PAGINATION_ERROR_CODES: FieldErrorCodeMap = {
  page: { string: 1080, min: 1081 },
  per_page: { string: 1077, min: 1078, max: 1079 },
};

export interface PaginatedResponse<T> {
  data: T[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
}

/**
 * Laravel-style `{data, links, meta}` paginator envelope — the doc's own
 * fingerprint (see constitution.md), shared across reports/report-types/
 * scorecards list endpoints.
 */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number,
  path: string,
): PaginatedResponse<T> {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? null : (page - 1) * perPage + 1;
  const to = total === 0 ? null : Math.min(page * perPage, total);
  const urlFor = (p: number): string => `${path}?page=${p}`;

  return {
    data: items,
    links: {
      first: urlFor(1),
      last: urlFor(lastPage),
      prev: page > 1 ? urlFor(page - 1) : null,
      next: page < lastPage ? urlFor(page + 1) : null,
    },
    meta: {
      current_page: page,
      from,
      last_page: lastPage,
      path,
      per_page: perPage,
      to,
      total,
    },
  };
}
