import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import { getSetting, setSetting } from '../db/settingsRepo';

export const settingsService = {
  getAll(db: Database.Database) {
    const keys = ['business_name', 'currency', 'allow_negative_stock', 'backup_dir'];
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = getSetting(db, k) ?? '';
    out['pin_configured'] = (getSetting(db, 'pin_hash') ?? '') !== '' ? '1' : '0';
    return out;
  },
  set(db: Database.Database, key: string, value: string) {
    const allowed = ['business_name', 'currency', 'allow_negative_stock', 'backup_dir'];
    if (!allowed.includes(key)) throw Object.assign(new Error('Ajuste no permitido'), { userCode: 'VALIDACION' });
    if (key === 'allow_negative_stock' && value !== '0' && value !== '1') {
      throw Object.assign(new Error('Valor inválido'), { userCode: 'VALIDACION' });
    }
    setSetting(db, key, value);
    return value;
  },
  setPin(db: Database.Database, pin: string | null) {
    if (pin === null || pin === '') {
      setSetting(db, 'pin_hash', '');
      return false;
    }
    if (!/^\d{4,8}$/.test(pin)) {
      throw Object.assign(new Error('El PIN debe tener de 4 a 8 dígitos'), { userCode: 'VALIDACION' });
    }
    setSetting(db, 'pin_hash', crypto.createHash('sha256').update(pin).digest('hex'));
    return true;
  },
  verifyPin(db: Database.Database, pin: string): boolean {
    const hash = getSetting(db, 'pin_hash') ?? '';
    if (!hash) return true; // sin PIN configurado: acceso libre
    return crypto.createHash('sha256').update(pin).digest('hex') === hash;
  },
  hasPin(db: Database.Database): boolean {
    return (getSetting(db, 'pin_hash') ?? '') !== '';
  }
};
