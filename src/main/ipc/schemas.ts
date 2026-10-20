import { z } from 'zod';

export const schemas = {
  'products.list': z.object({
    query: z.string().max(200).nullish(),
    onlyActive: z.boolean().nullish(),
    lowStock: z.boolean().nullish()
  }),
  'products.findByCode': z.object({ code: z.string().trim().min(1).max(64) }),
  'products.create': z.object({
    sku: z.string().trim().min(1).max(64),
    barcode: z.string().trim().max(64).nullish(),
    name: z.string().trim().min(1).max(200),
    price_cents: z.number().int().min(0),
    cost_cents: z.number().int().min(0).nullish(),
    min_stock: z.number().int().min(0).nullish()
  }),
  'products.update': z.object({
    id: z.number().int().positive(),
    sku: z.string().trim().min(1).max(64).nullish(),
    barcode: z.string().trim().max(64).nullish(),
    name: z.string().trim().min(1).max(200).nullish(),
    price_cents: z.number().int().min(0).nullish(),
    cost_cents: z.number().int().min(0).nullish(),
    min_stock: z.number().int().min(0).nullish()
  }),
  'products.setActive': z.object({ id: z.number().int().positive(), active: z.boolean() }),
  'inventory.addEntry': z.object({
    productId: z.number().int().positive(),
    qty: z.number().int().positive().max(1_000_000),
    reason: z.string().max(300).nullish()
  }),
  'inventory.adjust': z.object({
    productId: z.number().int().positive(),
    newStock: z.number().int().min(0).max(1_000_000),
    reason: z.string().trim().min(1).max(300)
  }),
  'inventory.movements': z.object({
    productId: z.number().int().positive().nullish(),
    from: z.string().max(32).nullish(),
    to: z.string().max(32).nullish()
  }),
  'sales.create': z.object({
    items: z.array(z.object({ productId: z.number().int().positive(), qty: z.number().int().positive().max(10000) })).min(1),
    paymentMethod: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']),
    receivedCents: z.number().int().min(0).nullish()
  }),
  'sales.void': z.object({ saleId: z.number().int().positive(), reason: z.string().trim().min(1).max(300) }),
  'sales.list': z.object({ from: z.string().min(1), to: z.string().min(1) }),
  'sales.get': z.object({ id: z.number().int().positive() }),
  'reports.daily': z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  'backup.run': z.object({ dir: z.string().min(1) }),
  'backup.restore': z.object({ file: z.string().min(1) }),
  'settings.get': z.object({}),
  'settings.set': z.object({ key: z.string().min(1), value: z.string() }),
  'settings.setPin': z.object({ pin: z.string().max(16) }),
  'settings.verifyPin': z.object({ pin: z.string().max(16) })
};

export type IpcCommand = keyof typeof schemas;
