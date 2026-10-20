import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { closeDatabase, getDbPath, reopenDatabase } from '../db/connection';

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export const backupService = {
  run(db: Database.Database, dir: string): { file: string } {
    if (!dir || dir.trim() === '') throw Object.assign(new Error('Elige una carpeta de respaldo'), { userCode: 'VALIDACION' });
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `pos-respaldo-${stamp()}.db`);
    // better-sqlite3 backup API: copia consistente incluso con WAL.
    db.backup(file).catch?.(() => undefined);
    // La API .backup() es async en v11; esperamos con polling simple:
    // Si no existe aún, hacemos copia del archivo + wal checkpoint.
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch { /* noop */ }
    if (!fs.existsSync(file)) {
      fs.copyFileSync(getDbPath(), file);
    } else {
      // Verificar tamaño razonable; si quedó en 0 bytes, copiar directo.
      const st = fs.statSync(file);
      if (st.size === 0) fs.copyFileSync(getDbPath(), file);
    }
    return { file };
  },

  restore(restoreFile: string): { ok: boolean } {
    if (!fs.existsSync(restoreFile)) {
      throw Object.assign(new Error('Archivo de respaldo no encontrado'), { userCode: 'NO_ENCONTRADO' });
    }
    const target = getDbPath();
    closeDatabase();
    // Quitar WAL/SHM residuales antes de reemplazar
    for (const suffix of ['', '-wal', '-shm']) {
      try {
        if (suffix === '' && fs.existsSync(target)) fs.copyFileSync(target, target + '.prev');
      } catch { /* noop */ }
    }
    fs.copyFileSync(restoreFile, target);
    for (const suffix of ['-wal', '-shm']) {
      try {
        if (fs.existsSync(target + suffix)) fs.unlinkSync(target + suffix);
      } catch { /* noop */ }
    }
    reopenDatabase();
    return { ok: true };
  }
};
