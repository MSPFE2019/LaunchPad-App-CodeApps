[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$CodeAppProjectPath,
    [string]$SolutionDirectory = (Join-Path $PSScriptRoot "..\solution"),
    [string]$SolutionUniqueName = "LaunchPadApp"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command pac -ErrorAction SilentlyContinue)) {
    throw "Power Platform CLI (pac) is required and was not found on PATH."
}

function Invoke-PacCommand {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments,
        [Parameter(Mandatory)]
        [string]$Description
    )

    & pac @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

$projectItem = Get-Item (Resolve-Path $CodeAppProjectPath).Path
$codeAppDirectory = $null
$resolvedProjectPath = $null

if ($projectItem.PSIsContainer) {
    if (Test-Path (Join-Path $projectItem.FullName "power.config.json")) {
        $codeAppDirectory = $projectItem.FullName
    }
    else {
        $referenceProjects = @(Get-ChildItem $projectItem.FullName -File | Where-Object {
                $_.Extension -in ".csproj", ".pcfproj"
            })

        if ($referenceProjects.Count -ne 1) {
            throw "Project directory '$($projectItem.FullName)' must contain power.config.json or exactly one .csproj or .pcfproj file."
        }

        $resolvedProjectPath = $referenceProjects[0].FullName
    }
}
elseif ($projectItem.Name -eq "power.config.json") {
    $codeAppDirectory = $projectItem.DirectoryName
}
elseif ($projectItem.Extension -in ".csproj", ".pcfproj") {
    $resolvedProjectPath = $projectItem.FullName
}
elseif ($projectItem.Extension -eq ".cdsproj") {
    throw "'$($projectItem.FullName)' is the Dataverse solution project. For a Code App, -CodeAppProjectPath must point to the directory containing power.config.json. PAC cannot add a .cdsproj as a project reference."
}
else {
    throw "Unsupported project '$($projectItem.FullName)'. Specify a Code App directory containing power.config.json, a .csproj, or a .pcfproj."
}

if ($null -ne $codeAppDirectory) {
    if (-not (Get-Command pa -ErrorAction SilentlyContinue)) {
        throw "Power Apps CLI (pa) is required for Code Apps. Install it with 'npm install --global @microsoft/power-apps-cli @microsoft/power-apps'."
    }

    $solutionJson = & pac solution list --json
    if ($LASTEXITCODE -ne 0) {
        throw "pac solution list failed with exit code $LASTEXITCODE."
    }

    $solution = @($solutionJson | ConvertFrom-Json) |
        Where-Object { $_.SolutionUniqueName -eq $SolutionUniqueName } |
        Select-Object -First 1

    if ($null -eq $solution) {
        throw "Unmanaged solution '$SolutionUniqueName' was not found in the active PAC environment."
    }

    Push-Location $codeAppDirectory
    try {
        & pa app push --solution-id $solution.Id --non-interactive
        if ($LASTEXITCODE -ne 0) {
            throw "pa app push failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "Published Code App '$codeAppDirectory' into the unmanaged $SolutionUniqueName solution."
    return
}

$resolvedSolutionDirectory = [System.IO.Path]::GetFullPath($SolutionDirectory)
$solutionProjects = if (Test-Path $resolvedSolutionDirectory) {
    @(Get-ChildItem $resolvedSolutionDirectory -Filter "*.cdsproj" -File)
}
else {
    @()
}

if ($solutionProjects.Count -gt 1) {
    throw "Solution directory '$resolvedSolutionDirectory' contains multiple .cdsproj files."
}

if ($solutionProjects.Count -eq 0) {
    Invoke-PacCommand `
        -Description "pac solution init" `
        -Arguments @(
            "solution", "init",
            "--publisher-name", "LaunchPad",
            "--publisher-prefix", "lppac",
            "--outputDirectory", $resolvedSolutionDirectory
        )
}

Push-Location $resolvedSolutionDirectory
try {
    Invoke-PacCommand `
        -Description "pac solution add-reference" `
        -Arguments @("solution", "add-reference", "--path", $resolvedProjectPath)
}
finally {
    Pop-Location
}

Write-Host "Added component reference '$resolvedProjectPath' to the solution in '$resolvedSolutionDirectory'."
