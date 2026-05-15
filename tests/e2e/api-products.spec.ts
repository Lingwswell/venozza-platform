import { test, expect } from '@playwright/test';

const storeId = 'cmnqqxng8000192oz4bt0wo3u';

test('GET /api/products deve retornar produtos da loja', async ({ request }) => {
  const response = await request.get(`/api/products?storeId=${storeId}`);

  expect(response.status()).toBe(200);

  const data = await response.json();

  expect(data.ok).toBeTruthy();
  expect(data.storeId).toBe(storeId);
  expect(Array.isArray(data.items)).toBeTruthy();
  expect(data.items.length).toBeGreaterThan(0);
});
