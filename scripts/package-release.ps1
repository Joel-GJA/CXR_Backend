param(
    [Parameter(Mandatory = $true)]
    [string]$BuildsPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [string]$Version = "1.0.0",

    [switch]$IncludeSDK,

    [string]$SDKPath = "Assets/Multiplayer/SDK",

    [string]$UnityPath = "C:\Program Files\Unity\Hub\Editor\6000.0.23f1\Editor\Unity.exe"
)

$ErrorActionPreference = "Stop"

$null = New-Item -ItemType Directory -Path $OutputPath -Force

# Package headless build
$headlessBuild = Join-Path $BuildsPath "headless"
if (Test-Path $headlessBuild) {
    $tarFile = Join-Path $OutputPath "CXR_Server-v$Version.tar.gz"
    Write-Host "Packaging headless build -> $tarFile"
    if ($IsWindows) {
        tar -czf $tarFile -C $headlessBuild .
    } else {
        tar -czf $tarFile -C $headlessBuild .
    }
    Write-Host "  Done: $((Get-Item $tarFile).Length / 1MB) MB" -ForegroundColor Green
}

# Package client build
$clientBuild = Join-Path $BuildsPath "client"
if (Test-Path $clientBuild) {
    $tarFile = Join-Path $OutputPath "CXR_Client-v$Version.tar.gz"
    Write-Host "Packaging client build -> $tarFile"
    if ($IsWindows) {
        tar -czf $tarFile -C $clientBuild .
    } else {
        tar -czf $tarFile -C $clientBuild .
    }
    Write-Host "  Done: $((Get-Item $tarFile).Length / 1MB) MB" -ForegroundColor Green
}

# Package tools (scripts + docs)
$toolsZip = Join-Path $OutputPath "cxr-tools-v$Version.zip"
Write-Host "Packaging tools -> $toolsZip"
if (Test-Path "scripts") { Compress-Archive -Path "scripts" -DestinationPath $toolsZip -Force }
if (Test-Path "docs") { Compress-Archive -Path "docs" -DestinationPath $toolsZip -Update }
Write-Host "  Done" -ForegroundColor Green

# Export SDK as Unity package
if ($IncludeSDK -and (Test-Path $SDKPath) -and (Test-Path $UnityPath)) {
    $sdkPackage = Join-Path $OutputPath "cxr-sdk-v$Version.unitypackage"
    Write-Host "Exporting SDK -> $sdkPackage"
    $logFile = "sdk-export.log"
    $proc = Start-Process -FilePath $UnityPath -ArgumentList @(
        "-quit",
        "-batchmode",
        "-nographics",
        "-logFile", $logFile,
        "-projectPath", (Get-Location).Path,
        "-exportPackage", $SDKPath,
        $sdkPackage
    ) -NoNewWindow -Wait -PassThru

    if ($proc.ExitCode -eq 0) {
        Write-Host "  Done: $((Get-Item $sdkPackage).Length / 1MB) MB" -ForegroundColor Green
    } else {
        Write-Warning "SDK export failed (exit code $($proc.ExitCode)). Check $logFile"
    }
}

Write-Host "All artifacts packaged in $OutputPath" -ForegroundColor Cyan
Get-ChildItem $OutputPath | Select-Object Name, Length | Format-Table -AutoSize
