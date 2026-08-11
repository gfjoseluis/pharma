#!/usr/bin/env bash
# Instalacion de FarmaciaPOS (Linux/macOS). En Windows use install.ps1.
set -e
cd "$(dirname "$0")/.."

echo "=============================================="
echo "  FarmaciaPOS - Instalacion"
echo "=============================================="

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js 18+ es requerido. Descarguelo de https://nodejs.org"
  exit 1
fi

echo "[1/4] Instalando dependencias del backend..."
cd backend
npm install

echo "[2/4] Configurando base de datos..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "      Se creo backend/.env - revise las credenciales MySQL."
fi
npm run install:db

echo "[3/4] Instalando dependencias del frontend..."
cd ../frontend
npm install

echo "[4/4] Compilando..."
cd ../backend
npm run build
cd ../frontend
npm run build

echo ""
echo "=============================================="
echo "  Instalacion completada."
echo "  Inicie con: ./scripts/start.sh"
echo "  Usuarios:   admin / admin123  (acceso completo)"
echo "              cajero / cajero123 (solo ventas)"
echo "=============================================="
