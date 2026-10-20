import { ipcMain } from 'electron';
import { z } from 'zod';
import { getDb } from '../db/connection';
import { productsService } from '../services/productsService';
import { inventoryService } from '../services/inventoryService';
import { salesService } from '../services/salesService';
import { reportsService } from '../services/reportsService';
import { backupService } from '../services/backupService';
import { settingsService } from '../services/settingsService';
import { schemas, type IpcCommand } from './schemas';

function err(code: string, message: string) {
  return { ok: false as const, code, message };
}

function userMessage(e: unknown): { code: string; message: string } {
  if (e instanceof z.ZodError) {
    return { code: 'VALIDACION', message: 'Datos inválidos: ' + e.issues.map((i) => i.message).join('; ') };
  }
  const ex = e as { userCode?: string; message?: string };
  if (ex?.userCode) return { code: ex.userCode, message: ex.message ?? 'Error' };
  return { code: 'ERROR', message: (e as Error)?.message ?? 'Error inesperado' };
}

export function registerIpcHandlers(): void {
  const handlers: Record<IpcCommand, (db: ReturnType<typeof getDb>, input: never) => unknown> = {
    'products.list': (db, input) => {
      const q = (schemas['products.list'] as never as z.ZodType<Record<string, never>>).parse(input);
      return productsService.list(db, q as never);
    },
    'products.findByCode': (db, input) => {
      const { code } = schemas['products.findByCode'].parse(input);
      return productsService.findByCode(db, code);
    },
    'products.create': (db, input) => productsService.create(db, schemas['products.create'].parse(input)),
    'products.update': (db, input) => {
      const { id, ...rest } = schemas['products.update'].parse(input);
      return productsService.update(db, id, rest);
    },
    'products.setActive': (db, input) => {
      const { id, active } = schemas['products.setActive'].parse(input);
      return productsService.setActive(db, id, active);
    },
    'inventory.addEntry': (db, input) =>
      inventoryService.addEntry(db, schemas['inventory.addEntry'].parse(input)),
    'inventory.adjust': (db, input) =>
      inventoryService.adjust(db, schemas['inventory.adjust'].parse(input)),
    'inventory.movements': (db, input) => {
      const q = schemas['inventory.movements'].parse(input);
      return inventoryService.movements(db, {
        productId: q.productId ?? undefined,
        from: q.from ?? undefined,
        to: q.to ?? undefined
      });
    },
    'sales.create': (db, input) => salesService.create(db, schemas['sales.create'].parse(input)),
    'sales.void': (db, input) => salesService.void(db, schemas['sales.void'].parse(input)),
    'sales.list': (db, input) => {
      const { from, to } = schemas['sales.list'].parse(input);
      return salesService.list(db, from, to);
    },
    'sales.get': (db, input) => {
      const { id } = schemas['sales.get'].parse(input);
      return salesService.get(db, id);
    },
    'reports.daily': (db, input) => {
      const { date } = schemas['reports.daily'].parse(input);
      return reportsService.daily(db, date);
    },
    'backup.run': (db, input) => {
      const { dir } = schemas['backup.run'].parse(input);
      return backupService.run(db, dir);
    },
    'backup.restore': (_db, input) => {
      const { file } = schemas['backup.restore'].parse(input);
      return backupService.restore(file);
    },
    'settings.get': (db) => settingsService.getAll(db),
    'settings.set': (db, input) => {
      const { key, value } = schemas['settings.set'].parse(input);
      return settingsService.set(db, key, value);
    },
    'settings.setPin': (db, input) => {
      const { pin } = schemas['settings.setPin'].parse(input);
      return { configured: settingsService.setPin(db, pin) };
    },
    'settings.verifyPin': (db, input) => {
      const { pin } = schemas['settings.verifyPin'].parse(input);
      const ok = settingsService.verifyPin(db, pin);
      return { ok, hasPin: settingsService.hasPin(db) };
    }
  };

  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, input) => {
      try {
        const data = (fn as (db: unknown, input: unknown) => unknown)(getDb(), input ?? {});
        // Respuesta asíncrona de backup (better-sqlite3 backup promise) ya resuelta en servicio.
        if (data instanceof Promise) {
          return { ok: true, data: await data };
        }
        return { ok: true, data };
      } catch (e) {
        const { code, message } = userMessage(e);
        return err(code, message);
      }
    });
  }
}
