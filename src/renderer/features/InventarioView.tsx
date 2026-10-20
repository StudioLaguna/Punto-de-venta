import { useEffect, useState } from 'react';
import { api } from '../api';
import type { InventoryMovement, Product } from '../../shared/types';

export function InventarioView() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [moves, setMoves] = useState<InventoryMovement[]>([]);
  const [entryQty, setEntryQty] = useState('1');
  const [entryReason, setEntryReason] = useState('');
  const [newStock, setNewStock] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      setList(await api.productsList({ query: q, onlyActive: false }));
    } catch (e) { setMsg((e as Error).message); }
  }
  useEffect(() => { void load(); }, [q]);

  async function select(p: Product) {
    setSelected(p);
    setMoves(await api.movements({ productId: p.id }));
    setNewStock(String(p.stock));
  }

  async function doEntry() {
    if (!selected) return;
    try {
      await api.addEntry({ productId: selected.id, qty: parseInt(entryQty, 10), reason: entryReason || null });
      setEntryReason('');
      await load();
      const fresh = (await api.productsList({ query: selected.sku, onlyActive: false }))[0];
      if (fresh) await select(fresh);
    } catch (e) { setMsg((e as Error).message); }
  }

  async function doAdjust() {
    if (!selected) return;
    try {
      await api.adjust({ productId: selected.id, newStock: parseInt(newStock, 10), reason: adjReason });
      setAdjReason('');
      await load();
      const fresh = (await api.productsList({ query: selected.sku, onlyActive: false }))[0];
      if (fresh) await select(fresh);
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="card">
      <h2>Inventario</h2>
      {msg && <div className="error">{msg}</div>}
      <input placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
      <table style={{ marginTop: 8 }}>
        <thead><tr><th>Producto</th><th>Stock</th><th>Mín</th><th></th></tr></thead>
        <tbody>
          {list.slice(0, 50).map((p) => (
            <tr key={p.id} className={p.stock <= p.min_stock ? 'low' : ''}>
              <td>{p.name} ({p.sku})</td>
              <td>{p.stock}</td>
              <td>{p.min_stock} {p.stock <= p.min_stock && <span className="badge low">BAJO</span>}</td>
              <td><button className="btn secondary" onClick={() => void select(p)}>Ver / mover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <>
          <h3>{selected.name} — stock {selected.stock}</h3>
          <div className="row">
            <label>Entrada cant <input type="number" min="1" value={entryQty} onChange={(e) => setEntryQty(e.target.value)} style={{ width: 90 }} /></label>
            <input placeholder="Motivo (opcional)" value={entryReason} onChange={(e) => setEntryReason(e.target.value)} />
            <button className="btn" onClick={() => void doEntry()}>Registrar entrada</button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label>Nuevo stock <input type="number" min="0" value={newStock} onChange={(e) => setNewStock(e.target.value)} style={{ width: 90 }} /></label>
            <input placeholder="Motivo ajuste *" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} />
            <button className="btn" onClick={() => void doAdjust()}>Ajustar</button>
          </div>
          <h4>Historial</h4>
          <table>
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Motivo</th><th>Venta</th></tr></thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}><td>{m.created_at}</td><td>{m.type}</td><td>{m.qty}</td><td>{m.reason ?? ''}</td><td>{m.sale_id ?? ''}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
