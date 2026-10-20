import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;
let dbPath = '';

export function getDbPath(): string {
  return dbPath;
}

export function resolveNativeBinding(): string | undefined {
  // `bindings` resuelve por stack del llamador y falla bajo transformadores
  // (Playwright/vite-node). Pasamos la ruta explícita como `nativeBinding`.
  const candidates: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const req = require as unknown as { resolve?: (p: string) => string };
    if (req.resolve) {
      for (const p of ['better-sqlite3/build/Release/better_sqlite3.node']) {
        try {
          candidates.push(req.resolve(p));
        } catch {
          /* noop */
        }
      }
    }
  } catch {
    /* noop */
  }
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(dir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'));
    dir = path.dirname(dir);
  }
  candidates.push(path.join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'));
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      /* noop */
    }
  }
  return undefined;
}

export function openDatabase(filePath: string): Database.Database {
  if (db) return db;
  dbPath = filePath;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const nativeBinding = resolveNativeBinding();
  db = new Database(filePath, nativeBinding ? { nativeBinding } : undefined);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  seedDefaults(db);
  return db;
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Base de datos no abierta');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close();
    } catch {
      /* noop */
    }
    db = null;
  }
}

/** Reabre tras restauración. */
export function reopenDatabase(): Database.Database {
  if (!dbPath) throw new Error('Sin ruta de BD');
  db = null;
  return openDatabase(dbPath);
}

function migrationsDir(): string {
  // dev: <root>/migrations ; prod: resources/migrations o dist al lado
  const candidates = [
    path.join(process.cwd(), 'migrations'),
    path.join(__dirname, '..', '..', '..', 'migrations'),
    path.join((process as unknown as { resourcesPath?: string }).resourcesPath ?? '', 'migrations')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function embeddedMigrations(): { version: number; sql: string }[] {
  // Fallback por si los archivos no se empaquetaron: lee 001_init.sql si existe,
  // si no, usa el esquema mínimo embebido (idéntico al archivo).
  const dir = migrationsDir();
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    : [];
  if (files.length > 0) {
    return files.map((f) => ({
      version: parseInt(f.split('_')[0], 10),
      sql: fs.readFileSync(path.join(dir, f), 'utf8')
    }));
  }
  return [];
}

export function runMigrations(database: Database.Database): void {
  database.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`
  );
  const applied = new Set(
    (database.prepare('SELECT version FROM _migrations').all() as { version: number }[]).map(
      (r) => r.version
    )
  );
  const now = new Date().toISOString();
  for (const m of embeddedMigrations()) {
    if (applied.has(m.version)) continue;
    const tx = database.transaction(() => {
      database.exec(m.sql);
      database.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)').run(m.version, now);
    });
    tx();
  }
}

function seedDefaults(database: Database.Database): void {
  const defaults: Record<string, string> = {
    business_name: 'Mi Negocio',
    currency: 'MXN',
    allow_negative_stock: '0',
    backup_dir: '',
    pin_hash: ''
  };
  const insert = database.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  const tx = database.transaction(() => {
    for (const [k, v] of Object.entries(defaults)) insert.run(k, v);
  });
  tx();
}
