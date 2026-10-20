import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { money } from '../format';
import type { Product } from '../../shared/types';

interface CartLine { product: Product; qty: number }

export function VentaView() {
  const [code, setCode] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'>('EFECTIVO');
  const [received, setReceived] = useState('');
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [lastFolio, setLastFolio] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyTimes = useRef<number[]>([]);

  const total = cart.reduce((a, l) => a + l.product.price_cents * l.qty, 0);
  const receivedCents = Math.round(Number(received || '0') * 100);
  const change = method === 'EFECTIVO' ? receivedCents - total : 0;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'F4') { e.preventDefault(); void cobrar(); }
      if (e.key === 'Escape') { setCart([]); setMsg(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function search(q: string) {
    setCode(q);
    if (q.trim().length < 2) { setResults([]); return; }
    try {
      const list = await api.productsList({ query: q, onlyActive: true });
      setResults(list.slice(0, 8));
    } catch { /* noop */ }
  }

  function addToCart(p: Product, qty = 1) {
    setCart((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      if (found) return prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + qty } : l));
      return [...prev, { product: p, qty }];
    });
    setCode('');
    setResults([]);
    inputRef.current?.focus();
  }

  /** Detección de escáner: chars rápidos (<50ms) + Enter. */
  function onCodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const now = performance.now();
    keyTimes.current.push(now);
    if (keyTimes.current.length > 30) keyTimes.current.shift();
    if (e.key === 'Enter' && code.trim() !== '') {
      e.preventDefault();
      const times = keyTimes.current;
      let fast = false;
      if (times.length >= 4) {
        const diffs = times.slice(-code.length).map((t, i, arr) => (i === 0 ? 0 : t - arr[i - 1])).slice(1);
        if (diffs.length > 0 && diffs.every((d) => d < 60)) fast = true;
      }
      void scanOrSearch(code.trim(), fast);
      keyTimes.current = [];
    }
  }

  async function scanOrSearch(value: string, _fast: boolean) {
    // Siempre intentar código exacto primero (escaneo), luego búsqueda.
    try {
      const exact = await api.findByCode(value);
      if (exact && exact.active) {
        addToCart(exact, 1);
        return;
      }
    } catch { /* sigue a búsqueda */ }
    if (results.length === 1) { addToCart(results[0]); return; }
    if (results.length > 1) { setMsg({ kind: 'error', text: 'Varios resultados: elige de la lista' }); return; }
    try {
      const list = await api.productsList({ query: value, onlyActive: true });
      if (list.length === 1) addToCart(list[0]);
      else if (list.length > 1) { setResults(list.slice(0, 8)); setMsg({ kind: 'error', text: 'Varios resultados: elige de la lista' }); }
      else setMsg({ kind: 'error', text: 'Producto no encontrado' });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  }

  async function cobrar() {
    setMsg(null);
    if (cart.length === 0) { setMsg({ kind: 'error', text: 'Carrito vacío' }); return; }
    try {
      const t0 = performance.now();
      const sale = await api.createSale({
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
        paymentMethod: method,
        receivedCents: method === 'EFECTIVO' ? receivedCents : undefined
      });
      const ms = Math.round(performance.now() - t0);
      setLastFolio(sale.folio);
      setMsg({ kind: 'success', text: `Venta folio ${sale.folio} registrada (${ms} ms). Total ${money(sale.total_cents)}` });
      setCart([]);
      setReceived('');
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  }

  return (
    <div className="card">
      <h2>Venta (F2 buscar · F4 cobrar · Esc cancelar)</h2>
      {msg && <div className={msg.kind}>{msg.text}</div>}
      {lastFolio !== null && <div className="success">Último folio: {lastFolio}</div>}
      <div className="row">
        <input
          ref={inputRef}
          placeholder="Escanear código o buscar por nombre/SKU… + Enter"
          value={code}
          onChange={(e) => void search(e.target.value)}
          onKeyDown={onCodeKeyDown}
          style={{ flex: 1, minWidth: 280 }}
        />
      </div>
      {results.length > 0 && (
        <table>
          <tbody>
            {results.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{money(p.price_cents)}</td>
                <td>Stock {p.stock}</td>
                <td><button className="btn" onClick={() => addToCart(p)}>Agregar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>Carrito</h3>
      <table>
        <thead><tr><th>Producto</th><th>Precio</th><th>Cant.</th><th>Subtotal</th><th></th></tr></thead>
        <tbody>
          {cart.map((l) => (
            <tr key={l.product.id}>
              <td>{l.product.name}</td>
              <td>{money(l.product.price_cents)}</td>
              <td>
                <input
                  className="cart-qty" type="number" min={1} value={l.qty}
                  onChange={(e) => {
                    const qty = Math.max(1, parseInt(e.target.value || '1', 10));
                    setCart((prev) => prev.map((x) => (x.product.id === l.product.id ? { ...x, qty } : x)));
                  }}
                />
              </td>
              <td>{money(l.product.price_cents * l.qty)}</td>
              <td><button className="btn secondary" onClick={() => setCart((p) => p.filter((x) => x.product.id !== l.product.id))}>Quitar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 12 }}>
        <strong>Total: {money(total)}</strong>
        <label>Método <select value={method} onChange={(e) => setMethod(e.target.value as never)}>
          <option value="EFECTIVO">EFECTIVO</option>
          <option value="TARJETA">TARJETA</option>
          <option value="TRANSFERENCIA">TRANSFERENCIA</option>
        </select></label>
        {method === 'EFECTIVO' && (
          <>
            <label>Recibido $ <input type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} style={{ width: 120 }} /></label>
            <strong>Cambio: {money(Math.max(0, change))}</strong>
          </>
        )}
        <button className="btn" onClick={() => void cobrar()}>Cobrar (F4)</button>
        <button className="btn secondary" onClick={() => setCart([])}>Cancelar (Esc)</button>
      </div>
    </div>
  );
}
