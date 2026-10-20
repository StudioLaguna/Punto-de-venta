import type Database from 'better-sqlite3';
import { z } from 'zod';
import { applyMovement, listMovements } from '../db/inventoryRepo';
import { findProductById } from '../db/productsRepo';

export const entrySchema = z.object({
  productId: z.number().int().positive(),
  qty: z.number().int().positive('La cantidad debe ser mayor a 0').max(1_000_000),
  reason: z.string().max(300).nullish()
});

export const adjustSchema = z.object({
  productId: z.number().int().positive(),
  newStock: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(1, 'Motivo requerido').max(300)
});

export const inventoryService = {
  addEntry(db: Database.Database, raw: unknown) {
    const { productId, qty, reason } = entrySchema.parse(raw);
    const p = findProductById(db, productId);
    if (!p) throw Object.assign(new Error('Producto no encontrado'), { userCode: 'NO_ENCONTRADO' });
    const tx = db.transaction(() => applyMovement(db, productId, 'ENTRADA', qty, reason ?? null, null));
    return tx();
  },
  adjust(db: Database.Database, raw: unknown) {
    const { productId, newStock, reason } = adjustSchema.parse(raw);
    const p = findProductById(db, productId);
    if (!p) throw Object.assign(new Error('Producto no encontrado'), { userCode: 'NO_ENCONTRADO' });
    const diff = newStock - p.stock;
    if (diff === 0) {
      // Sin cambio: registrar de todas formas para auditoría con qty 0? Mejor no registrar.
      throw Object.assign(new Error('El stock nuevo es igual al actual'), { userCode: 'SIN_CAMBIO' });
    }
    const tx = db.transaction(() => applyMovement(db, productId, 'AJUSTE', diff, reason, null));
    return tx();
  },
  movements(db: Database.Database, opts: { productId?: number; from?: string; to?: string }) {
    return listMovements(db, opts);
  }
};
