# Inicio de FarmaciaPOS para Windows (abre backend y frontend en consolas separadas).
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Iniciando backend en http://localhost:4000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm run dev"

Write-Host "Iniciando frontend en http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host "Ambas consolas abiertas. Presione Ctrl+C en cada una para detener." -ForegroundColor Yellow
