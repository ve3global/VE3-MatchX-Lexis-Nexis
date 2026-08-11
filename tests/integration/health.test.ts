import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('GET /up', () => {
  it('returns 200 without authentication', async () => {
    const app = createApp();
    const res = await request(app).get('/up');
    expect(res.status).toBe(200);
  });
});
