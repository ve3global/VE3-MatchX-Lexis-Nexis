/**
 * Every route except the health check (`GET /up`) is mounted under this
 * prefix (see app.ts) — matching the Kubernetes ingress
 * (lexis-nexis/ingress.yaml), which routes only `/lexis-nexis/*` to this
 * service. Health stays unprefixed since the readiness/liveness probes
 * hit the pod directly on its container port, bypassing the ingress
 * entirely (lexis-nexis/lexis-nexis.yaml).
 */
export const API_PREFIX = '/lexis-nexis';
