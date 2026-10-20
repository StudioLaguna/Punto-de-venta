import { describe, it, expect } from 'vitest';
import { createTestDb, productFixture } from './helpers';
import { productsService } from '../src/main/services/productsService';

describe('catálogo de productos (Fase 1)', () => {
  it('crea, edita y desactiva; valida SKU/barcode únicos', () => {
    const db = createTestDb();
    const p = productFixture(db, { sku: 'A-001', barcode: '750001', name: 'Leche', price_cents: 2500 });
    expect(p.id).toBeGreaterThan(0);

    // SKU duplicado
    expect(() =>
      productsService.create(db, { sku: 'A-001', name: 'Otro', price_cents: 100 })
    ).toThrow(/SKU ya existe/);

    // Barcode duplicado
    expect(() =>
      productsService.create(db, { sku: 'A-002', barcode: '750001', name: 'Otro', price_cents: 100 })
    ).toThrow(/barras ya existe/);

    const edited = productsService.update(db, p.id, { name: 'Leche Entera', price_cents: 2700 });
    expect(edited.name).toBe('Leche Entera');

    const off = productsService.setActive(db, p.id, false);
    expect(off.active).toBe(0);
    const onlyActive = productsService.list(db, { onlyActive: true });
    expect(onlyActive.find((x) => x.id === p.id)).toBeUndefined();

    const found = productsService.findByCode(db, 'A-001');
    expect(found?.id).toBe(p.id);
    const byBarcode = productsService.findByCode(db, '750001');
    expect(byBarcode?.id).toBe(p.id);
  });
});
