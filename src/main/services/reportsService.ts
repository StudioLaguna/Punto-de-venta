import type Database from 'better-sqlite3';
import type { DailyReport, PaymentMethod } from '../../shared/types';
import { listProducts } from '../db/productsRepo';

export const reportsService = {
  daily(db: Database.Database, date: string): DailyReport {
    // date: YYYY-MM-DD (zona local del negocio). Filtramos por prefijo UTC simple:
    // aceptamos que created_at es ISO UTC; el reporte usa el día UTC. Documentado en DECISIONES.
    const from = `${date}T00:00:00.000Z`;
    const to = `${date}T23:59:59.999Z`;
    const sales = db
      .prepare(`SELECT * FROM sales WHERE created_at >= ? AND created_at <= ? AND status = 'COMPLETADA'`)
      .all(from, to) as { payment_method: PaymentMethod; total_cents: number }[];
    const total_cents = sales.reduce((a, s) => a + s.total_cents, 0);
    const byMap = new Map<PaymentMethod, { total_cents: number; count: number }>();
    for (const s of sales) {
      const e = byMap.get(s.payment_method) ?? { total_cents: 0, count: 0 };
      e.total_cents += s.total_cents;
      e.count += 1;
      byMap.set(s.payment_method, e);
    }
    const top = db
      .prepare(
        `SELECT si.product_id, si.product_name, SUM(si.qty) AS qty, SUM(si.subtotal_cents) AS total_cents
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE s.created_at >= ? AND s.created_at <= ? AND s.status = 'COMPLETADA'
         GROUP BY si.product_id, si.product_name ORDER BY qty DESC LIMIT 10`
      )
      .all(from, to) as { product_id: number; product_name: string; qty: number; total_cents: number }[];
    return {
      date,
      total_cents,
      count: sales.length,
      byMethod: [...byMap.entries()].map(([method, v]) => ({ method, ...v })),
      topProducts: top
    };
  },
  lowStock(db: Database.Database) {
    return listProducts(db, { onlyActive: true, lowStock: true });
  }
};
