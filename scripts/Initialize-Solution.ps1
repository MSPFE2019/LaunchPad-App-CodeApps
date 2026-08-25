[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$CodeAppProjectPath,
    [string]$SolutionDirectory = (Join-Path $PSScriptRoot "..\solution")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command pac -ErrorAction SilentlyContinue)) {
    throw "Power Platform CLI (pac) is required and was not found on PATH."
}

$resolvedProjectPath = (Resolve-Path $CodeAppProjectPath).Path
$resolvedSolutionDirectory = [System.IO.Path]::GetFullPath($SolutionDirectory)
$solutionProject = Join-Path $resolvedSolutionDirectory "LaunchPadApp.cdsproj"

if (-not (Test-Path $solutionProject)) {
    pac solution init `
        --publisher-name "LaunchPad" `
        --publisher-prefix "lppac" `
        --outputDirectory $resolvedSolutionDirectory

    if ($LASTEXITCODE -ne 0) {
        throw "pac solution init failed with exit code $LASTEXITCODE."
    }
}

Push-Location $resolvedSolutionDirectory
try {
    pac solution add-reference --path $resolvedProjectPath
    if ($LASTEXITCODE -ne 0) {
        throw "pac solution add-reference failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
Write-Host "Solution project initialized at '$resolvedSolutionDirectory'."
Write-Host "Solution project initialized at '$resolvedSolutionDirectory'."
