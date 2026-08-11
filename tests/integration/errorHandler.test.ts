import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { correlationId } from '../../src/middleware/correlationId.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

function appWithThrowingRoute() {
  const app = express();
  app.use(correlationId);
  app.get('/boom', () => {
    throw new Error('unexpected failure');
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('returns a clean 500 with a correlation ID and no stack trace', async () => {
    const res = await request(appWithThrowingRoute()).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error');
    expect(typeof res.body.correlationId).toBe('string');
    expect(res.body.correlationId.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toContain('at ');
  });

  it('echoes an incoming X-Request-Id as the correlation ID', async () => {
    const res = await request(appWithThrowingRoute())
      .get('/boom')
      .set('X-Request-Id', 'test-correlation-id');

    expect(res.body.correlationId).toBe('test-correlation-id');
  });
});
