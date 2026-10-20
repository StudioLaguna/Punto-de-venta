import { useEffect, useState } from 'react';
import { api } from '../api';
import { money } from '../format';
import type { Product } from '../../shared/types';

const empty = { sku: '', barcode: '', name: '', price: '', cost: '', min: '' };

export function ProductosView() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      setList(await api.productsList({ query: q, onlyActive: !showInactive ? true : undefined }));
    } catch (e) { setMsg((e as Error).message); }
  }
  useEffect(() => { void load(); }, [q, showInactive]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const payload = {
      sku: form.sku,
      barcode: form.barcode || null,
      name: form.name,
      price_cents: Math.round(Number(form.price || '0') * 100),
      cost_cents: Math.round(Number(form.cost || '0') * 100),
      min_stock: parseInt(form.min || '0', 10)
    };
    try {
      if (editing) await api.updateProduct({ id: editing, ...payload });
      else await api.createProduct(payload);
      setForm(empty); setEditing(null);
      await load();
    } catch (err) { setMsg((err as Error).message); }
  }

  function edit(p: Product) {
    setEditing(p.id);
    setForm({
      sku: p.sku, barcode: p.barcode ?? '', name: p.name,
      price: String(p.price_cents / 100), cost: String(p.cost_cents / 100), min: String(p.min_stock)
    });
  }

  return (
    <div className="card">
      <h2>Productos</h2>
      {msg && <div className="error">{msg}</div>}
      <div className="row">
        <input placeholder="Buscar por nombre, SKU o código…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <label><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Ver inactivos</label>
      </div>
      <form onSubmit={(e) => void save(e)} style={{ marginTop: 12 }}>
        <h3>{editing ? `Editar #${editing}` : 'Nuevo producto'}</h3>
        <div className="row">
          <input placeholder="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <input placeholder="Código barras" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          <input placeholder="Nombre *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ flex: 1 }} />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label>Precio $ <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          <label>Costo $ <input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label>
          <label>Stock mín <input type="number" min="0" value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} /></label>
          <button className="btn" type="submit">{editing ? 'Guardar' : 'Agregar'}</button>
          {editing && <button type="button" className="btn secondary" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</button>}
        </div>
      </form>
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>SKU</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className={p.stock <= p.min_stock ? 'low' : ''}>
              <td>{p.sku}</td><td>{p.name}</td><td>{money(p.price_cents)}</td>
              <td>{p.stock} (mín {p.min_stock}) {p.stock <= p.min_stock && <span className="badge low">BAJO</span>}</td>
              <td>{p.active ? 'Activo' : 'Inactivo'}</td>
              <td>
                <div className="row">
                  <button className="btn secondary" onClick={() => edit(p)}>Editar</button>
                  <button className="btn secondary" onClick={() => void api.setActive(p.id, !p.active).then(() => void load())}>
                    {p.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
