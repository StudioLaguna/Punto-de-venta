// Tipos compartidos main <-> renderer. Dinero en centavos, fechas ISO UTC.

export type PaymentMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
export type MovementType = 'ENTRADA' | 'AJUSTE' | 'VENTA' | 'ANULACION_VENTA';
export type SaleStatus = 'COMPLETADA' | 'ANULADA';

export interface Product {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  price_cents: number;
  cost_cents: number;
  stock: number;
  min_stock: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  type: MovementType;
  qty: number;
  reason: string | null;
  sale_id: number | null;
  created_at: string;
}

export interface Sale {
  id: number;
  folio: number;
  total_cents: number;
  payment_method: PaymentMethod;
  received_cents: number | null;
  change_cents: number | null;
  status: SaleStatus;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  unit_price_cents: number;
  qty: number;
  subtotal_cents: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface DailyReport {
  date: string;
  total_cents: number;
  count: number;
  byMethod: { method: PaymentMethod; total_cents: number; count: number }[];
  topProducts: { product_id: number; product_name: string; qty: number; total_cents: number }[];
}

export interface IpcError {
  ok: false;
  code: string;
  message: string;
}

export type IpcResult<T> = { ok: true; data: T } | IpcError;
