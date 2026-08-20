import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const CLIENT_ID = 'demo-client';
const CLIENT_SECRET = 'demo-secret-change-me';

describe('address lookup', () => {
  const app = createApp();
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/lexis-nexis/oauth/token')
      .send({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
    token = res.body.access_token;
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app)
      .post('/lexis-nexis/address-lookup')
      .send({ postcode: 'BS7 8EU' });
    expect(res.status).toBe(401);
  });

  it('returns identical candidates for the same input across repeated calls', async () => {
    const first = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ postcode: 'SW1A 1AA' });
    const second = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ postcode: 'SW1A 1AA' });

    expect(first.status).toBe(200);
    expect(first.body).toEqual(second.body);
    expect(first.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('reproduces the doc sample address for the doc sample postcode', async () => {
    const res = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ postcode: 'BS7 8EU' });

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      house: '204',
      street: 'Julius Road',
      town: 'Bristol',
      postcode: 'BS7 8EU',
      full_address: '204 Julius Road, Bristol, BS7 8EU',
    });
  });

  it('returns a single candidate for a fully specified address', async () => {
    const res = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ house: '1', street: 'Test Street', town: 'Testville', postcode: 'TE1 1ST' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        reference: expect.any(String),
        full_address: '1 Test Street, Testville, TE1 1ST',
        house: '1',
        street: 'Test Street',
        town: 'Testville',
        postcode: 'TE1 1ST',
      },
    ]);
  });

  it('rejects a request with neither postcode nor full_address', async () => {
    const res = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors._lookup[0].code).toBe(1319);
  });

  it('rejects a wrong-typed field with the correct doc error code', async () => {
    const res = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ postcode: 123 });

    expect(res.status).toBe(422);
    expect(res.body.errors.postcode[0].code).toBe(1032);
  });

  it('GET /addresses returns the same data as the POST equivalent', async () => {
    const postRes = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ postcode: 'SW1A 1AA' });
    const getRes = await request(app)
      .get('/lexis-nexis/addresses')
      .query({ postcode: 'SW1A 1AA' })
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(postRes.body);
  });

  it('GET /addresses/search returns the same data as the POST equivalent', async () => {
    const postRes = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ full_address: '204 Julius Road' });
    const getRes = await request(app)
      .get('/lexis-nexis/addresses/search')
      .query({ q: '204 Julius Road' })
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(postRes.body);
  });

  it('GET /addresses/{reference} round-trips a real candidate', async () => {
    const lookupRes = await request(app)
      .post('/lexis-nexis/address-lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ postcode: 'SW1A 1AA' });
    const candidate = lookupRes.body.data[0];

    const res = await request(app)
      .get(`/lexis-nexis/addresses/${candidate.reference}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(candidate);
  });

  it('GET /addresses/{reference} 404s on an unrecognized reference', async () => {
    const res = await request(app)
      .get('/lexis-nexis/addresses/not-a-real-reference')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
