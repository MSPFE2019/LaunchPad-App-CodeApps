# LaunchPadApp unmanaged solution

This directory contains the source-controlled `LaunchPadApp.cdsproj` Power
Platform solution generated with `pac solution init`. Its package type and
manifest are explicitly **unmanaged**. Power Platform CLI normalizes the
requested publisher prefix `LPPAC` to lowercase `lppac`, so all Dataverse
logical names use `lppac_`.

Do not commit exported solution ZIP files. Authenticate and publish the Code
App into this online solution after its project is available:

```powershell
pac auth create `
  --name LaunchPadDataverse `
  --environment https://orgd09bf0c1.crm9.dynamics.com/ `
  --applicationId $env:DATAVERSE_CLIENT_ID `
  --clientSecret $env:DATAVERSE_CLIENT_SECRET `
  --tenant $env:DATAVERSE_TENANT_ID

pac auth select --name LaunchPadDataverse

.\scripts\Initialize-Solution.ps1 `
  -CodeAppProjectPath "<path-to-Code-App-directory>"
```

For a directory containing `power.config.json`, the helper resolves the online
solution ID and runs:

```powershell
Set-Location "<path-to-Code-App-directory>"
pa app push --solution-id "<LaunchPadApp-solution-id>" --non-interactive
```

For a `.csproj` or `.pcfproj` component, it detects the checked-in solution and
runs `pac solution add-reference`. The solution project was originally
generated using:

```powershell
pac solution init `
  --publisher-name LaunchPad `
  --publisher-prefix lppac `
  --outputDirectory .\solution

Set-Location .\solution
pac solution add-reference --path "<path-to-Code-App.csproj>"
pac solution online-version --solution-name LaunchPadApp
```

`pac solution add-reference` accepts component `.csproj` and `.pcfproj`
projects. It does not accept this directory's `LaunchPadApp.cdsproj`; Code Apps
are associated with the solution by `pa app push --solution-id`. Install the
Code Apps CLI with
`npm install --global @microsoft/power-apps-cli @microsoft/power-apps`. For US
Government environments, sign in with `pa auth login --cloud usgov`.

Build or pack source as an unmanaged ZIP:

```powershell
pac solution pack `
  --folder .\solution\src `
  --zipfile .\artifacts\LaunchPadApp-unmanaged.zip `
  --packagetype Unmanaged
```

To synchronize this folder from the live unmanaged solution instead, export
and unpack it:

```powershell
pac solution export `
  --name LaunchPadApp `
  --path .\artifacts\LaunchPadApp-unmanaged.zip `
  --managed false `
  --overwrite

pac solution unpack `
  --zipfile .\artifacts\LaunchPadApp-unmanaged.zip `
  --folder .\solution\src `
  --packagetype Unmanaged
```

If `LaunchPadApp` already exists under a different publisher or as a managed
solution, choose a collision-free unique name and pass the same name to the
provisioning script and PAC commands.
