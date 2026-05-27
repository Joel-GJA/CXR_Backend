param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("headless","client","android","webgl")]
    [string]$Target,

    [Parameter(Mandatory = $true)]
    [string]$BuildPath,

    [string]$UnityPath = "C:\Program Files\Unity\Hub\Editor\6000.0.23f1\Editor\Unity.exe",

    [string]$BuildName = "CXR_Backend",

    [string]$SceneList = "",

    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $UnityPath)) {
    Write-Error "Unity not found at $UnityPath"
    exit 1
}

$targetMap = @{
    "headless" = "linux-headless"
    "client"   = "linux-x86_64"
    "android"  = "android"
    "webgl"    = "webgl"
}

$platform = $targetMap[$Target]
$fullBuildPath = Join-Path (Resolve-Path $BuildPath) $BuildName

$argsList = @(
    "-quit",
    "-batchmode",
    "-nographics",
    "-logFile", "build-$Target.log",
    "-buildTarget", $platform,
    "-projectPath", (Get-Location).Path,
    "-outputPath", $fullBuildPath
)

if ($Version) {
    $argsList += "-version"
    $argsList += $Version
}

if ($SceneList) {
    $argsList += "-scenes"
    $argsList += $SceneList
}

if ($Target -eq "headless") {
    $argsList += "-buildHeadlessServer"
} else {
    $argsList += "-buildWindows64Player"
}

Write-Host "Building Unity $Target ($platform) -> $fullBuildPath"
Write-Host "Unity: $UnityPath"

$proc = Start-Process -FilePath $UnityPath -ArgumentList $argsList -NoNewWindow -Wait -PassThru

if ($proc.ExitCode -ne 0) {
    Write-Error "Build failed with exit code $($proc.ExitCode). Check build-$Target.log"
    exit $proc.ExitCode
}

Write-Host "Build successful: $fullBuildPath" -ForegroundColor Green
