import { useEffect, useState } from 'react';
import { api } from '../api';
import { money, todayISO } from '../format';
import type { DailyReport, Product } from '../../shared/types';

export function ReportesView() {
  const [date, setDate] = useState(todayISO());
  const [rep, setRep] = useState<DailyReport | null>(null);
  const [low, setLow] = useState<Product[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      setRep(await api.daily(date));
      setLow(await api.productsList({ onlyActive: true, lowStock: true }));
    } catch (e) { setMsg((e as Error).message); }
  }
  useEffect(() => { void load(); }, [date]);

  return (
    <div className="card">
      <h2>Reportes</h2>
      {msg && <div className="error">{msg}</div>}
      <div className="row">
        <label>Fecha <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="btn secondary" onClick={() => void load()}>Actualizar</button>
      </div>
      {rep && (
        <>
          <h3>Ventas del {rep.date}: {money(rep.total_cents)} ({rep.count} ventas)</h3>
          <table>
            <thead><tr><th>Método</th><th>Ventas</th><th>Total</th></tr></thead>
            <tbody>
              {rep.byMethod.map((b) => (
                <tr key={b.method}><td>{b.method}</td><td>{b.count}</td><td>{money(b.total_cents)}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>Top productos</h3>
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>Total</th></tr></thead>
            <tbody>
              {rep.topProducts.map((t) => (
                <tr key={t.product_id}><td>{t.product_name}</td><td>{t.qty}</td><td>{money(t.total_cents)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>Stock bajo ({low.length})</h3>
      <table>
        <tbody>
          {low.map((p) => (
            <tr key={p.id} className="low"><td>{p.name}</td><td>{p.sku}</td><td>{p.stock} / mín {p.min_stock}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
