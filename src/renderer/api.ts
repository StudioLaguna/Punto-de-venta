import type { IpcResult } from '../shared/types';

async function invoke<T>(channel: string, input?: unknown): Promise<T> {
  const w = window as unknown as { pos?: { invoke: <X>(c: string, i?: unknown) => Promise<IpcResult<X>> } };
  if (!w.pos) {
    throw new Error('La app debe ejecutarse en Electron (window.pos no disponible). Usa `npm run dev`.');
  }
  const res = await w.pos.invoke<T>(channel, input ?? {});
  if (!res.ok) {
    const err = new Error(res.message) as Error & { code?: string };
    err.code = res.code;
    throw err;
  }
  return (res as { ok: true; data: T }).data;
}

export const api = {
  productsList: (q: { query?: string; onlyActive?: boolean; lowStock?: boolean }) =>
    invoke<import('../shared/types').Product[]>('products.list', q),
  findByCode: (code: string) =>
    invoke<import('../shared/types').Product | null>('products.findByCode', { code }),
  createProduct: (d: unknown) => invoke<import('../shared/types').Product>('products.create', d),
  updateProduct: (d: unknown) => invoke<import('../shared/types').Product>('products.update', d),
  setActive: (id: number, active: boolean) =>
    invoke<import('../shared/types').Product>('products.setActive', { id, active }),
  addEntry: (d: unknown) => invoke<unknown>('inventory.addEntry', d),
  adjust: (d: unknown) => invoke<unknown>('inventory.adjust', d),
  movements: (d: unknown) => invoke<import('../shared/types').InventoryMovement[]>('inventory.movements', d),
  createSale: (d: unknown) => invoke<import('../shared/types').SaleWithItems>('sales.create', d),
  voidSale: (saleId: number, reason: string) =>
    invoke<import('../shared/types').SaleWithItems>('sales.void', { saleId, reason }),
  listSales: (from: string, to: string) => invoke<import('../shared/types').Sale[]>('sales.list', { from, to }),
  getSale: (id: number) => invoke<import('../shared/types').SaleWithItems | null>('sales.get', { id }),
  daily: (date: string) => invoke<import('../shared/types').DailyReport>('reports.daily', { date }),
  backupRun: (dir: string) => invoke<{ file: string }>('backup.run', { dir }),
  backupRestore: (file: string) => invoke<{ ok: boolean }>('backup.restore', { file }),
  settingsGet: () => invoke<Record<string, string>>('settings.get', {}),
  settingsSet: (key: string, value: string) => invoke<string>('settings.set', { key, value }),
  setPin: (pin: string) => invoke<{ configured: boolean }>('settings.setPin', { pin }),
  verifyPin: (pin: string) => invoke<{ ok: boolean; hasPin: boolean }>('settings.verifyPin', { pin })
};
