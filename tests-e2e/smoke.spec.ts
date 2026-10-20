import { test, expect } from '@playwright/test';

test('renderer carga (smoke)', async ({ page }) => {
  // Requiere `npm run dev:web` corriendo en 5173.
  test.skip(!process.env.E2E_WEB, 'Solo corre con E2E_WEB=1 y vite dev activo');
  await page.goto('/');
  await expect(page.getByText('POS Básico')).toBeVisible();
});
