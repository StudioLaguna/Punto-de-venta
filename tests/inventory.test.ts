import { describe, it, expect } from 'vitest';
import { createTestDb, productFixture } from './helpers';
import { inventoryService } from '../src/main/services/inventoryService';
import { stockFromMovements } from '../src/main/db/productsRepo';
import { productsService } from '../src/main/services/productsService';

describe('inventario (Fase 2)', () => {
  it('toda modificación genera movimiento y stock == suma de movimientos', () => {
    const db = createTestDb();
    const p = productFixture(db);
    inventoryService.addEntry(db, { productId: p.id, qty: 10, reason: 'compra' });
    inventoryService.adjust(db, { productId: p.id, newStock: 7, reason: 'merma' });
    const current = productsService.findByCode(db, p.sku)!;
    expect(current.stock).toBe(7);
    expect(stockFromMovements(db, p.id)).toBe(7);
    const moves = inventoryService.movements(db, { productId: p.id });
    expect(moves.length).toBe(2);
    expect(moves.map((m) => m.type).sort()).toEqual(['AJUSTE', 'ENTRADA']);
  });

  it('rechaza cantidades inválidas y exige motivo en ajuste', () => {
    const db = createTestDb();
    const p = productFixture(db);
    expect(() => inventoryService.addEntry(db, { productId: p.id, qty: 0 })).toThrow();
    expect(() => inventoryService.adjust(db, { productId: p.id, newStock: 5, reason: '' })).toThrow();
  });
});
