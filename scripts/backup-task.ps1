# =============================================================
#  Backup automatico diario de FarmaciaPOS (Windows Task Scheduler)
#  - Hace dump de MySQL, lo comprime y lo sube a Google Drive.
#  - Escribe logs en backend\logs\backup-task-YYYY-MM-DD.log
#  Instalacion (una vez):
#    powershell -ExecutionPolicy Bypass -File scripts\backup-task.ps1 -Install
#  Ejecucion manual:
#    powershell -ExecutionPolicy Bypass -File scripts\backup-task.ps1
# =============================================================
param(
  [switch]$Install,
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$logDir = Join-Path $ProjectRoot "backend\logs"
$backupDir = Join-Path $ProjectRoot "backend\backups"
New-Item -ItemType Directory -Force -Path $logDir, $backupDir | Out-Null
$logFile = Join-Path $logDir ("backup-task-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Write-Log($msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
  Add-Content -Path $logFile -Value $line
  Write-Host $line
}

function Load-Env([string]$path) {
  if (-not (Test-Path $path)) { return @{} }
  $envVars = @{}
  Get-Content $path | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
      $envVars[$matches[1].Trim()] = $matches[2].Trim('"').Trim()
    }
  }
  return $envVars
}

if ($Install) {
  Write-Log "Instalando tarea programada FarmaciaBackup (diaria 02:00)..."
  $scriptPath = Join-Path $PSScriptRoot "backup-task.ps1"
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -ProjectRoot `"$ProjectRoot`""
  $trigger = New-ScheduledTaskTrigger -Daily -At 20:00
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries
  Register-ScheduledTask -TaskName "FarmaciaBackup" -Action $action -Trigger $trigger -Settings $settings -Description "Backup diario de la base de datos FarmaciaPOS" -Force | Out-Null
  Write-Log "Tarea FarmaciaBackup instalada. Ejecuta diariamente a las 02:00."
  exit 0
}

Write-Log "Iniciando backup automatico..."

$envVars = Load-Env (Join-Path $ProjectRoot "backend\.env")
$dbHost = if ($envVars.DB_HOST) { $envVars.DB_HOST } else { "localhost" }
$dbPort = if ($envVars.DB_PORT) { $envVars.DB_PORT } else { "3306" }
$dbUser = if ($envVars.DB_USER) { $envVars.DB_USER } else { "root" }
$dbPassword = if ($envVars.DB_PASSWORD) { $envVars.DB_PASSWORD } else { "" }
$dbName = if ($envVars.DB_NAME) { $envVars.DB_NAME } else { "farmacia" }
$credFile = if ($envVars.GOOGLE_APPLICATION_CREDENTIALS) { Join-Path (Join-Path $ProjectRoot "backend") $envVars.GOOGLE_APPLICATION_CREDENTIALS } else { $envVars.GOOGLE_APPLICATION_CREDENTIALS }
$folderId = if ($envVars.GOOGLE_DRIVE_FOLDER_ID) { $envVars.GOOGLE_DRIVE_FOLDER_ID } else { "" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$sqlFile = Join-Path $backupDir ("farmacia-{0}.sql" -f $stamp)
$gzFile = "$sqlFile.gz"

try {
  Write-Log "Dump de MySQL ($dbName)..."
  $env:MYSQL_PWD = $dbPassword
  & mysqldump "--host=$dbHost" "--port=$dbPort" "--user=$dbUser" $dbName | Out-File -FilePath $sqlFile -Encoding utf8
  if (-not (Test-Path $sqlFile) -or (Get-Item $sqlFile).Length -eq 0) { throw "El dump quedo vacio" }
  Write-Log "Dump OK: $((Get-Item $sqlFile).Length) bytes"
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue

  Write-Log "Comprimiendo..."
  $input = [System.IO.File]::OpenRead($sqlFile)
  $output = [System.IO.File]::Create($gzFile)
  $gzip = New-Object System.IO.Compression.GZipStream($output, [System.IO.Compression.CompressionMode]::Compress)
  $input.CopyTo($gzip)
  $gzip.Close(); $output.Close(); $input.Close()
  Remove-Item $sqlFile -Force
  Write-Log "Comprimido OK: $((Get-Item $gzFile).Length) bytes"

  if ($credFile -and (Test-Path $credFile)) {
    Write-Log "Subiendo a Google Drive..."
    # Reutiliza el backend: endpoint de backup (debe estar corriendo el servidor) o Node directo
    $backendDir = Join-Path $ProjectRoot "backend"
    & node -e "
      const { google } = require('googleapis');
      const fs = require('fs');
      const path = require('path');
      (async () => {
        const auth = new google.auth.GoogleAuth({ keyFile: process.argv[1], scopes: ['https://www.googleapis.com/auth/drive.file'] });
        const drive = google.drive({ version: 'v3', auth });
        const file = process.argv[2];
        const folder = process.argv[3];
        const res = await drive.files.create({ requestBody: { name: path.basename(file), parents: folder ? [folder] : undefined }, media: { body: fs.createReadStream(file) }, fields: 'id,name' });
        console.log('DRIVE_FILE_ID:' + res.data.id);
      })().catch(e => { console.error(e.message); process.exit(1); });
    " $credFile $gzFile $folderId
    if ($LASTEXITCODE -ne 0) { throw "Fallo la subida a Google Drive" }
    Write-Log "Subido a Google Drive OK"
  } else {
    Write-Log "Google Drive no configurado (GOOGLE_APPLICATION_CREDENTIALS). Solo backup local."
  }

  Write-Log "Backup completado con exito."
} catch {
  Write-Log ("ERROR: " + $_.Exception.Message)
  Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
  exit 1
}
