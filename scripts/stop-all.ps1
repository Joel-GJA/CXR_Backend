param(
    [string]$RegistryPort = "8080",
    [string]$HostManagerPort = "3000",
    [string]$CxrToolPort = "9090"
)

$ErrorActionPreference = "SilentlyContinue"
Write-Host "=== CXR Development Environment Shutdown ===" -ForegroundColor Cyan

# Stop by port
$ports = @(
    @{ Name = "Registry"; Port = $RegistryPort },
    @{ Name = "Host Manager"; Port = $HostManagerPort },
    @{ Name = "CXR Tool"; Port = $CxrToolPort }
)

foreach ($svc in $ports) {
    $conn = netstat -ano | Select-String "LISTENING" | Select-String ":$($svc.Port) "
    if ($conn) {
        $parts = $conn.Line -split '\s+'
        $pid = $parts[-1]
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "  Stopped $($svc.Name) (PID: $pid, Port: $($svc.Port))" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to stop $($svc.Name) on port $($svc.Port): $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  $($svc.Name) not running on port $($svc.Port)" -ForegroundColor Gray
    }
}

# Kill any remaining Unity headless processes
$unityProcs = Get-Process | Where-Object { $_.ProcessName -like "*CXR*" -or $_.CommandLine -like "*cxr-headless*" } 2>$null
if ($unityProcs) {
    $unityProcs | Stop-Process -Force
    Write-Host "  Stopped Unity headless processes" -ForegroundColor Green
}

# Kill any background PowerShell jobs
Get-Job | Stop-Job 2>$null | Remove-Job 2>$null

Write-Host "All services stopped." -ForegroundColor Cyan
