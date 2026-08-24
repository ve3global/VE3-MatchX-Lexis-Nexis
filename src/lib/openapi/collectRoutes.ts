import type { Express } from 'express';
import { API_PREFIX } from '../apiPrefix.js';

export interface RouteInfo {
  method: string;
  path: string;
}

interface ExpressRouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: ExpressRouteLayer[] };
}

function walk(stack: ExpressRouteLayer[], routes: RouteInfo[]): void {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.entries(layer.route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => method.toUpperCase());
      for (const method of methods) {
        routes.push({ method, path: layer.route.path });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      walk(layer.handle.stack, routes);
    }
  }
}

/**
 * Walks Express's internal router stack to enumerate every registered
 * route — the live route surface EPIC-8's doc-parity check compares
 * against the checked-in OpenAPI spec and extension allowlist. `walk`
 * itself reports paths relative to whichever router they're defined on
 * (Express doesn't stitch nested mount paths for us), so every route
 * except `/up` gets API_PREFIX stitched on here — the health check is the
 * one route app.ts mounts outside that prefix (see lib/apiPrefix.ts).
 */
export function collectRoutes(app: Express): RouteInfo[] {
  const router = (app as unknown as { _router?: { stack: ExpressRouteLayer[] } })._router;
  const routes: RouteInfo[] = [];
  walk(router?.stack ?? [], routes);
  return routes.map((route) =>
    route.path === '/up' ? route : { ...route, path: `${API_PREFIX}${route.path}` },
  );
}
