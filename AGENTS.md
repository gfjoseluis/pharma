# AGENTS.md - FarmaciaPOS

## Regla de oro: reiniciar el sistema despues de cada cambio

Cada vez que se modifique codigo del backend (o se cambie de instancia de
base de datos), el servidor NO queda actualizado por si solo. Hay que
recompilar y reiniciar SIEMPRE con:

```
powershell -ExecutionPolicy Bypass -File .\scripts\restart.ps1
```

Este script:
1. Mata procesos viejos (node dist/server.js, ts-node-dev) y libera los
   puertos 4000 (API) y 5173 (frontend).
2. Regenera el cliente Prisma y aplica migraciones pendientes a la base de
   datos actual (necesario al cambiar de instancia de BD).
3. Compila el backend (tsc -> dist).
4. Levanta backend (`npm start` -> node dist/server.js) y frontend (vite).

Atajos:
- Solo arrancar sin recompilar: `.\scripts\start.ps1` (libera puertos primero).
- En Linux/macOS: `./scripts/start.sh` (igual: libera puertos + migra + arranca).
- Verificar salud: login POST http://localhost:4000/api/auth/login con
  admin/admin123; o GET /api/health si existe.
- Logs backend: backend\logs\server.log

## Errores frecuentes y su causa

- "El puerto 4000 ya esta en uso" / EADDRINUSE: quedo un proceso viejo.
  Solucion: restart.ps1 (o start.ps1) que mata el proceso por puerto.
- Queries que fallan tras cambiar de instancia de BD: el pool de Prisma
  tenia conexiones a la BD anterior. El pool ahora tiene pool_timeout=10s
  (fail fast) y restart.ps1 re-aplica migraciones a la BD nueva.
- Error de DLL "query engine" en Windows: indica un node viejo usando la
  DLL del engine; restart.ps1 mata todos los procesos del backend.

## Puertos y servicios

- Backend API: http://localhost:4000 (node dist/server.js en produccion,
  ts-node-dev en `npm run dev`).
- Frontend: http://localhost:5173 (vite, recarga solo los cambios de
  frontend; no requiere reinicio).
- MySQL: host/puerto/credenciales en backend\.env (DATABASE_URL).

## UI de baja resolucion

El CSS ya incluye un modo compacto automatico (media queries) para
portatiles <= 1366x820: reduce tipografia, sidebar, paddings de tablas,
KPI/stat y modales. No requiere accion; si se quieren retoques, todo vive
en frontend/src/styles.css al final del archivo.