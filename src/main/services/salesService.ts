import type Database from 'better-sqlite3';
import { z } from 'zod';
import { applyMovement } from '../db/inventoryRepo';
import { findProductById } from '../db/productsRepo';
import { getSale, listSales, nextFolio } from '../db/salesRepo';
import { allowNegativeStock } from '../db/settingsRepo';
import type { PaymentMethod, SaleWithItems } from '../../shared/types';

export const createSaleSchema = z.object({
  items: z
    .array(z.object({ productId: z.number().int().positive(), qty: z.number().int().positive().max(10000) }))
    .min(1, 'La venta necesita al menos un producto'),
  paymentMethod: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']),
  receivedCents: z.number().int().min(0).nullish()
});

export const voidSaleSchema = z.object({
  saleId: z.number().int().positive(),
  reason: z.string().trim().min(1, 'Motivo requerido').max(300)
});

export const salesService = {
  create(db: Database.Database, raw: unknown): SaleWithItems {
    const { items, paymentMethod, receivedCents } = createSaleSchema.parse(raw);
    // Consolidar líneas repetidas
    const merged = new Map<number, number>();
    for (const it of items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty);

    const tx = db.transaction(() => {
      const allowNeg = allowNegativeStock(db);
      // Leer precios de la BD (nunca confiar en UI) y validar
      const lines: { productId: number; name: string; unit: number; qty: number; sub: number }[] = [];
      for (const [productId, qty] of merged) {
        const p = findProductById(db, productId);
        if (!p) throw Object.assign(new Error(`Producto ${productId} no encontrado`), { userCode: 'NO_ENCONTRADO' });
        if (!p.active) throw Object.assign(new Error(`Producto "${p.name}" está desactivado`), { userCode: 'PRODUCTO_INACTIVO' });
        if (!allowNeg && p.stock < qty) {
          throw Object.assign(new Error(`Stock insuficiente para "${p.name}" (disponible ${p.stock})`), {
            userCode: 'STOCK_INSUFICIENTE'
          });
        }
        lines.push({ productId, name: p.name, unit: p.price_cents, qty, sub: p.price_cents * qty });
      }
      const total = lines.reduce((a, l) => a + l.sub, 0);
      const method = paymentMethod as PaymentMethod;
      let received: number | null = null;
      let change: number | null = null;
      if (method === 'EFECTIVO') {
        if (receivedCents === undefined || receivedCents === null) {
          throw Object.assign(new Error('Indica el monto recibido en efectivo'), { userCode: 'VALIDACION' });
        }
        if (receivedCents < total) {
          throw Object.assign(new Error('El monto recibido es menor al total'), { userCode: 'PAGO_INSUFICIENTE' });
        }
        received = receivedCents;
        change = receivedCents - total;
      }
      const now = new Date().toISOString();
      const folio = nextFolio(db);
      const saleInfo = db
        .prepare(
          `INSERT INTO sales (folio, total_cents, payment_method, received_cents, change_cents, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'COMPLETADA', ?)`
        )
        .run(folio, total, method, received, change, now);
      const saleId = Number(saleInfo.lastInsertRowid);
      const insItem = db.prepare(
        `INSERT INTO sale_items (sale_id, product_id, product_name, unit_price_cents, qty, subtotal_cents)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const l of lines) {
        insItem.run(saleId, l.productId, l.name, l.unit, l.qty, l.sub);
        applyMovement(db, l.productId, 'VENTA', -l.qty, null, saleId);
      }
      return saleId;
    });

    const saleId = tx();
    const sale = getSale(db, saleId);
    if (!sale) throw new Error('No se pudo leer la venta creada');
    return sale;
  },

  void(db: Database.Database, raw: unknown): SaleWithItems {
    const { saleId, reason } = voidSaleSchema.parse(raw);
    const tx = db.transaction(() => {
      const sale = getSale(db, saleId);
      if (!sale) throw Object.assign(new Error('Venta no encontrada'), { userCode: 'NO_ENCONTRADO' });
      if (sale.status === 'ANULADA') {
        throw Object.assign(new Error('La venta ya está anulada'), { userCode: 'YA_ANULADA' });
      }
      const now = new Date().toISOString();
      db.prepare('UPDATE sales SET status = ?, voided_at = ?, void_reason = ? WHERE id = ?').run(
        'ANULADA',
        now,
        reason,
        saleId
      );
      for (const it of sale.items) {
        applyMovement(db, it.product_id, 'ANULACION_VENTA', it.qty, reason, saleId);
      }
    });
    tx();
    const sale = getSale(db, saleId);
    if (!sale) throw new Error('No se pudo leer la venta anulada');
    return sale;
  },

  list(db: Database.Database, from: string, to: string) {
    return listSales(db, from, to);
  },

  get(db: Database.Database, id: number) {
    return getSale(db, id);
  }
};
