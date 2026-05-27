param(
    [ValidateSet("EditMode","PlayMode","all")]
    [string]$TestMode = "EditMode",

    [string]$UnityPath = "C:\Program Files\Unity\Hub\Editor\6000.0.23f1\Editor\Unity.exe",

    [string]$TestResultsPath = "TestResults",

    [string]$TestFilter = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $UnityPath)) {
    Write-Error "Unity not found at $UnityPath"
    exit 1
}

$null = New-Item -ItemType Directory -Path $TestResultsPath -Force

$modes = if ($TestMode -eq "all") { @("EditMode", "PlayMode") } else { @($TestMode) }

foreach ($mode in $modes) {
    $resultFile = Join-Path $TestResultsPath "test-results-$mode.xml"
    $logFile = "test-$mode.log"

    $argsList = @(
        "-quit",
        "-batchmode",
        "-nographics",
        "-logFile", $logFile,
        "-projectPath", (Get-Location).Path,
        "-runTests",
        "-testResults", $resultFile,
        "-testPlatform", $mode
    )

    if ($TestFilter) {
        $argsList += "-testFilter"
        $argsList += $TestFilter
    }

    Write-Host "Running $mode tests -> $resultFile"
    $proc = Start-Process -FilePath $UnityPath -ArgumentList $argsList -NoNewWindow -Wait -PassThru

    if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 2) {
        Write-Error "Test run failed with exit code $($proc.ExitCode). Check $logFile"
        exit $proc.ExitCode
    }

    Write-Host "$mode tests completed. Results: $resultFile" -ForegroundColor Green
}
