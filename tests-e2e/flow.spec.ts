import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// E2E del flujo completo a nivel de servicios (misma lógica que usa la UI vía IPC):
// crear producto → entrada → vender → anular → reporte.
test('flujo crear, entrada, vender, anular, reporte', async () => {
  const { openDatabase, closeDatabase } = await import('../src/main/db/connection');
  const { productsService } = await import('../src/main/services/productsService');
  const { inventoryService } = await import('../src/main/services/inventoryService');
  const { salesService } = await import('../src/main/services/salesService');
  const { reportsService } = await import('../src/main/services/reportsService');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-e2e-'));
  const db = openDatabase(path.join(dir, 'e2e.db'));

  const p = productsService.create(db, {
    sku: 'E2E-001', barcode: '750E2E001', name: 'Producto E2E', price_cents: 1500, cost_cents: 800, min_stock: 3
  });
  expect(p.stock).toBe(0);

  inventoryService.addEntry(db, { productId: p.id, qty: 10, reason: 'inventario inicial' });
  const sale = salesService.create(db, {
    items: [{ productId: p.id, qty: 2 }], paymentMethod: 'EFECTIVO', receivedCents: 5000
  });
  expect(sale.folio).toBeGreaterThan(0);
  expect(sale.total_cents).toBe(3000);
  expect(sale.change_cents).toBe(2000);

  const date = sale.created_at.slice(0, 10);
  const rep1 = reportsService.daily(db, date);
  expect(rep1.count).toBe(1);

  const v = salesService.void(db, { saleId: sale.id, reason: 'prueba e2e' });
  expect(v.status).toBe('ANULADA');

  const rep2 = reportsService.daily(db, date);
  expect(rep2.count).toBe(0); // las anuladas no suman

  closeDatabase();
});
