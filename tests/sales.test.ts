import { describe, it, expect } from 'vitest';
import { createTestDb, productFixture } from './helpers';
import { inventoryService } from '../src/main/services/inventoryService';
import { salesService } from '../src/main/services/salesService';
import { productsService } from '../src/main/services/productsService';
import { stockFromMovements } from '../src/main/db/productsRepo';
import { reportsService } from '../src/main/services/reportsService';

describe('ventas (Fases 3-4)', () => {
  it('venta descuenta stock, usa precio de BD y es atómica ante fallo', () => {
    const db = createTestDb();
    const a = productFixture(db, { price_cents: 1000 });
    const b = productFixture(db, { price_cents: 500 });
    inventoryService.addEntry(db, { productId: a.id, qty: 5 });
    inventoryService.addEntry(db, { productId: b.id, qty: 5 });

    const t0 = performance.now();
    const sale = salesService.create(db, {
      items: [{ productId: a.id, qty: 2 }, { productId: b.id, qty: 1 }],
      paymentMethod: 'EFECTIVO',
      receivedCents: 5000
    });
    const ms = performance.now() - t0;
    expect(sale.folio).toBe(1);
    expect(sale.total_cents).toBe(2500); // 2*1000 + 1*500, precio de BD
    expect(sale.change_cents).toBe(2500);
    expect(ms).toBeLessThan(100);
    expect(productsService.findByCode(db, a.sku)!.stock).toBe(3);

    // Fallo simulado: un producto inexistente -> no queda nada parcial
    const before = salesService.list(db, '2000-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z').length;
    expect(() =>
      salesService.create(db, {
        items: [{ productId: a.id, qty: 1 }, { productId: 999999, qty: 1 }],
        paymentMethod: 'TARJETA'
      })
    ).toThrow();
    const after = salesService.list(db, '2000-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z').length;
    expect(after).toBe(before);
    expect(productsService.findByCode(db, a.sku)!.stock).toBe(3);
  });

  it('rechaza stock insuficiente por defecto y respeta allow_negative_stock', () => {
    const db = createTestDb();
    const p = productFixture(db);
    inventoryService.addEntry(db, { productId: p.id, qty: 1 });
    expect(() =>
      salesService.create(db, { items: [{ productId: p.id, qty: 2 }], paymentMethod: 'TARJETA' })
    ).toThrow(/insuficiente/i);
    db.prepare("UPDATE settings SET value='1' WHERE key='allow_negative_stock'").run();
    const s = salesService.create(db, { items: [{ productId: p.id, qty: 2 }], paymentMethod: 'TARJETA' });
    expect(s.total_cents).toBeGreaterThan(0);
    expect(productsService.findByCode(db, p.sku)!.stock).toBe(-1);
  });

  it('anulación repone stock exacto y no se puede anular dos veces', () => {
    const db = createTestDb();
    const p = productFixture(db);
    inventoryService.addEntry(db, { productId: p.id, qty: 5 });
    const sale = salesService.create(db, { items: [{ productId: p.id, qty: 3 }], paymentMethod: 'TARJETA' });
    expect(productsService.findByCode(db, p.sku)!.stock).toBe(2);
    const v = salesService.void(db, { saleId: sale.id, reason: 'devolución' });
    expect(v.status).toBe('ANULADA');
    expect(productsService.findByCode(db, p.sku)!.stock).toBe(5);
    expect(stockFromMovements(db, p.id)).toBe(5);
    expect(() => salesService.void(db, { saleId: sale.id, reason: 'otra vez' })).toThrow(/anulada/i);
  });

  it('reporte diario cuadra con ventas', () => {
    const db = createTestDb();
    const p = productFixture(db, { price_cents: 1000 });
    inventoryService.addEntry(db, { productId: p.id, qty: 10 });
    const s1 = salesService.create(db, { items: [{ productId: p.id, qty: 2 }], paymentMethod: 'EFECTIVO', receivedCents: 2000 });
    const date = s1.created_at.slice(0, 10);
    const rep = reportsService.daily(db, date);
    expect(rep.count).toBe(1);
    expect(rep.total_cents).toBe(2000);
    expect(rep.byMethod.find((b) => b.method === 'EFECTIVO')?.total_cents).toBe(2000);
    expect(rep.topProducts[0]?.qty).toBe(2);
  });
});
