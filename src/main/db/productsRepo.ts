import type Database from 'better-sqlite3';
import type { Product } from '../../shared/types';

export interface ProductInput {
  sku: string;
  barcode?: string | null;
  name: string;
  price_cents: number;
  cost_cents?: number;
  min_stock?: number;
}

function rowToProduct(r: Record<string, unknown>): Product {
  return r as unknown as Product;
}

export function listProducts(
  db: Database.Database,
  opts: { query?: string; onlyActive?: boolean; lowStock?: boolean } = {}
): Product[] {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (opts.onlyActive !== false) conds.push('active = 1');
  if (opts.query && opts.query.trim() !== '') {
    conds.push('(name LIKE ? OR sku LIKE ? OR COALESCE(barcode, \'\') LIKE ?)');
    const q = `%${opts.query.trim()}%`;
    params.push(q, q, q);
  }
  if (opts.lowStock) conds.push('stock <= min_stock');
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM products ${where} ORDER BY name COLLATE NOCASE LIMIT 500`).all(...params) as Record<string, unknown>[];
  return rows.map(rowToProduct);
}

export function findProductById(db: Database.Database, id: number): Product | null {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToProduct(row) : null;
}

export function findProductByCode(db: Database.Database, code: string): Product | null {
  const row = db
    .prepare('SELECT * FROM products WHERE sku = ? OR barcode = ? LIMIT 1')
    .get(code, code) as Record<string, unknown> | undefined;
  return row ? rowToProduct(row) : null;
}

export function createProduct(db: Database.Database, input: ProductInput): Product {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO products (sku, barcode, name, price_cents, cost_cents, stock, min_stock, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)`
    )
    .run(
      input.sku.trim(),
      input.barcode?.trim() ? input.barcode.trim() : null,
      input.name.trim(),
      input.price_cents,
      input.cost_cents ?? 0,
      input.min_stock ?? 0,
      now,
      now
    );
  const created = findProductById(db, Number(info.lastInsertRowid));
  if (!created) throw new Error('No se pudo crear el producto');
  return created;
}

export function updateProduct(
  db: Database.Database,
  id: number,
  input: Partial<ProductInput> & { active?: number }
): Product {
  const current = findProductById(db, id);
  if (!current) throw Object.assign(new Error('Producto no encontrado'), { code: 'NOT_FOUND' });
  const next = {
    sku: (input.sku ?? current.sku).trim(),
    barcode: input.barcode !== undefined ? (input.barcode?.trim() ? input.barcode.trim() : null) : current.barcode,
    name: (input.name ?? current.name).trim(),
    price_cents: input.price_cents ?? current.price_cents,
    cost_cents: input.cost_cents ?? current.cost_cents,
    min_stock: input.min_stock ?? current.min_stock
  };
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE products SET sku=?, barcode=?, name=?, price_cents=?, cost_cents=?, min_stock=?, updated_at=? WHERE id=?`
  ).run(next.sku, next.barcode, next.name, next.price_cents, next.cost_cents, next.min_stock, now, id);
  const updated = findProductById(db, id);
  if (!updated) throw new Error('No se pudo actualizar el producto');
  return updated;
}

export function setProductActive(db: Database.Database, id: number, active: boolean): Product {
  const current = findProductById(db, id);
  if (!current) throw Object.assign(new Error('Producto no encontrado'), { code: 'NOT_FOUND' });
  if (!active) {
    // Regla 5: con ventas no se elimina; aquí es baja lógica, siempre permitida.
  }
  db.prepare('UPDATE products SET active = ?, updated_at = ? WHERE id = ?').run(
    active ? 1 : 0,
    new Date().toISOString(),
    id
  );
  return findProductById(db, id)!;
}

/** Suma de movimientos por producto (para verificar consistencia). */
export function stockFromMovements(db: Database.Database, productId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(qty), 0) AS s FROM inventory_movements WHERE product_id = ?')
    .get(productId) as { s: number };
  return row.s;
}
