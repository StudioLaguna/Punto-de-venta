export function money(cents: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(cents / 100);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowRangeForDate(date: string): { from: string; to: string } {
  return { from: `${date}T00:00:00.000Z`, to: `${date}T23:59:59.999Z` };
}
