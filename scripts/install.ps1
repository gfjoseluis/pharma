# Instalacion de FarmaciaPOS para Windows.
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  FarmaciaPOS - Instalacion (Windows)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

node --version | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Node.js 18+ es requerido. Descarguelo de https://nodejs.org" -ForegroundColor Red
  exit 1
}

Write-Host "[1/4] Instalando dependencias del backend..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[2/4] Configurando base de datos..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "      Se creo backend\.env - revise las credenciales MySQL." -ForegroundColor Cyan
}
npm run install:db
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[3/4] Instalando dependencias del frontend..." -ForegroundColor Yellow
Set-Location ..\frontend
npm install
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "[4/4] Compilando..." -ForegroundColor Yellow
Set-Location ..\backend
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }
Set-Location ..\frontend
npm run build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  Instalacion completada." -ForegroundColor Green
Write-Host "  Inicie con: powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1" -ForegroundColor Cyan
Write-Host "  Usuarios:   admin / admin123   (acceso completo)" -ForegroundColor Cyan
Write-Host "              cajero / cajero123 (solo ventas)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Green
