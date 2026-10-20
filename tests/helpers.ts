import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { openDatabase, closeDatabase } from '../src/main/db/connection';
import { productsService } from '../src/main/services/productsService';

export function createTestDb(): Database.Database {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-test-'));
  closeDatabase();
  return openDatabase(path.join(dir, 'test.db'));
}

let n = 0;
export function productFixture(db: Database.Database, overrides: Record<string, unknown> = {}) {
  n += 1;
  const rnd = `${Date.now() % 100000}${n}${Math.floor(Math.random() * 1000)}`;
  return productsService.create(db, {
    sku: `SKU-${rnd}`,
    barcode: null,
    name: `Producto ${rnd}`,
    price_cents: 1000,
    cost_cents: 500,
    min_stock: 2,
    ...overrides
  });
}
