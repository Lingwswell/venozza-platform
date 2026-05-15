import { test, expect } from '@playwright/test';

const storeId = 'cmnqqxng8000192oz4bt0wo3u';
const productId = 'cmolzbglh0000ahozg0e4rk97';

test('POST /api/orders deve criar pedido QA com preço validado no servidor', async ({ request }) => {
  const response = await request.post('/api/orders', {
    headers: {
      'x-store-id': storeId,
    },
    data: {
      customer: {
        name: 'Cliente QA Automatizado',
        phone: '11999999999',
        address: 'Rua Teste QA, 123',
      },
      items: [
        {
          id: productId,
          name: 'BATATINHA FRITA',
          quantity: 1,
          price_cents: 1,
        },
      ],
      paymentMethod: 'dinheiro',
    },
  });

  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);

  const data = await response.json();

  expect(data.ok).toBeTruthy();
  expect(data.order).toBeTruthy();
  expect(data.order.orderCode).toMatch(/^VZ-/);
});
