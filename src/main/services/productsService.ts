import type Database from 'better-sqlite3';
import { z } from 'zod';
import * as repo from '../db/productsRepo';

export const productSchema = z.object({
  sku: z.string().trim().min(1, 'SKU requerido').max(64),
  barcode: z.string().trim().max(64).nullish(),
  name: z.string().trim().min(1, 'Nombre requerido').max(200),
  price_cents: z.number().int().min(0),
  cost_cents: z.number().int().min(0).default(0),
  min_stock: z.number().int().min(0).default(0)
});

export function toUserError(e: unknown): { code: string; message: string } {
  if (e instanceof z.ZodError) {
    return { code: 'VALIDACION', message: e.issues.map((i) => i.message).join('; ') };
  }
  const err = e as { code?: string; message?: string };
  const msg = err?.message ?? 'Error desconocido';
  if (msg.includes('UNIQUE constraint failed: products.sku')) {
    return { code: 'SKU_DUPLICADO', message: 'El SKU ya existe' };
  }
  if (msg.includes('UNIQUE constraint failed: products.barcode')) {
    return { code: 'CODIGO_DUPLICADO', message: 'El código de barras ya existe' };
  }
  if (err?.code === 'NOT_FOUND') return { code: 'NO_ENCONTRADO', message: msg };
  return { code: 'ERROR', message: msg };
}

export const productsService = {
  list(db: Database.Database, opts: { query?: string; onlyActive?: boolean; lowStock?: boolean } = {}) {
    return repo.listProducts(db, opts);
  },
  findByCode(db: Database.Database, code: string) {
    return repo.findProductByCode(db, code.trim());
  },
  create(db: Database.Database, raw: unknown) {
    const input = productSchema.parse(raw);
    try {
      return repo.createProduct(db, input);
    } catch (e) {
      throw Object.assign(new Error(toUserError(e).message), { userCode: toUserError(e).code });
    }
  },
  update(db: Database.Database, id: number, raw: unknown) {
    const input = productSchema.partial().parse(raw);
    try {
      return repo.updateProduct(db, id, input);
    } catch (e) {
      const ue = toUserError(e);
      throw Object.assign(new Error((e as Error).message.includes('UNIQUE') ? ue.message : (e as Error).message), {
        userCode: ue.code
      });
    }
  },
  setActive(db: Database.Database, id: number, active: boolean) {
    return repo.setProductActive(db, id, active);
  }
};
