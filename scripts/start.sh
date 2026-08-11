#!/usr/bin/env bash
# Inicio de FarmaciaPOS (Linux/macOS). En Windows use start.ps1.
cd "$(dirname "$0")/.."

PORT="${PORT:-4000}"
FRONT_PORT="5173"

# Función para liberar un puerto si está ocupado
liberar_puerto() {
  local puerto=$1
  # Busca el PID del proceso escuchando en el puerto
local pid=$(lsof -t -i:"$puerto" 2>/dev/null)

  if [ -n "$pid" ]; then
    echo "El puerto $puerto esta ocupado por el PID $pid. Liberando..."
    kill -9 "$pid" 2>/dev/null
    sleep 1 # Breve pausa para asegurar el cierre
  fi
}

echo "Comprobando y liberando puertos ocupados..."
liberar_puerto "$PORT"
liberar_puerto "$FRONT_PORT"

echo "Sincronizando base de datos (prisma generate + migrate deploy)..."
(cd backend && npx prisma generate && npx prisma migrate deploy) || exit 1

echo "Iniciando backend en http://localhost:$PORT ..."
(cd backend && npm run dev) &
BACK_PID=$!

echo "Iniciando frontend en http://localhost:$FRONT_PORT ..."
(cd frontend && npm run dev) &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait
