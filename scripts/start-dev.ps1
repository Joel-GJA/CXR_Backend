param(
    [string]$ProjectPath = (Get-Location).Path,
    [string]$RegistryPort = "8080",
    [string]$HostManagerPort = "3000",
    [string]$CxrToolPort = "9090"
)

$ErrorActionPreference = "Stop"
Write-Host "=== CXR Development Environment Startup ===" -ForegroundColor Cyan
Write-Host "Project: $ProjectPath"
Write-Host ""

# Resolve tool paths
$toolsDir = Join-Path $ProjectPath "tools"
$registryDir = Join-Path $toolsDir "room-registry"
$hostManagerDir = Join-Path $toolsDir "host-manager"
$cxrToolDir = Join-Path $ProjectPath "..\XRSP\cxr-tool"

if (-not (Test-Path $registryDir)) { $registryDir = Join-Path $ProjectPath "..\XRSP\registry" }
if (-not (Test-Path $hostManagerDir)) { $hostManagerDir = Join-Path $ProjectPath "..\XRSP\host-manager" }
if (-not (Test-Path $cxrToolDir)) { $cxrToolDir = $null }

$env:CXR_REGISTRY_PORT = $RegistryPort
$env:CXR_HOST_MANAGER_PORT = $HostManagerPort
$env:CXR_TOOL_PORT = $CxrToolPort
$env:CXR_PROFILE = "development"

# Start registry
if (Test-Path (Join-Path $registryDir "server.js")) {
    $regLog = Join-Path $ProjectPath "logs\registry.log"
    Write-Host "Starting Registry on port $RegistryPort ..." -NoNewline
    $regJob = Start-Job -ScriptBlock {
        param($d, $f) Set-Location $d; node server.js *>$f
    } -ArgumentList $registryDir, $regLog
    Start-Sleep 1
    Write-Host " PID: $($regJob.Id)" -ForegroundColor Green
}

# Start host-manager
if (Test-Path (Join-Path $hostManagerDir "server.js")) {
    $hmLog = Join-Path $ProjectPath "logs\host-manager.log"
    Write-Host "Starting Host Manager on port $HostManagerPort ..." -NoNewline
    $hmJob = Start-Job -ScriptBlock {
        param($d, $f) Set-Location $d; node server.js *>$f
    } -ArgumentList $hostManagerDir, $hmLog
    Start-Sleep 2
    Write-Host " PID: $($hmJob.Id)" -ForegroundColor Green
}

# Start cxr-tool sidecar
if ($cxrToolDir -and (Test-Path (Join-Path $cxrToolDir "src\server.js"))) {
    $toolLog = Join-Path $ProjectPath "logs\cxr-tool.log"
    Write-Host "Starting CXR Tool on port $CxrToolPort ..." -NoNewline
    $toolJob = Start-Job -ScriptBlock {
        param($d, $f) Set-Location $d; node src/server.js *>$f
    } -ArgumentList $cxrToolDir, $toolLog
    Start-Sleep 1
    Write-Host " PID: $($toolJob.Id)" -ForegroundColor Green
}

Write-Host ""
Write-Host "All services started. Verify:" -ForegroundColor Cyan
Write-Host "  Registry:      http://localhost:$RegistryPort/health"
Write-Host "  Host Manager:  http://localhost:$HostManagerPort/health"
if ($cxrToolDir) {
    Write-Host "  CXR Tool:      http://localhost:$CxrToolPort/health"
    Write-Host "  Metrics:       http://localhost:$CxrToolPort/metrics"
}
Write-Host ""
Write-Host "Run .\scripts\stop-all.ps1 to shut down." -ForegroundColor Yellow
