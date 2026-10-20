import { useEffect, useState } from 'react';
import { api } from './api';
import { VentaView } from './features/VentaView';
import { ProductosView } from './features/ProductosView';
import { InventarioView } from './features/InventarioView';
import { HistorialView } from './features/HistorialView';
import { ReportesView } from './features/ReportesView';
import { AjustesView } from './features/AjustesView';

type Tab = 'venta' | 'productos' | 'inventario' | 'historial' | 'reportes' | 'ajustes';

export function App() {
  const [tab, setTab] = useState<Tab>('venta');
  const [locked, setLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.verifyPin('').then((r) => {
      setHasPin(r.hasPin);
      setLocked(r.hasPin);
    }).catch(() => undefined);
  }, []);

  async function unlock() {
    try {
      const r = await api.verifyPin(pin);
      if (r.ok) { setLocked(false); setErr(null); }
      else setErr('PIN incorrecto');
    } catch (e) { setErr((e as Error).message); }
  }

  if (locked) {
    return (
      <div className="card lock">
        <h2>POS Básico — PIN</h2>
        {err && <div className="error">{err}</div>}
        <div className="row">
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void unlock(); }} placeholder="PIN" autoFocus />
          <button className="btn" onClick={() => void unlock()}>Entrar</button>
        </div>
        {hasPin === false && <p>Sin PIN configurado.</p>}
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <h1>POS Básico</h1>
        <nav className="tabs">
          {(['venta', 'productos', 'inventario', 'historial', 'reportes', 'ajustes'] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'venta' && <VentaView />}
        {tab === 'productos' && <ProductosView />}
        {tab === 'inventario' && <InventarioView />}
        {tab === 'historial' && <HistorialView />}
        {tab === 'reportes' && <ReportesView />}
        {tab === 'ajustes' && <AjustesView />}
      </main>
    </>
  );
}
