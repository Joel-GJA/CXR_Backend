param(
    [string]$ProjectPath = (Get-Location).Path,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "=== CXR Data Reset ===" -ForegroundColor Cyan
Write-Host "This will:"
Write-Host "  1. Drop and re-create PostgreSQL schema (if configured)"
Write-Host "  2. Clear all log files"
Write-Host "  3. Reset to clean state"
Write-Host ""

if (-not $Force) {
    $confirm = Read-Host "Are you sure? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# 1. PostgreSQL schema reset
$pgHost = $env:CXR_PG_HOST
$pgPort = $env:CXR_PG_PORT
$pgDb = $env:CXR_PG_DATABASE
$pgUser = $env:CXR_PG_USER

if ($pgHost -and $pgDb) {
    Write-Host "Resetting PostgreSQL schema on $pgHost:$pgPort/$pgDb ..." -NoNewline
    $schemaFile = Join-Path $ProjectPath "tools\persistence\schema.sql"
    if (Test-Path $schemaFile) {
        try {
            $env:PGPASSWORD = $env:CXR_PG_PASSWORD
            & psql -h $pgHost -p $pgPort -U $pgUser -d $pgDb -f $schemaFile 2>$null
            Write-Host " done" -ForegroundColor Green
        } catch {
            Write-Host " failed (psql not available or connection error)" -ForegroundColor Yellow
        }
    } else {
        Write-Host " schema file not found at $schemaFile" -ForegroundColor Yellow
    }
} else {
    Write-Host "PostgreSQL not configured (set CXR_PG_HOST, CXR_PG_DATABASE). Skipping." -ForegroundColor Gray
}

# 2. Clear logs
$logDirs = @(
    Join-Path $ProjectPath "logs",
    Join-Path $ProjectPath "..\XRSP\host-manager\logs",
    Join-Path $ProjectPath "..\XRSP\registry"
)

foreach ($dir in $logDirs) {
    if (Test-Path $dir) {
        $logFiles = Get-ChildItem $dir -Filter "*.log" -File
        if ($logFiles.Count -gt 0) {
            $logFiles | Remove-Item -Force
            Write-Host "Cleared $($logFiles.Count) log file(s) from $dir" -ForegroundColor Green
        } else {
            Write-Host "No log files in $dir" -ForegroundColor Gray
        }
    }
}

# 3. Clear persistent data files
$dataFiles = @(
    Join-Path $ProjectPath "cxr_runtime_events.jsonl",
    Join-Path $ProjectPath "cxr_runtime_metrics.prom"
)
foreach ($f in $dataFiles) {
    if (Test-Path $f) {
        Remove-Item -Force $f
        Write-Host "Removed $f" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Reset complete. Environment is clean." -ForegroundColor Cyan
