import type Database from 'better-sqlite3';
import type { InventoryMovement, MovementType } from '../../shared/types';

export function listMovements(
  db: Database.Database,
  opts: { productId?: number; from?: string; to?: string } = {}
): InventoryMovement[] {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (opts.productId !== undefined) {
    conds.push('product_id = ?');
    params.push(opts.productId);
  }
  if (opts.from) {
    conds.push('created_at >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    conds.push('created_at <= ?');
    params.push(opts.to);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM inventory_movements ${where} ORDER BY id DESC LIMIT 1000`)
    .all(...params) as InventoryMovement[];
}

/** Uso interno transaccional: ajusta stock y registra movimiento. */
export function applyMovement(
  db: Database.Database,
  productId: number,
  type: MovementType,
  qty: number,
  reason?: string | null,
  saleId?: number | null
): InventoryMovement {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO inventory_movements (product_id, type, qty, reason, sale_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(productId, type, qty, reason ?? null, saleId ?? null, now);
  db.prepare('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?').run(
    qty,
    now,
    productId
  );
  return db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(Number(info.lastInsertRowid)) as InventoryMovement;
}
