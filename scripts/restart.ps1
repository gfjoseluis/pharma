# restart.ps1 - Reinicio completo y limpio de FarmaciaPOS (Windows).
# Detiene procesos viejos, libera puertos, sincroniza la base de datos
# (prisma generate + migrate deploy), recompila y levanta backend + frontend.
#
# Uso: powershell -ExecutionPolicy Bypass -File .\scripts\restart.ps1
# Esto es lo que hay que hacer cada vez que se cambia codigo o se cambia de
# instancia de base de datos, para evitar errores de puerto/dll/conexion vieja.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$portApi = 4000
$portWeb = 5173

function Stop-Port([int]$port, [string]$label) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    if ($p) {
      Write-Host "  Liberando $label (puerto $port): PID $($p.Id) $($p.ProcessName)" -ForegroundColor Yellow
      Stop-Process -Id $p.Id -Force
    }
  }
}

function Stop-BackendProcesses {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*dist*server.js*" -or $_.CommandLine -like "*ts-node-dev*" -or $_.CommandLine -like "*src/server.ts*" } |
    ForEach-Object {
      Write-Host "  Deteniendo backend (PID $($_.ProcessId))" -ForegroundColor Yellow
      Stop-Process -Id $_.ProcessId -Force
    }
}

Write-Host "=== Reinicio FarmaciaPOS ===" -ForegroundColor Cyan
Write-Host "[1/4] Deteniendo procesos y liberando puertos..."
Stop-BackendProcesses
Stop-Port $portApi "backend"
Stop-Port $portWeb "frontend"
Start-Sleep 2

Set-Location "$root\backend"
Write-Host "[2/4] Sincronizando base de datos (prisma generate + migrate deploy)..."
& npx prisma generate
if ($LASTEXITCODE -ne 0) { throw "prisma generate fallo" }
& npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy fallo" }

Write-Host "[3/4] Compilando backend..."
& npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build fallo" }

Write-Host "[4/4] Iniciando backend y frontend..."
New-Item -ItemType Directory -Force -Path "$root\backend\logs" | Out-Null
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; npm start 2>&1 | Tee-Object -FilePath '$root\backend\logs\server.log'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Listo. API en http://localhost:$portApi  Web en http://localhost:$portWeb" -ForegroundColor Green
Write-Host "Logs del backend: backend\logs\server.log" -ForegroundColor DarkGray