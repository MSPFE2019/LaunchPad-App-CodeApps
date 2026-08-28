# Launch App Power Apps Code App

This repository contains automation for replacing the SharePoint
`LaunchPadApp` list with a Dataverse table used by the Launch App Power Apps Code
App. It provisions a `LaunchPad` publisher, an unmanaged `LaunchPadApp`
solution, and an organization-owned `lppac_launchpadapp` table with the
recovered list schema. It also provisions `lppac_launchpadchoice`, a
configuration table for Audience, Category, and App Type dropdown values.

Power Platform CLI lowercases the requested publisher prefix `LPPAC`; the
automation therefore consistently uses `lppac` for logical names such as
`lppac_appurl`.

## Example application

The deployed US Government Power App is
[Launch App](https://apps.gov.powerapps.us/play/e/49bbfcac-da3f-e270-b01a-908cebe939c4/app/c104b1ce-3019-4a62-9b12-f8ab2694daab?tenantId=5a3479ae-949c-40ec-b00d-7d82a1729e23).

The current experience includes:

- A compact, searchable application directory with audience and category
  filters, summary metrics, details dialogs, and Grid or List card views.
- Searchable Microsoft 365 user and group pickers for App Owner and Office 365
  Group.
- An Admin-only application form for creating and editing individual records.
- An Admin-only management table for selecting one, multiple, or all records
  and updating status, audience, category, or app type in bulk.
- Management of Active, Maintenance, Inactive, and Retired records while only
  Active records appear in the public directory.
- A discreet footer link to this GitHub repository.

## Beginner quick start

You can reuse this project in your own Microsoft 365 tenant. The simplest method
does not require editing code or installing command-line tools.

1. Use this repository as a template or clone it.
2. Open **Actions → Build unmanaged solution → Run workflow**.
3. Download the `LaunchPadApp-unmanaged` artifact when the workflow finishes.
4. In [Power Apps](https://make.powerapps.com), select your environment, open
   **Solutions → Import solution**, and upload the downloaded ZIP.
5. During import, select or create connections for **Office 365 Users** and
   **Office 365 Groups**.
6. Assign `LaunchPad Admin` to administrators and `LaunchPad Viewer` to
   directory users in the Power Platform admin center.
7. Share the Code App and its Office 365 Users and Office 365 Groups connections
   with those users.

That is enough for a normal deployment. The sections below cover automated
provisioning and development.

### Automated Dataverse provisioning

For repeatable deployment through the Dataverse Web API, create a Microsoft
Entra app registration, configure it as a Dataverse application user, and add
these repository secrets:

| Secret | Example |
| --- | --- |
| `DATAVERSE_URL` | `https://yourorg.crm.dynamics.com` |
| `DATAVERSE_CLIENT_ID` | Application registration client ID |
| `DATAVERSE_CLIENT_SECRET` | Application registration client secret |
| `DATAVERSE_TENANT_ID` | Microsoft Entra tenant ID |

Run **Actions → Provision Dataverse solution (advanced)**. The workflow is safe
to run again and you can keep its default names.

### Register the Code App in another tenant

The checked-in `app/power.config.json` describes the example deployment and
contains no credentials. Create a new registration for your environment instead
of reusing its IDs:

1. Find the unmanaged solution ID with `pac solution list --json`.
2. Create the two Microsoft 365 connections and copy their IDs:

```powershell
npm install --global @microsoft/power-apps-cli @microsoft/power-apps

$environmentId = "<your-environment-id>"
$cloud = "public" # Use "usgov" for GCC

pa auth login --cloud $cloud --environment-id $environmentId
pa connection create --connector shared_office365users --json
pa connection create --connector shared_office365groups --json
```

3. Run the beginner setup script. It registers a new Code App, adds every data
   source, builds the app, and publishes it to the unmanaged solution:

```powershell
.\scripts\Configure-CodeApp.ps1 `
  -EnvironmentId "<your-environment-id>" `
  -DataverseUrl "https://yourorg.crm.dynamics.com" `
  -SolutionId "<your-solution-id>" `
  -UsersConnectionId "<users-connection-id>" `
  -GroupsConnectionId "<groups-connection-id>" `
  -Cloud public
```

Use `-Cloud usgov` for GCC. The script backs up the example
`power.config.json` to the temporary directory before creating the new
environment-specific registration.

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

No credentials are stored in this repository. Environment and application IDs
in `app/power.config.json` identify only the example deployment and are not
authentication secrets.

## Provision Dataverse locally

Set credentials in the current process, then run the idempotent provisioner:

```powershell
$env:DATAVERSE_URL = "https://yourorg.crm.dynamics.com/"
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

The Code App presents these fields as searchable people and group pickers
backed by the Office 365 Users and Office 365 Groups connectors. When importing
the solution into another environment, bind both connection references to
connections that app users are permitted to use.

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
$cloud = "public" # Use "usgov" for GCC
pa auth login --cloud $cloud --environment-id "<your-environment-id>"

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

### Configurable dropdown values

The `lppac_launchpadchoice` table stores values that users can manage from the
Code App:

| Display name | Logical name | Type | Required |
| --- | --- | --- | --- |
| Value | `lppac_value` | Text (primary name) | Yes |
| Choice Type | `lppac_choicetype` | Text: Audience, Category, or App Type | Yes |

The provisioning script safely seeds common values and does not duplicate
records when it is run again.

## Security roles and Admin view

The unmanaged solution includes two Dataverse security roles:

| Role | LaunchPad App table | LaunchPad Choice table |
| --- | --- | --- |
| **LaunchPad Admin** | Organization-level create, read, write, delete, append, and append-to | Organization-level create, read, write, delete, append, and append-to |
| **LaunchPad Viewer** | Organization-level read only | Organization-level read only |

Assign one of these roles to each user or Microsoft Entra group team in the
Power Platform admin center. Dataverse enforces these privileges on every
request, so a Viewer cannot add, update, or delete records even if a request is
made outside the Code App. Users still need the app shared with them separately
because app sharing and Dataverse table permissions are distinct.

The **Admin view** and **Add application** controls are rendered only when the
signed-in user has the `LaunchPad Admin` role. The Admin view supports
individual edits and bulk updates. Users with `LaunchPad Viewer` can search,
filter, inspect, and launch applications, but they cannot see the administrative
controls or modify Dataverse records.
