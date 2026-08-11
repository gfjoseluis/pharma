# 💊 FarmaciaPOS

Sistema modular de gestión de farmacias: **Node.js + Express + Prisma (MySQL) + React (Vite) + TypeScript**, con arquitectura limpia (controladores → servicios → repositorios, principios SOLID).

## Requisitos
- Node.js 18+
- MySQL 8 (Laragon, XAMPP o standalone)

## Instalación (Windows)

```powershell
# 1. Inicie MySQL (en Laragon: Start All)
# 2. En la raiz del proyecto:
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

El instalador: instala dependencias, crea la base `farmacia`, aplica migraciones, y siembra datos de prueba (productos, stock, usuarios, licencias demo).

## Instalación (Linux/macOS)

```bash
./scripts/install.sh
```

## Inicio

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1

# Linux/macOS
./scripts/start.sh
```

- Backend: http://localhost:4000 (`/api/health`)
- Frontend: http://localhost:5173

## Usuarios de prueba
| Usuario | Contraseña | Acceso |
|---|---|---|
| `admin` | `admin123` | Completo (todos los módulos) |
| `cajero` | `cajero123` | Solo ventas y clientes |

## Licencias (módulos, eternas sin expiración)
Activadas por defecto con códigos demo (ver `Configuración → Licencias`):

| Módulo | Código |
|---|---|
| POS | `POS-1234-ABCD` |
| QR | `QR-4321-WXYZ` |
| FACTURACION | `FAC-5678-EFGH` |
| REPORTES | `REP-9999-MNOP` |
| BACKUPS | `BAK-1111-QRST` |
| INVENTARIO | `INV-2222-UVWX` |

## Módulos
- **Dashboard** — ventas del día, ganancias, stock bajo, lotes por vencer, facturas, gráficos semanal.
- **Inventario** — productos (SKU único con validación/corrección automática), categorías, laboratorios, unidades de medida, proveedores (muchos-a-muchos con productos).
- **Compras** — centralizadas, con lotes/vencimientos y descargo al SIN por factura.
- **Sucursales** — stock por sucursal, distribución desde bodega, transferencias, movimientos.
- **Ventas (POS)** — venta simple (efectivo), QR/tarjeta (solo sucursales mediana/grande) con modal QR y confirmación bancaria, cliente con buscador por nombre/NIT-CI y alta rápida.
- **Facturación SIN** — emisión automática con CUF/código de control, impresión inmediata, anulación (no modificación), descargo mensual.
- **Reportes** — ventas/ganancias diario-semanal-mensual, más vendidos, stock bajo, vencimientos, facturación SIN; exportación CSV/PDF (imprimir).
- **Usuarios** — roles (admin/cajero/técnico), sucursal asignada, permisos por checkbox por módulo.
- **Licencias** — panel de módulos con códigos, middleware `CheckModule`.
- **Backups** — dump `.sql.gz` local, subida a Google Drive (`GOOGLE_APPLICATION_CREDENTIALS` en `backend/.env`), tarea diaria programada:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\backup-task.ps1 -Install
  ```
- **Logs** — rotación diaria (`backend/logs/app-YYYY-MM-DD.log`), acceso solo admin/técnico.

## API principal
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/inventory/{products,suppliers,categories,laboratories,units}`
- `GET /api/inventory/products/search?q=&branchId=`
- `GET/POST/DELETE /api/clients`
- `POST /api/sales`, `GET /api/sales/recent`, `PUT /api/sales/:id`, `DELETE /api/sales/:id`, `POST /api/sales/:id/anular`
- `POST /api/payments/qr/confirm`, `POST /api/payments/card/confirm`
- `GET/POST /api/invoices`, `POST /api/invoices/:id/anular`, `GET /api/invoices/print/:id`, `GET /api/invoices/descargo`
- `GET /api/reports/sales`, `GET /api/reports/inventory`, `GET /api/reports/sin`, `GET /api/reports/export`
- `POST /api/licenses/activate`, `GET /api/licenses`
- `POST /api/backups/force`, `GET /api/backups/status`
- `GET /api/logs`, `GET /api/logs/:filename`

## Estructura
```
backend/src/modules/   → auth, users, clients, inventory, purchases, branches,
                         sales, payments, invoices, reports, licenses, backups, logs
  ├─ routes.ts         → definición de endpoints + middlewares (auth, permisos, CheckModule)
  ├─ controller.ts     → manejo HTTP
  └─ service.ts        → lógica de negocio (facturación SIN)
backend/prisma/        → schema + migraciones
backend/scripts/       → install.ts, migrate.ts, seed.ts
frontend/src/pages/    → una página por módulo
scripts/               → install/start (.sh y .ps1) + backup-task.ps1 (Task Scheduler)
```
