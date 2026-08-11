import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Generates docs/postman/LN-Replica.postman_collection.json from a
 * declarative request list — same "generate from a single source of
 * truth" philosophy as scripts/generate-openapi.ts, just for a
 * runnable/human-clickable artifact instead of a schema. Re-run via
 * `npm run postman:generate` and commit the result whenever a request
 * is added/changed. Covers every route across phase 1 and phase 2 (see
 * planning/README.md's status tables) — one folder per epic, requests
 * run top-to-bottom with variable chaining (Collection Runner or
 * Newman), same convention the original EPIC-2-only collection used.
 */

interface Save {
  /** Collection variable name to set. */
  as: string;
  /** Dot-path into the parsed response body, e.g. "id" or "data.0.id". */
  from: string;
}

interface RequestSpec {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, string>;
  /** false omits the Authorization header entirely (tests the "missing_token" path). Ignored when authHeaderValue is set. */
  auth?: boolean;
  /** Literal Authorization header value to send instead of the default `Bearer {{access_token}}` — e.g. to test a malformed scheme. */
  authHeaderValue?: string;
  tests?: string[];
  saves?: Save[];
}

interface FolderSpec {
  name: string;
  description?: string;
  items: RequestSpec[];
}

function statusTest(code: number): string {
  return `pm.test('status ${code}', () => pm.response.to.have.status(${code}));`;
}

function fieldEqualsTest(label: string, path: string, expected: unknown): string {
  return `pm.test('${label}', () => pm.expect(pm.response.json()${jsonPathAccessor(path)}).to.eql(${JSON.stringify(expected)}));`;
}

/**
 * Dedicated helper for `errors.*` assertions on a 422 body. Zod issue
 * paths are joined with `.` into ONE flat object key (`mapZodError`'s
 * `issue.path.join('.')`) — e.g. `errors['bank_details.sort_code']` or
 * `errors['groups.0.rules.0.attribute']` — never nested objects, even
 * when the key itself contains dots or array indices. `fieldKey` here is
 * that exact literal key string; `jsonPathAccessor`'s auto dot-splitting
 * would silently misinterpret it as nested access, so this bypasses it
 * with a direct bracket lookup instead.
 */
function errorCodeTest(label: string, fieldKey: string, expectedCode: number, index = 0): string {
  return `pm.test('${label}', () => pm.expect(pm.response.json().errors[${JSON.stringify(fieldKey)}][${index}].code).to.eql(${expectedCode}));`;
}

function fieldDefinedTest(label: string, path: string): string {
  return `pm.test('${label}', () => pm.expect(pm.response.json()${jsonPathAccessor(path)}).to.not.be.undefined);`;
}

// Always bracket-notation, even for plain-identifier segments — several
// real response keys contain hyphens (report action names like
// "dob-verification", "otp-email-verification", "remote-check"), and
// bare dot access silently mis-parses e.g. `.data.dob-verification` as
// `.data.dob - verification` (subtraction of an undefined variable).
// Bracket notation with a quoted string works uniformly for every key
// shape; numeric segments (array indices) skip the quotes.
function jsonPathAccessor(path: string): string {
  return path
    .split('.')
    .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : `[${JSON.stringify(segment)}]`))
    .join('');
}

function saveScript(saves: Save[] | undefined): string[] {
  if (!saves) return [];
  return saves.map(
    (save) =>
      `pm.collectionVariables.set('${save.as}', pm.response.json()${jsonPathAccessor(save.from)});`,
  );
}

// A plain string (not the {raw, host, path, ...} object form) — matches
// the original EPIC-2 collection's proven-working format for this
// Newman version; the object form was observed to make every single
// request fail with "request url is empty" (see git history / live
// testing notes) despite looking schema-valid.
function buildUrl(path: string, query?: Record<string, string>): string {
  const base = `{{base_url}}${path}`;
  if (!query) return base;
  const qs = Object.entries(query)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `${base}?${qs}`;
}

function buildItem(spec: RequestSpec): object {
  const headers: { key: string; value: string }[] = [];
  if (spec.body !== undefined) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }
  if (spec.authHeaderValue !== undefined) {
    headers.push({ key: 'Authorization', value: spec.authHeaderValue });
  } else if (spec.auth !== false) {
    headers.push({ key: 'Authorization', value: 'Bearer {{access_token}}' });
  }

  const exec = [...(spec.tests ?? []), ...saveScript(spec.saves)];

  return {
    name: spec.name,
    request: {
      method: spec.method,
      header: headers,
      url: buildUrl(spec.path, spec.query),
      ...(spec.body !== undefined && {
        body: { mode: 'raw', raw: JSON.stringify(spec.body, null, 2) },
      }),
    },
    ...(exec.length > 0 && {
      event: [{ listen: 'test', script: { type: 'text/javascript', exec } }],
    }),
  };
}

const FOLDERS: FolderSpec[] = [
  {
    name: '00 - Health',
    items: [
      {
        name: 'GET /up — health check (unauthenticated)',
        method: 'GET',
        path: '/up',
        auth: false,
        tests: [statusTest(200)],
      },
    ],
  },

  {
    name: '01 - Auth (EPIC-2)',
    description:
      "OAuth token issuance, bearer-auth middleware, and the replica-only revoke extension. See planning/specs/epic-2-auth/spec.md. Middleware checks hit '/definitely-not-a-real-route' to isolate them from any real protected route's own business logic.",
    items: [
      {
        name: 'POST /oauth/token — valid credentials',
        method: 'POST',
        path: '/oauth/token',
        auth: false,
        body: { client_id: '{{client_id}}', client_secret: '{{client_secret}}' },
        tests: [
          statusTest(200),
          `pm.test('token_type is Bearer', () => pm.expect(pm.response.json().token_type).to.eql('Bearer'));`,
          `pm.test('expires_in is 1800', () => pm.expect(pm.response.json().expires_in).to.eql(1800));`,
        ],
        saves: [{ as: 'access_token', from: 'access_token' }],
      },
      {
        name: 'POST /oauth/token — invalid client_secret (401)',
        method: 'POST',
        path: '/oauth/token',
        auth: false,
        body: { client_id: '{{client_id}}', client_secret: 'wrong-secret' },
        tests: [
          statusTest(401),
          fieldEqualsTest('doc-exact message', 'message', 'Unauthenticated'),
        ],
      },
      {
        name: 'POST /oauth/token — unknown client_id (401)',
        method: 'POST',
        path: '/oauth/token',
        auth: false,
        body: { client_id: 'no-such-client', client_secret: '{{client_secret}}' },
        tests: [statusTest(401)],
      },
      {
        name: 'POST /oauth/token — missing client_secret (422)',
        method: 'POST',
        path: '/oauth/token',
        auth: false,
        body: { client_id: '{{client_id}}' },
        tests: [
          statusTest(422),
          errorCodeTest('code 1319 on client_secret', 'client_secret', 1319),
        ],
      },
      {
        name: 'GET /definitely-not-a-real-route — no Authorization header (401 missing_token)',
        method: 'GET',
        path: '/definitely-not-a-real-route',
        auth: false,
        tests: [
          statusTest(401),
          fieldEqualsTest('reason missing_token', 'reason', 'missing_token'),
        ],
      },
      {
        name: 'GET /definitely-not-a-real-route — malformed header, no Bearer prefix (401 invalid_token)',
        method: 'GET',
        path: '/definitely-not-a-real-route',
        authHeaderValue: 'Token abc123',
        tests: [
          statusTest(401),
          fieldEqualsTest('reason invalid_token', 'reason', 'invalid_token'),
        ],
      },
      {
        name: 'GET /definitely-not-a-real-route — Bearer scheme, unknown token (401 invalid_token)',
        method: 'GET',
        path: '/definitely-not-a-real-route',
        authHeaderValue: 'Bearer not-a-real-token',
        tests: [
          statusTest(401),
          fieldEqualsTest('reason invalid_token', 'reason', 'invalid_token'),
        ],
      },
      {
        name: 'GET /definitely-not-a-real-route — valid token, unknown route (404, proves middleware passes through)',
        method: 'GET',
        path: '/definitely-not-a-real-route',
        tests: [statusTest(404)],
      },
      {
        name: 'POST /oauth/token/revoke — revoke active tokens (extension, LN9)',
        method: 'POST',
        path: '/oauth/token/revoke',
        auth: false,
        body: { client_id: '{{client_id}}', client_secret: '{{client_secret}}' },
        tests: [statusTest(200), fieldDefinedTest('revoked count present', 'revoked')],
      },
      {
        name: 'GET /definitely-not-a-real-route — revoked token reused (401 token_revoked)',
        method: 'GET',
        path: '/definitely-not-a-real-route',
        tests: [
          statusTest(401),
          fieldEqualsTest('reason token_revoked', 'reason', 'token_revoked'),
        ],
      },
      {
        name: 'POST /oauth/token — re-issue after revoke (needed for the rest of the collection)',
        method: 'POST',
        path: '/oauth/token',
        auth: false,
        body: { client_id: '{{client_id}}', client_secret: '{{client_secret}}' },
        tests: [statusTest(200)],
        saves: [{ as: 'access_token', from: 'access_token' }],
      },
    ],
  },

  {
    name: '02 - Address Lookup (EPIC-3)',
    items: [
      {
        name: 'POST /address-lookup — doc sample postcode (BS7 8EU)',
        method: 'POST',
        path: '/address-lookup',
        body: { postcode: 'BS7 8EU' },
        tests: [
          statusTest(200),
          fieldEqualsTest(
            'first candidate is the doc sample address',
            'data.0.full_address',
            '204 Julius Road, Bristol, BS7 8EU',
          ),
        ],
        saves: [{ as: 'address_reference', from: 'data.0.reference' }],
      },
      {
        name: 'POST /address-lookup — missing postcode and full_address (422)',
        method: 'POST',
        path: '/address-lookup',
        body: {},
        tests: [statusTest(422), errorCodeTest('code 1319 on _lookup', '_lookup', 1319)],
      },
      {
        name: 'POST /address-lookup — wrong type for postcode (422)',
        method: 'POST',
        path: '/address-lookup',
        body: { postcode: 123 },
        tests: [statusTest(422), errorCodeTest('code 1032 on postcode', 'postcode', 1032)],
      },
      {
        name: 'GET /addresses — extension alias (LN10)',
        method: 'GET',
        path: '/addresses',
        query: { postcode: 'BS7 8EU' },
        tests: [
          statusTest(200),
          fieldEqualsTest(
            'same doc sample as POST',
            'data.0.full_address',
            '204 Julius Road, Bristol, BS7 8EU',
          ),
        ],
      },
      {
        name: 'GET /addresses/search — extension alias (LN11)',
        method: 'GET',
        path: '/addresses/search',
        query: { q: 'Julius Road' },
        tests: [statusTest(200)],
      },
      {
        name: 'GET /addresses/{reference} — round-trips a real candidate (LN12)',
        method: 'GET',
        path: '/addresses/{{address_reference}}',
        tests: [
          statusTest(200),
          fieldEqualsTest(
            'same address as the lookup',
            'data.full_address',
            '204 Julius Road, Bristol, BS7 8EU',
          ),
        ],
      },
      {
        name: 'GET /addresses/{reference} — unrecognized reference (404)',
        method: 'GET',
        path: '/addresses/not-a-real-reference',
        tests: [statusTest(404)],
      },
    ],
  },

  {
    name: '03 - Scorecards (EPIC-6)',
    items: [
      {
        name: 'POST /scorecards — create',
        method: 'POST',
        path: '/scorecards',
        body: {
          name: 'Postman Scorecard {{$timestamp}}',
          pass_threshold: 80,
          fail_threshold: 40,
          groups: [
            {
              group_name: 'screening',
              min_score: 0,
              rules: [{ attribute: 'sanction', match_score: -100, no_match_score: 20 }],
            },
          ],
        },
        tests: [
          statusTest(201),
          fieldEqualsTest('starts as DRAFT', 'status', 'DRAFT'),
          fieldEqualsTest('starts at version 1', 'version', 1),
        ],
        saves: [{ as: 'scorecard_id', from: 'id' }],
      },
      {
        name: 'POST /scorecards — pass_threshold <= fail_threshold (422)',
        method: 'POST',
        path: '/scorecards',
        body: {
          name: 'Bad Threshold {{$timestamp}}',
          pass_threshold: 10,
          fail_threshold: 40,
          groups: [],
        },
        tests: [statusTest(422), errorCodeTest('code 1163', 'pass_threshold', 1163)],
      },
      {
        name: 'POST /scorecards — invalid rule attribute (422)',
        method: 'POST',
        path: '/scorecards',
        body: {
          name: 'Bad Attribute {{$timestamp}}',
          groups: [
            {
              group_name: 'g',
              min_score: 0,
              rules: [{ attribute: 'not_a_real_attribute', match_score: 1, no_match_score: -1 }],
            },
          ],
        },
        tests: [statusTest(422), errorCodeTest('code 1171', 'groups.0.rules.0.attribute', 1171)],
      },
      {
        name: 'GET /scorecards — list',
        method: 'GET',
        path: '/scorecards',
        tests: [statusTest(200), fieldDefinedTest('paginator meta', 'meta')],
      },
      {
        name: 'GET /scorecards/{id} — fetch',
        method: 'GET',
        path: '/scorecards/{{scorecard_id}}',
        tests: [statusTest(200)],
      },
      {
        name: 'PATCH /scorecards/{id} — update bumps version',
        method: 'PATCH',
        path: '/scorecards/{{scorecard_id}}',
        body: { pass_threshold: 90 },
        tests: [statusTest(200), fieldEqualsTest('version bumped to 2', 'version', 2)],
      },
      {
        name: 'POST /scorecards/{id}/publish — extension (LN29)',
        method: 'POST',
        path: '/scorecards/{{scorecard_id}}/publish',
        tests: [statusTest(200), fieldEqualsTest('status PUBLISHED', 'status', 'PUBLISHED')],
      },
    ],
  },

  {
    name: '04 - Report Types (EPIC-5)',
    items: [
      {
        name: 'POST /report-types — create with scorecard + primary action',
        method: 'POST',
        path: '/report-types',
        body: {
          name: 'Postman Report Type {{$timestamp}}',
          scorecard_id: '{{scorecard_id}}',
          primary_actions: ['sanction-screening'],
        },
        tests: [statusTest(201), fieldEqualsTest('starts ACTIVE', 'status', 'ACTIVE')],
        saves: [{ as: 'report_type_id', from: 'id' }],
      },
      {
        name: 'POST /report-types — unknown report action (422)',
        method: 'POST',
        path: '/report-types',
        body: { name: 'Bad Action RT {{$timestamp}}', primary_actions: ['not-a-real-action'] },
        tests: [statusTest(422), errorCodeTest('code 1037', 'primary_actions', 1037)],
      },
      {
        name: 'POST /report-types — action in both primary and secondary (422)',
        method: 'POST',
        path: '/report-types',
        body: {
          name: 'Overlap RT {{$timestamp}}',
          primary_actions: ['pep-screening'],
          secondary_actions: ['pep-screening'],
        },
        tests: [
          statusTest(422),
          errorCodeTest('code 1347 primary', 'primary_actions', 1347),
          errorCodeTest('code 1348 secondary', 'secondary_actions', 1348),
        ],
      },
      {
        name: 'GET /report-types — list (paginator envelope)',
        method: 'GET',
        path: '/report-types',
        tests: [statusTest(200), fieldDefinedTest('links present', 'links')],
      },
      {
        name: 'GET /report-types/{id} — fetch',
        method: 'GET',
        path: '/report-types/{{report_type_id}}',
        tests: [statusTest(200)],
      },
      {
        name: 'GET /report-types/{id} — unknown id (404)',
        method: 'GET',
        path: '/report-types/00000000-0000-0000-0000-000000000000',
        tests: [statusTest(404)],
      },
      {
        name: 'PATCH /report-types/{id} — partial update',
        method: 'PATCH',
        path: '/report-types/{{report_type_id}}',
        body: { description: 'Updated via Postman' },
        tests: [
          statusTest(200),
          fieldEqualsTest('description updated', 'description', 'Updated via Postman'),
        ],
      },
    ],
  },

  {
    name: '05 - Reports Core (EPIC-4)',
    items: [
      {
        name: 'POST /reports — inline, missing every required field (422)',
        method: 'POST',
        path: '/reports',
        body: {},
        tests: [
          statusTest(422),
          errorCodeTest('forename required (1007)', 'forename', 1007),
          errorCodeTest('surname required (1010)', 'surname', 1010),
          errorCodeTest('enduser_agreement required (1055)', 'enduser_agreement', 1055),
        ],
      },
      {
        name: 'POST /reports — inline valid',
        method: 'POST',
        path: '/reports',
        body: {
          forename: 'Bella',
          surname: 'Henderson',
          dob: '1980-01-01',
          address: { address1: '204 Julius Road', postcode: 'BS7 8EU' },
          enduser_agreement: true,
        },
        tests: [statusTest(201), fieldEqualsTest('starts STARTED', 'status', 'STARTED')],
        saves: [{ as: 'report_id', from: 'id' }],
      },
      {
        name: 'POST /reports — report_type_id combined with inline field (422/1149)',
        method: 'POST',
        path: '/reports',
        body: { report_type_id: '{{report_type_id}}', forename: 'Bella' },
        tests: [statusTest(422), errorCodeTest('code 1149', 'forename', 1149)],
      },
      {
        name: 'POST /reports — via report_type_id (scorecard attached, sanction-screening runs automatically)',
        method: 'POST',
        path: '/reports',
        body: { report_type_id: '{{report_type_id}}' },
        tests: [
          statusTest(201),
          fieldEqualsTest('completes automatically (no-body action)', 'status', 'COMPLETE'),
          fieldDefinedTest('assessment computed from the attached scorecard', 'assessment'),
        ],
        saves: [{ as: 'scored_report_id', from: 'id' }],
      },
      {
        name: 'GET /reports — list, filter by surname',
        method: 'GET',
        path: '/reports',
        query: { surname: 'Henderson' },
        tests: [statusTest(200), fieldDefinedTest('meta present', 'meta')],
      },
      {
        name: 'GET /reports/{id} — fetch',
        method: 'GET',
        path: '/reports/{{report_id}}',
        tests: [statusTest(200)],
      },
      {
        name: 'GET /reports/{id} — unknown id (404)',
        method: 'GET',
        path: '/reports/00000000-0000-0000-0000-000000000000',
        tests: [statusTest(404)],
      },
      {
        name: 'GET /reports/{id}/input-data — echoes submitted subject fields',
        method: 'GET',
        path: '/reports/{{report_id}}/input-data',
        tests: [statusTest(200), fieldEqualsTest('forename echoed', 'data.forename', 'Bella')],
      },
    ],
  },

  {
    name: '06 - Report Actions (EPIC-7a/7b/7c)',
    items: [
      {
        name: 'POST /reports/{id}/actions/dob-verification — no-body action',
        method: 'POST',
        path: '/reports/{{report_id}}/actions/dob-verification',
        body: {},
        tests: [
          statusTest(200),
          fieldDefinedTest('dob_verified present', 'data.dob-verification.dob_verified'),
        ],
      },
      {
        name: 'POST /reports/{id}/actions/not-a-real-action (404)',
        method: 'POST',
        path: '/reports/{{report_id}}/actions/not-a-real-action',
        body: {},
        tests: [statusTest(404)],
      },
      {
        name: 'POST /reports — QA override: surname SANCTIONED',
        method: 'POST',
        path: '/reports',
        body: {
          forename: 'Test',
          surname: 'SANCTIONED',
          dob: '1980-01-01',
          address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
          enduser_agreement: true,
        },
        tests: [statusTest(201)],
        saves: [{ as: 'sanctioned_report_id', from: 'id' }],
      },
      {
        name: 'POST /reports/{id}/actions/sanction-screening — QA override forces sanction:true',
        method: 'POST',
        path: '/reports/{{sanctioned_report_id}}/actions/sanction-screening',
        body: {},
        tests: [
          statusTest(200),
          fieldEqualsTest('sanction forced true', 'data.sanction-screening.sanction', true),
        ],
      },
      {
        name: 'POST /reports — QA override: dob 1900-01-01',
        method: 'POST',
        path: '/reports',
        body: {
          forename: 'Test',
          surname: 'Deceased',
          dob: '1900-01-01',
          address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
          enduser_agreement: true,
        },
        tests: [statusTest(201)],
        saves: [{ as: 'death_report_id', from: 'id' }],
      },
      {
        name: 'POST /reports/{id}/actions/death-screening — QA override forces all 3 flags true',
        method: 'POST',
        path: '/reports/{{death_report_id}}/actions/death-screening',
        body: {},
        tests: [
          statusTest(200),
          fieldEqualsTest('death_ddri true', 'data.death-screening.death_ddri', true),
          fieldEqualsTest('death_gro true', 'data.death-screening.death_gro', true),
          fieldEqualsTest('death_halo true', 'data.death-screening.death_halo', true),
        ],
      },
      {
        name: 'POST /reports/{id}/actions/bank-account-validation — malformed sort_code/account_number (422)',
        method: 'POST',
        path: '/reports/{{report_id}}/actions/bank-account-validation',
        body: { bank_details: { sort_code: 'abc', account_number: '123' } },
        tests: [
          statusTest(422),
          errorCodeTest('code 1095 sort_code', 'bank_details.sort_code', 1095),
        ],
      },
      {
        name: 'POST /reports/{id}/actions/bank-account-validation — valid',
        method: 'POST',
        path: '/reports/{{report_id}}/actions/bank-account-validation',
        body: { bank_details: { sort_code: '123456', account_number: '12345678' } },
        tests: [
          statusTest(200),
          fieldDefinedTest(
            'bank_account_valid present',
            'data.bank-account-validation.bank_account_valid',
          ),
        ],
      },
      {
        name: 'GET /reports/{id}/input-data — bank account number now masked',
        method: 'GET',
        path: '/reports/{{report_id}}/input-data',
        tests: [
          statusTest(200),
          fieldEqualsTest('masked to last 4', 'data.bank_details.account_number', '****5678'),
        ],
      },
      {
        name: 'POST /reports/{id}/actions/otp-email — send',
        method: 'POST',
        path: '/reports/{{report_id}}/actions/otp-email',
        body: { email: 'test@example.com' },
        tests: [statusTest(200)],
        saves: [{ as: 'otp_code', from: 'data.otp-email.otp_code' }],
      },
      {
        name: 'POST /reports/{id}/actions/otp-email-verification — with the sent code',
        method: 'POST',
        path: '/reports/{{report_id}}/actions/otp-email-verification',
        body: { code: '{{otp_code}}' },
        tests: [
          statusTest(200),
          fieldEqualsTest('verified true', 'data.otp-email-verification.otp_email_verified', true),
        ],
      },
    ],
  },

  {
    name: '07 - Remote-check Lifecycle (EPIC-12, phase 2)',
    items: [
      {
        name: 'POST /reports — fresh report for the remote-check flow',
        method: 'POST',
        path: '/reports',
        body: {
          forename: 'Remote',
          surname: 'Check',
          dob: '1985-05-05',
          address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
          enduser_agreement: true,
        },
        tests: [statusTest(201)],
        saves: [{ as: 'rc_report_id', from: 'id' }],
      },
      {
        name: 'POST .../actions/remote-check — start (IN_PROGRESS)',
        method: 'POST',
        path: '/reports/{{rc_report_id}}/actions/remote-check',
        body: {},
        tests: [
          statusTest(200),
          fieldEqualsTest('IN_PROGRESS', 'data.remote-check.remote_check_status', 'IN_PROGRESS'),
        ],
      },
      {
        name: 'POST .../actions/remote-check — double-start (422/1312)',
        method: 'POST',
        path: '/reports/{{rc_report_id}}/actions/remote-check',
        body: {},
        tests: [statusTest(422), errorCodeTest('code 1312', '_remote_check', 1312)],
      },
      {
        name: 'GET .../actions/remote-check/results — resolves deterministically',
        method: 'GET',
        path: '/reports/{{rc_report_id}}/actions/remote-check/results',
        tests: [
          statusTest(200),
          fieldEqualsTest('COMPLETED', 'data.remote_check_status', 'COMPLETED'),
        ],
      },
      {
        name: 'GET .../actions/remote-check/results — idempotent on re-fetch',
        method: 'GET',
        path: '/reports/{{rc_report_id}}/actions/remote-check/results',
        tests: [
          statusTest(200),
          fieldEqualsTest('still COMPLETED', 'data.remote_check_status', 'COMPLETED'),
        ],
      },
      {
        name: 'POST .../actions/remote-check — re-run after completion (422/1313)',
        method: 'POST',
        path: '/reports/{{rc_report_id}}/actions/remote-check',
        body: {},
        tests: [statusTest(422), errorCodeTest('code 1313', '_remote_check', 1313)],
      },
      {
        name: 'POST .../actions/dob-verification — blocked, report closed (422/1325)',
        method: 'POST',
        path: '/reports/{{rc_report_id}}/actions/dob-verification',
        body: {},
        tests: [statusTest(422), errorCodeTest('code 1325', '_report', 1325)],
      },
      {
        name: 'GET .../actions/remote-check/pdf — stub payload after completion',
        method: 'GET',
        path: '/reports/{{rc_report_id}}/actions/remote-check/pdf',
        tests: [
          statusTest(200),
          fieldEqualsTest('pdf content type', 'data.content_type', 'application/pdf'),
        ],
      },
      {
        name: 'POST /reports — second report, for cancel/resend',
        method: 'POST',
        path: '/reports',
        body: {
          forename: 'Remote',
          surname: 'CancelTest',
          dob: '1985-05-05',
          address: { address1: '1 Test Street', postcode: 'TE1 1ST' },
          enduser_agreement: true,
        },
        tests: [statusTest(201)],
        saves: [{ as: 'rc_cancel_report_id', from: 'id' }],
      },
      {
        name: 'POST .../remote-check/cancel — no transaction yet (422/1321)',
        method: 'POST',
        path: '/reports/{{rc_cancel_report_id}}/actions/remote-check/cancel',
        tests: [statusTest(422), errorCodeTest('code 1321', '_remote_check', 1321)],
      },
      {
        name: 'POST .../actions/remote-check — start (for cancel test)',
        method: 'POST',
        path: '/reports/{{rc_cancel_report_id}}/actions/remote-check',
        body: {},
        tests: [statusTest(200)],
      },
      {
        name: 'POST .../remote-check/cancel — succeeds while IN_PROGRESS',
        method: 'POST',
        path: '/reports/{{rc_cancel_report_id}}/actions/remote-check/cancel',
        tests: [
          statusTest(200),
          fieldEqualsTest('CANCELLED', 'data.remote_check_status', 'CANCELLED'),
        ],
      },
      {
        name: 'POST .../remote-check/resend — 422/1338 after cancel (not in progress)',
        method: 'POST',
        path: '/reports/{{rc_cancel_report_id}}/actions/remote-check/resend',
        tests: [statusTest(422), errorCodeTest('code 1338', '_remote_check', 1338)],
      },
      {
        name: 'POST .../actions/remote-check — restart allowed after cancel',
        method: 'POST',
        path: '/reports/{{rc_cancel_report_id}}/actions/remote-check',
        body: {},
        tests: [
          statusTest(200),
          fieldEqualsTest(
            'IN_PROGRESS again',
            'data.remote-check.remote_check_status',
            'IN_PROGRESS',
          ),
        ],
      },
    ],
  },

  {
    name: '08 - Notifications (EPIC-9, phase 2)',
    items: [
      {
        name: 'GET /notifications — list (paginator envelope)',
        method: 'GET',
        path: '/notifications',
        tests: [statusTest(200), fieldDefinedTest('meta present', 'meta')],
        saves: [{ as: 'notification_id', from: 'data.0.id' }],
      },
      {
        name: 'GET /notifications?read=false — filter',
        method: 'GET',
        path: '/notifications',
        query: { read: 'false' },
        tests: [statusTest(200)],
      },
      {
        name: 'PATCH /notifications/{id} — mark read',
        method: 'PATCH',
        path: '/notifications/{{notification_id}}',
        body: { read: true },
        tests: [statusTest(200), fieldEqualsTest('read true', 'read', true)],
      },
      {
        name: 'PATCH /notifications/{id} — malformed body (422)',
        method: 'PATCH',
        path: '/notifications/{{notification_id}}',
        body: {},
        tests: [statusTest(422), errorCodeTest('code 1281', 'read', 1281)],
      },
    ],
  },

  {
    name: '09 - Webhooks (EPIC-10, phase 2)',
    items: [
      {
        name: 'POST /webhooks — non-https url (422/1297)',
        method: 'POST',
        path: '/webhooks',
        body: {
          notification_webhook_url: 'http://example.invalid/hook',
          notification_webhook_secret: 'x',
        },
        tests: [statusTest(422), errorCodeTest('code 1297', 'notification_webhook_url', 1297)],
      },
      {
        name: 'POST /webhooks — create (valid https url)',
        method: 'POST',
        path: '/webhooks',
        body: {
          notification_webhook_url: 'https://example.invalid/hook',
          notification_webhook_secret: 'topsecret',
        },
        tests: [statusTest(201)],
        saves: [{ as: 'webhook_id', from: 'id' }],
      },
      {
        name: 'GET /webhooks — list',
        method: 'GET',
        path: '/webhooks',
        tests: [statusTest(200)],
      },
      {
        name: 'POST /webhooks/{id}/test — simulated delivery (no real HTTP call, see spec)',
        method: 'POST',
        path: '/webhooks/{{webhook_id}}/test',
        tests: [
          statusTest(200),
          `pm.test('status is SUCCESS or FAILED', () => pm.expect(['SUCCESS', 'FAILED']).to.include(pm.response.json().status));`,
          `pm.test('signature is a 64-char hex HMAC', () => pm.expect(pm.response.json().signature).to.match(/^[0-9a-f]{64}$/));`,
        ],
      },
      {
        name: 'POST /webhooks/{id}/retry — no eligible delivery yet (422/1303)',
        method: 'POST',
        path: '/webhooks/{{webhook_id}}/retry',
        tests: [statusTest(422)],
      },
      {
        name: 'POST /webhooks/{id}/secret — rotate',
        method: 'POST',
        path: '/webhooks/{{webhook_id}}/secret',
        tests: [
          statusTest(200),
          fieldDefinedTest('new secret returned once', 'notification_webhook_secret'),
        ],
      },
      {
        name: 'DELETE /webhooks/{id} — delete',
        method: 'DELETE',
        path: '/webhooks/{{webhook_id}}',
        tests: [statusTest(204)],
      },
    ],
  },

  {
    name: '10 - Users Module (EPIC-11, phase 2)',
    description:
      "self/options/activity-logs are real error-code clusters assembled into resources; 'company' has no dedicated doc evidence at all and is allowlisted as a replica-only extension in EPIC-8's doc-parity check — see planning/specs/epic-11-users-module/spec.md.",
    items: [
      {
        name: 'GET /users/self — auto-created profile',
        method: 'GET',
        path: '/users/self',
        tests: [statusTest(200)],
      },
      {
        name: 'PATCH /users/self — update username/gender',
        method: 'PATCH',
        path: '/users/self',
        body: { username: 'postman_user_{{$timestamp}}', gender: 'other' },
        tests: [statusTest(200), fieldEqualsTest('gender updated', 'gender', 'other')],
      },
      {
        name: 'PATCH /users/self — invalid gender (422/1210)',
        method: 'PATCH',
        path: '/users/self',
        body: { gender: 'not-a-real-option' },
        tests: [statusTest(422), errorCodeTest('code 1210', 'gender', 1210)],
      },
      {
        name: 'GET /users/company — auto-created (extension, no doc evidence)',
        method: 'GET',
        path: '/users/company',
        tests: [statusTest(200)],
      },
      {
        name: 'PATCH /users/company — set a name',
        method: 'PATCH',
        path: '/users/company',
        body: { name: 'Postman Test Co' },
        tests: [statusTest(200), fieldEqualsTest('name set', 'name', 'Postman Test Co')],
      },
      {
        // demo-client's UserOptions row is a persistent singleton shared
        // across every run of this collection (and the automated suite)
        // — never assume a specific boolean value survived from a
        // previous run; only the shape (config sub-object present with
        // its 4 confirmed keys) is guaranteed.
        name: 'GET /users/options — shape check (config sub-object present)',
        method: 'GET',
        path: '/users/options',
        tests: [
          statusTest(200),
          fieldDefinedTest('config.full_er present', 'config.full_er'),
          fieldDefinedTest('config.nfi_address present', 'config.nfi_address'),
        ],
      },
      {
        name: 'PATCH /users/options — set remote_check true',
        method: 'PATCH',
        path: '/users/options',
        body: { remote_check: true },
        tests: [statusTest(200), fieldEqualsTest('now true', 'remote_check', true)],
      },
      {
        name: 'PATCH /users/options — toggle remote_check off',
        method: 'PATCH',
        path: '/users/options',
        body: { remote_check: false },
        tests: [statusTest(200), fieldEqualsTest('now false', 'remote_check', false)],
      },
      {
        name: 'PATCH /users/options — config.age_min > config.age_max (422/1197)',
        method: 'PATCH',
        path: '/users/options',
        body: { config: { age_min: 50, age_max: 20 } },
        tests: [statusTest(422), errorCodeTest('code 1197', 'config.age_min', 1197)],
      },
      {
        name: 'GET /users/activity-logs — real requests captured, filterable by status',
        method: 'GET',
        path: '/users/activity-logs',
        query: { status: '422' },
        tests: [statusTest(200), fieldDefinedTest('meta present', 'meta')],
      },
    ],
  },
];

function main(): void {
  const collection = {
    info: {
      name: 'LN Replica — Full API Suite',
      description:
        'Generated by scripts/generate-postman-collection.ts — covers every route across phase 1 (auth, address lookup, reports, report types, scorecards, all 27 report actions, doc-parity) and phase 2 (notifications, webhooks, users module, remote-check lifecycle). Run top-to-bottom (Collection Runner or Newman) — later requests depend on variables set by earlier ones. See planning/README.md for per-epic status and evidence-confidence notes.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [
      { key: 'base_url', value: 'http://localhost:3000' },
      { key: 'client_id', value: 'demo-client' },
      { key: 'client_secret', value: 'demo-secret-change-me' },
      { key: 'access_token', value: '' },
    ],
    item: FOLDERS.map((folder) => ({
      name: folder.name,
      ...(folder.description && { description: folder.description }),
      item: folder.items.map(buildItem),
    })),
  };

  const outputPath = fileURLToPath(
    new URL('../docs/postman/LN-Replica.postman_collection.json', import.meta.url),
  );
  writeFileSync(outputPath, `${JSON.stringify(collection, null, 2)}\n`);
  const totalRequests = FOLDERS.reduce((sum, folder) => sum + folder.items.length, 0);
  console.log(
    `Wrote docs/postman/LN-Replica.postman_collection.json — ${FOLDERS.length} folders, ${totalRequests} requests.`,
  );
}

main();
