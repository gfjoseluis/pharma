# Inicio de FarmaciaPOS para Windows (abre backend y frontend en consolas separadas).
# Libera los puertos antes de iniciar para evitar EADDRINUSE si quedo un proceso viejo.
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
# Si hubo cambios de codigo o de base de datos, use en su lugar: .\scripts\restart.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Liberando puertos 4000 y 5173 si estan ocupados..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep 1

Write-Host "Iniciando backend en http://localhost:4000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev"

Write-Host "Iniciando frontend en http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host "Ambas consolas abiertas. Presione Ctrl+C en cada una para detener." -ForegroundColor Yellow
