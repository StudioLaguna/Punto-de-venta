import { useEffect, useState } from 'react';
import { api } from '../api';
import { money, nowRangeForDate, todayISO } from '../format';
import type { Sale, SaleWithItems } from '../../shared/types';

export function HistorialView() {
  const [date, setDate] = useState(todayISO());
  const [list, setList] = useState<Sale[]>([]);
  const [detail, setDetail] = useState<SaleWithItems | null>(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { from, to } = nowRangeForDate(date);
    try {
      setList(await api.listSales(from, to));
    } catch (e) { setMsg((e as Error).message); }
  }
  useEffect(() => { void load(); }, [date]);

  async function open(id: number) {
    setDetail(await api.getSale(id));
  }

  async function doVoid() {
    if (!detail) return;
    try {
      const s = await api.voidSale(detail.id, reason);
      setDetail(s);
      setReason('');
      await load();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="card">
      <h2>Historial de ventas</h2>
      {msg && <div className="error">{msg}</div>}
      <div className="row">
        <label>Fecha <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="btn secondary noprint" onClick={() => void load()}>Actualizar</button>
      </div>
      <table style={{ marginTop: 8 }}>
        <thead><tr><th>Folio</th><th>Hora</th><th>Total</th><th>Método</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {list.map((s) => (
            <tr key={s.id}>
              <td>{s.folio}</td><td>{s.created_at.slice(11, 19)}</td><td>{money(s.total_cents)}</td>
              <td>{s.payment_method}</td><td>{s.status}</td>
              <td><button className="btn secondary" onClick={() => void open(s.id)}>Detalle</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="ticket">
            <h3>Comprobante folio {detail.folio}</h3>
            <p>{detail.created_at}<br />Estado: {detail.status}<br />Método: {detail.payment_method}</p>
            <table>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id}><td>{it.qty}× {it.product_name}</td><td>{money(it.subtotal_cents)}</td></tr>
                ))}
              </tbody>
            </table>
            <p><strong>Total: {money(detail.total_cents)}</strong></p>
            {detail.payment_method === 'EFECTIVO' && (
              <p>Recibido: {money(detail.received_cents ?? 0)} · Cambio: {money(detail.change_cents ?? 0)}</p>
            )}
            {detail.status === 'ANULADA' && <p>Anulada: {detail.void_reason}</p>}
          </div>
          <div className="row noprint" style={{ marginTop: 8 }}>
            <button className="btn secondary" onClick={() => window.print()}>Imprimir / ver</button>
            {detail.status === 'COMPLETADA' && (
              <>
                <input placeholder="Motivo de anulación *" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="btn danger" onClick={() => void doVoid()}>Anular y reponer stock</button>
              </>
            )}
            <button className="btn secondary" onClick={() => setDetail(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
