# LaunchPad Power Apps Code App

This repository contains automation for replacing the SharePoint
`LaunchPadApp` list with a Dataverse table used by the LaunchPad Power Apps Code
App. It provisions a `LaunchPad` publisher, an unmanaged `LaunchPadApp`
solution, and an organization-owned `lppac_launchpadapp` table with the
recovered list schema.

Power Platform CLI lowercases the requested publisher prefix `LPPAC`; the
automation therefore consistently uses `lppac` for logical names such as
`lppac_appurl`.

## Prerequisites

- Power Platform CLI (`pac`) installed for solution initialization, reference
  management, export, packing, and import.
- Power Apps CLI (`pa`) installed for Code App development and publishing:
  `npm install --global @microsoft/power-apps-cli @microsoft/power-apps`.
- An Azure AD app registration with a client secret.
- The app registration configured as an application user in the target
  Dataverse environment.
- A Dataverse security role for that application user with privileges to
  create publishers, solutions, tables, columns, and option sets. System
  Administrator is simplest for initial provisioning; use a narrower custom
  role where organizational policy requires least privilege.
- PowerShell 7 for local script execution.

The intended environment is
`https://orgd09bf0c1.crm9.dynamics.com/`. No credentials are stored in this
repository.

## Provision Dataverse locally

Set credentials in the current process, then run the idempotent provisioner:

```powershell
$env:DATAVERSE_URL = "https://orgd09bf0c1.crm9.dynamics.com/"
$env:DATAVERSE_CLIENT_ID = "<application-client-id>"
$env:DATAVERSE_CLIENT_SECRET = "<application-client-secret>"
$env:DATAVERSE_TENANT_ID = "<tenant-id>"

.\scripts\Provision-Dataverse.ps1
```

The script authenticates with the OAuth client-credentials flow and checks
each component before creating it. Re-running it does not duplicate the
publisher, solution, table, or columns. New solutions created through the
Dataverse API are unmanaged. If the unique name `LaunchPadApp` collides with a
managed solution or one owned by another publisher, select another name:

```powershell
.\scripts\Provision-Dataverse.ps1 -SolutionUniqueName "LaunchPadAppCodeApp"
```

`AppOwner` and `Office365Group` are text columns containing a UPN or email
address. This makes deployments portable and avoids lookups to environment-
specific `systemuser` or team records. The tradeoff is that Dataverse does not
enforce referential integrity; use lookups instead if ownership relationships
and model-driven navigation are required.

## Provision with GitHub Actions

Create these repository or `dataverse` environment secrets:

| Secret | Value |
| --- | --- |
| `DATAVERSE_URL` | Dataverse environment URL |
| `DATAVERSE_CLIENT_ID` | Azure AD application client ID |
| `DATAVERSE_CLIENT_SECRET` | Azure AD application client secret |
| `DATAVERSE_TENANT_ID` | Azure AD tenant ID |

Run **Provision Dataverse solution** from the Actions tab using
`workflow_dispatch`. The workflow invokes the same idempotent PowerShell
script and does not export or commit generated solution archives.

## Run and publish the Code App

The complete React Code App is in [`app/`](app/). It is registered in the
target US Government environment and included in the unmanaged `LaunchPadApp`
solution. To run it locally:

```powershell
Set-Location .\app
npm install
npm run dev
```

To publish an update, authenticate both CLIs and run the helper:

```powershell
pac auth create --environment $env:DATAVERSE_URL
pa auth login --cloud usgov --environment-id 49bbfcac-da3f-e270-b01a-908cebe939c4

Set-Location ..
.\scripts\Initialize-Solution.ps1 -CodeAppProjectPath .\app
```

The helper resolves the live `LaunchPadApp` solution ID with `pac solution
list --json`, then uses `pa app push --solution-id` to publish the Code App.
The newer `pa` CLI is required because legacy `pac code push` selects an
incorrect commercial Code Apps endpoint for US Government environments.

## Pack the unmanaged solution

The PAC-generated `solution/LaunchPadApp.cdsproj` project is checked into this
repository and configured for unmanaged output. Authenticate PAC CLI and add a
Code App to the online unmanaged solution:

```powershell
pac auth create `
  --name LaunchPadDataverse `
  --environment $env:DATAVERSE_URL `
  --applicationId $env:DATAVERSE_CLIENT_ID `
  --clientSecret $env:DATAVERSE_CLIENT_SECRET `
  --tenant $env:DATAVERSE_TENANT_ID

pac auth select --name LaunchPadDataverse

.\scripts\Initialize-Solution.ps1 `
  -CodeAppProjectPath "<path-to-Code-App-directory>"

pac solution online-version --solution-name LaunchPadApp

pac solution pack `
  --folder .\solution\src `
  --zipfile .\artifacts\LaunchPadApp-unmanaged.zip `
  --packagetype Unmanaged
```

See [`solution/README.md`](solution/README.md) for the equivalent
`pac solution init`, `pac solution add-reference`, export, unpack, and pack
commands. Dataverse table metadata should be synchronized into this project
from the live unmanaged solution after provisioning; the repository does not
fabricate exported metadata or a `solution.zip`.

For a Power Apps Code App, `-CodeAppProjectPath` must identify the directory
containing `power.config.json`. Do not pass
`solution/LaunchPadApp.cdsproj`; that is the receiving Dataverse solution
project. For PCF or other supported component projects, the helper instead
runs `pac solution add-reference` for a `.pcfproj` or `.csproj`.

## Import the unmanaged solution

Import the packed archive into a Dataverse environment:

```powershell
pac auth select --name LaunchPadDataverse
pac solution import `
  --path .\artifacts\LaunchPadApp-unmanaged.zip `
  --publish-changes
```

For an authoritative source export from the target environment, explicitly
request unmanaged output:

```powershell
pac solution export `
  --name LaunchPadApp `
  --path .\artifacts\LaunchPadApp-unmanaged.zip `
  --managed false `
  --overwrite
```

## Dataverse schema

| Display name | Logical name | Type | Required |
| --- | --- | --- | --- |
| Title | `lppac_title` | Text (primary name) | Yes |
| App URL | `lppac_appurl` | Text | Yes |
| App Description | `lppac_appdescription` | Multiline text | Yes |
| App Owner | `lppac_appowner` | Text (UPN/email) | No |
| App Status | `lppac_appstatus` | Local choice: Active, Maintenance, Inactive, Retired | No; defaults to Active |
| Audience | `lppac_audience` | Text | Yes |
| Agency Filter | `lppac_agencyfilter` | Text | No |
| Office 365 Group | `lppac_office365group` | Text (UPN/email) | No |
| License Designation | `lppac_licensedesignation` | Text | No |
| App ID | `lppac_appid` | Text | No |
| App Type | `lppac_apptype` | Text | Yes |
| App Version | `lppac_appversion` | Text | No |
| App Update | `lppac_appupdate` | Text | No |
| Category | `lppac_category` | Text | No |
