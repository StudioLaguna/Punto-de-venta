import { useEffect, useState } from 'react';
import { api } from '../api';

export function AjustesView() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pin, setPin] = useState('');
  const [backupFile, setBackupFile] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    try { setSettings(await api.settingsGet()); } catch (e) { setMsg((e as Error).message); }
  }
  useEffect(() => { void load(); });

  async function save(key: string, value: string) {
    try {
      await api.settingsSet(key, value);
      setOk(`Guardado ${key}`);
      await load();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="card">
      <h2>Ajustes</h2>
      {msg && <div className="error">{msg}</div>}
      {ok && <div className="success">{ok}</div>}
      <div className="row">
        <label>Negocio <input value={settings.business_name ?? ''} onChange={(e) => setSettings({ ...settings, business_name: e.target.value })} /></label>
        <button className="btn" onClick={() => void save('business_name', settings.business_name ?? '')}>Guardar</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>
          Stock negativo
          <select value={settings.allow_negative_stock ?? '0'} onChange={(e) => void save('allow_negative_stock', e.target.value)}>
            <option value="0">No permitido (defecto)</option>
            <option value="1">Permitido</option>
          </select>
        </label>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>Carpeta respaldo <input value={settings.backup_dir ?? ''} onChange={(e) => setSettings({ ...settings, backup_dir: e.target.value })} style={{ width: 320 }} /></label>
        <button className="btn" onClick={() => void save('backup_dir', settings.backup_dir ?? '')}>Guardar</button>
        <button className="btn secondary" onClick={() => api.backupRun(settings.backup_dir ?? '').then((r) => setOk(`Respaldo: ${r.file}`)).catch((e) => setMsg((e as Error).message))}>
          Respaldar ahora
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input placeholder="Archivo .db para restaurar" value={backupFile} onChange={(e) => setBackupFile(e.target.value)} style={{ width: 320 }} />
        <button className="btn secondary" onClick={() => api.backupRestore(backupFile).then(() => setOk('Restaurado. Reinicia la app.')).catch((e) => setMsg((e as Error).message))}>
          Restaurar
        </button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <label>Nuevo PIN (4-8 dígitos, vacío = quitar) <input value={pin} onChange={(e) => setPin(e.target.value)} /></label>
        <button className="btn" onClick={() => api.setPin(pin).then(() => { setOk('PIN actualizado'); setPin(''); void load(); }).catch((e) => setMsg((e as Error).message))}>
          Guardar PIN
        </button>
        <span>PIN configurado: {settings.pin_configured === '1' ? 'sí' : 'no'}</span>
      </div>
      <p>Moneda: {settings.currency ?? 'MXN'} · Precios con IVA incluido, sin desglose.</p>
    </div>
  );
}
