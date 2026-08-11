import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { collectRoutes } from '../../src/lib/openapi/collectRoutes.js';
import { EXTENSION_ROUTES } from '../../src/lib/openapi/extensions.js';

/**
 * EPIC-8 (LN61) — doc-parity smoke test. No database needed: route
 * registration happens at import time, before any handler runs. Blocks
 * CI on drift between the live route surface and the checked-in
 * docs/openapi.json (regenerate via `npm run openapi:generate` and
 * commit the result whenever a route is added/removed/renamed) —
 * doesn't and can't verify doc *fidelity* against the real PDF, which
 * stays a manual, one-time cross-check (constitution.md).
 */
describe('EPIC-8 doc-parity', () => {
  const app = createApp();
  const liveRoutes = collectRoutes(app);
  const liveKey = ({ method, path }: { method: string; path: string }) => `${method} ${path}`;

  it('every allowlisted extension route is a real, live route', () => {
    const liveSet = new Set(liveRoutes.map(liveKey));
    for (const route of EXTENSION_ROUTES) {
      expect(
        liveSet.has(liveKey(route)),
        `Allowlisted extension ${liveKey(route)} is not live — fix the allowlist or restore the route.`,
      ).toBe(true);
    }
  });

  it('the checked-in OpenAPI spec matches the live route surface exactly (no drift)', () => {
    const spec = JSON.parse(
      readFileSync(new URL('../../docs/openapi.json', import.meta.url), 'utf8'),
    ) as {
      paths: Record<string, Record<string, unknown>>;
    };

    const specKeys: string[] = [];
    for (const [openApiPath, methods] of Object.entries(spec.paths)) {
      const expressPath = openApiPath.replace(/\{([A-Za-z0-9_]+)\}/g, ':$1');
      for (const method of Object.keys(methods)) {
        specKeys.push(`${method.toUpperCase()} ${expressPath}`);
      }
    }

    const liveKeys = liveRoutes.map(liveKey);
    expect(liveKeys.sort()).toEqual(specKeys.sort());
  });

  it('every live route is tagged exactly "documented" or "extension", and extension tags match the allowlist', () => {
    const spec = JSON.parse(
      readFileSync(new URL('../../docs/openapi.json', import.meta.url), 'utf8'),
    ) as {
      paths: Record<string, Record<string, { tags?: string[] }>>;
    };
    const extensionSet = new Set(EXTENSION_ROUTES.map(liveKey));

    for (const [openApiPath, methods] of Object.entries(spec.paths)) {
      const expressPath = openApiPath.replace(/\{([A-Za-z0-9_]+)\}/g, ':$1');
      for (const [method, definition] of Object.entries(methods)) {
        const key = `${method.toUpperCase()} ${expressPath}`;
        const expectedTag = extensionSet.has(key) ? 'extension' : 'documented';
        expect(definition.tags).toEqual([expectedTag]);
      }
    }
  });
});
