#!/usr/bin/env bash
# Inicio de FarmaciaPOS (Linux/macOS). En Windows use start.ps1.
cd "$(dirname "$0")/.."

PORT="${PORT:-4000}"

echo "Iniciando backend en http://localhost:$PORT ..."
(cd backend && npm run dev) &
BACK_PID=$!

echo "Iniciando frontend en http://localhost:5173 ..."
(cd frontend && npm run dev) &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait
