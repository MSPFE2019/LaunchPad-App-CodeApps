[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$EnvironmentId,
    [Parameter(Mandatory)]
    [string]$DataverseUrl,
    [Parameter(Mandatory)]
    [string]$SolutionId,
    [Parameter(Mandatory)]
    [string]$UsersConnectionId,
    [Parameter(Mandatory)]
    [string]$GroupsConnectionId,
    [ValidateSet("public", "usgov", "usgovhigh", "usgovdod", "china")]
    [string]$Cloud = "public",
    [string]$AppDisplayName = "Launch App",
    [string]$AppDirectory = (Join-Path $PSScriptRoot "..\app"),
    [switch]$SkipLogin
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

foreach ($command in "pa", "npm") {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "'$command' is required and was not found on PATH."
    }
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Command,
        [Parameter(Mandatory)]
        [string[]]$Arguments,
        [Parameter(Mandatory)]
        [string]$Description
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

$resolvedAppDirectory = (Resolve-Path $AppDirectory).Path
$powerConfigPath = Join-Path $resolvedAppDirectory "power.config.json"
$backupPath = $null

if (-not $SkipLogin) {
    Invoke-CheckedCommand `
        -Command "pa" `
        -Description "Power Apps sign-in" `
        -Arguments @("auth", "login", "--cloud", $Cloud, "--environment-id", $EnvironmentId)
}

Push-Location $resolvedAppDirectory
try {
    if (Test-Path $powerConfigPath) {
        $backupPath = Join-Path ([System.IO.Path]::GetTempPath()) "LaunchApp-power.config.$([guid]::NewGuid()).json"
        Copy-Item $powerConfigPath $backupPath
        Remove-Item $powerConfigPath
    }

    try {
        Invoke-CheckedCommand `
            -Command "pa" `
            -Description "Code App registration" `
            -Arguments @(
                "app", "init",
                "--non-interactive",
                "--cloud", $Cloud,
                "--environment-id", $EnvironmentId,
                "--app-type", "CodeApp",
                "--display-name", $AppDisplayName,
                "--description", "A searchable application directory.",
                "--build-path", "./dist",
                "--file-entry-point", "index.html",
                "--app-url", "http://localhost:5173/"
            )
    }
    catch {
        if ($null -ne $backupPath -and -not (Test-Path $powerConfigPath)) {
            Copy-Item $backupPath $powerConfigPath
        }
        throw
    }

    $dataSources = @(
        @{
            Description = "Adding the Launch App table"
            Arguments = @("app", "add", "data-source", "--non-interactive", "--cloud", $Cloud, "--environment-id", $EnvironmentId, "--connector", "dataverse", "--org-url", $DataverseUrl, "--table", "lppac_launchpadapp")
        },
        @{
            Description = "Adding the dropdown choices table"
            Arguments = @("app", "add", "data-source", "--non-interactive", "--cloud", $Cloud, "--environment-id", $EnvironmentId, "--connector", "dataverse", "--org-url", $DataverseUrl, "--table", "lppac_launchpadchoice")
        },
        @{
            Description = "Adding the Dataverse roles table"
            Arguments = @("app", "add", "data-source", "--non-interactive", "--cloud", $Cloud, "--environment-id", $EnvironmentId, "--connector", "dataverse", "--org-url", $DataverseUrl, "--table", "role")
        },
        @{
            Description = "Adding Office 365 Users"
            Arguments = @("app", "add", "data-source", "--non-interactive", "--cloud", $Cloud, "--environment-id", $EnvironmentId, "--connector", "shared_office365users", "--connection-id", $UsersConnectionId)
        },
        @{
            Description = "Adding Office 365 Groups"
            Arguments = @("app", "add", "data-source", "--non-interactive", "--cloud", $Cloud, "--environment-id", $EnvironmentId, "--connector", "shared_office365groups", "--connection-id", $GroupsConnectionId)
        }
    )

    foreach ($dataSource in $dataSources) {
        Invoke-CheckedCommand `
            -Command "pa" `
            -Arguments $dataSource.Arguments `
            -Description $dataSource.Description
    }

    Invoke-CheckedCommand `
        -Command "pa" `
        -Description "Adding the WhoAmI Dataverse API" `
        -Arguments @(
            "app", "add", "dataverse-api",
            "--non-interactive",
            "--cloud", $Cloud,
            "--environment-id", $EnvironmentId,
            "--api-name", "WhoAmI"
        )

    Invoke-CheckedCommand -Command "npm" -Arguments @("install") -Description "Installing app dependencies"
    Invoke-CheckedCommand -Command "npm" -Arguments @("run", "build") -Description "Building the Code App"
    Invoke-CheckedCommand `
        -Command "pa" `
        -Description "Publishing the Code App" `
        -Arguments @("app", "push", "--solution-id", $SolutionId, "--non-interactive")
}
finally {
    Pop-Location
}

Write-Host "Launch App is configured and published to environment '$EnvironmentId'."
