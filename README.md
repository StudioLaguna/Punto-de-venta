# POS Básico — ventas + inventario (offline, una caja)

App de escritorio (Electron + React + TypeScript + SQLite con `better-sqlite3` en WAL).
Dinero en centavos (INTEGER), fechas ISO 8601 UTC (TEXT). Sin red en ningún flujo.

## Requisitos

- Node 20+ (probado con Node 24), npm 10+
- Windows 10/11 para instalador

## Comandos

```powershell
npm install
npm run dev        # Vite + Electron (abre la app; BD en userData)
npm run dev:web    # Solo UI en http://localhost:5173 (sin IPC; muestra aviso)
npm test           # Vitest: productos, inventario, ventas, anulación, reporte
npm run e2e        # Playwright: flujo crear→entrada→vender→anular→reporte
npm run build      # Compila renderer + main a dist/
npm run dist       # Instalador Windows (electron-builder, carpeta release/)
```

E2E con UI: con `npm run dev:web` activo en otra terminal:

```powershell
$env:E2E_WEB=1; npm run e2e
```

## Uso breve

1. **Productos**: alta con SKU único, precio en $, stock mínimo. Desactivar en vez de borrar.
2. **Inventario**: Entrada suma; Ajuste fija stock nuevo con motivo. Todo genera movimiento.
3. **Venta**: campo siempre enfocado; escáner USB (modo teclado) o búsqueda + Enter. F2 buscar, F4 cobrar, Esc cancelar. Efectivo calcula cambio.
4. **Historial**: filtra por fecha, detalle, anulación con motivo (repone stock), `Imprimir` usa `window.print()`.
5. **Reportes**: total del día, # ventas, por método, top productos, stock bajo.
6. **Ajustes**: nombre negocio, stock negativo, carpeta respaldo, respaldar/restaurar, PIN opcional.

Respaldo automático al cerrar si `backup_dir` existe. Restaurar reemplaza `pos.db` (guarda `.prev`).

## Estructura

```
/src/main/db        conexión, migraciones, repositorios SQL
/src/main/services  productos, inventario, ventas, reportes, respaldo, ajustes/PIN
/src/main/ipc       handlers + Zod
/src/preload        contextBridge (window.pos)
/src/renderer       React (features: venta, productos, inventario, reportes, ajustes)
/src/shared         tipos
/migrations         001_init.sql
/tests              Vitest · /tests-e2e Playwright
```

## Reglas

- Precio siempre desde BD en `sales.create`; UI nunca fija precio.
- `products.stock` solo cambia con fila en `inventory_movements` (misma transacción).
- Ventas/anulaciones nunca se borran. `ANULACION_VENTA` revierte exacto.
- Sin `fetch`/red en el código.
