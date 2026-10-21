const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../src/app');
const request = require('supertest');

test('GET /health/live returns ok and request id', async () => {
  const response = await request(app).get('/health/live');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.ok(response.headers['x-request-id']);
});

test('unknown route returns structured 404', async () => {
  const response = await request(app).get('/this-route-does-not-exist');
  assert.equal(response.status, 404);
  assert.equal(response.body.error, 'not_found');
});

test('protected route rejects missing token', async () => {
  const response = await request(app).get('/api/v1/auth/me');
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'unauthorized');
});
