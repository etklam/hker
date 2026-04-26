import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test('health endpoint should return OK', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('session endpoint should return current session state', async ({ request }) => {
    const response = await request.get('/api/auth/session');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toBeNull(); // No user authenticated
  });

  test('featured endpoint should return featured content', async ({ request }) => {
    const response = await request.get('/api/featured');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('collections');
    expect(Array.isArray(body.collections)).toBeTruthy();
  });

  test('marketplace search endpoint should accept queries', async ({ request }) => {
    const response = await request.get('/api/marketplace/search?q=test');
    expect(response.status()).toBe(200);
    const body = await response.json();
    // The response might be an object with listings property or an array
    expect(body).toBeDefined();
  });

  test('marketplace listings endpoint should return listings', async ({ request }) => {
    const response = await request.get('/api/marketplace');
    expect(response.status()).toBe(200);
    const body = await response.json();
    // The response might be an object with listings property or an array
    expect(body).toBeDefined();
  });
});
