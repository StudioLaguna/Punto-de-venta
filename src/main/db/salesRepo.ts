import type Database from 'better-sqlite3';
import type { Sale, SaleItem, SaleWithItems } from '../../shared/types';

export function getSale(db: Database.Database, id: number): SaleWithItems | null {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as Sale | undefined;
  if (!sale) return null;
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(id) as SaleItem[];
  return { ...sale, items };
}

export function listSales(db: Database.Database, from: string, to: string): Sale[] {
  return db
    .prepare('SELECT * FROM sales WHERE created_at >= ? AND created_at <= ? ORDER BY folio DESC LIMIT 1000')
    .all(from, to) as Sale[];
}

export function nextFolio(db: Database.Database): number {
  const row = db.prepare('SELECT COALESCE(MAX(folio), 0) + 1 AS f FROM sales').get() as { f: number };
  return row.f;
}
