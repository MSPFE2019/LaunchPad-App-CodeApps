# LaunchPadApp unmanaged solution

This directory contains the source-controlled `LaunchPadApp.cdsproj` Power
Platform solution generated with `pac solution init`. Its package type and
manifest are explicitly **unmanaged**. Power Platform CLI normalizes the
requested publisher prefix `LPPAC` to lowercase `lppac`, so all Dataverse
logical names use `lppac_`.

Do not commit exported solution ZIP files. Authenticate and add the Code App
project reference after that project is available:

```powershell
pac auth create `
  --name LaunchPadDataverse `
  --environment https://orgd09bf0c1.crm9.dynamics.com/ `
  --applicationId $env:DATAVERSE_CLIENT_ID `
  --clientSecret $env:DATAVERSE_CLIENT_SECRET `
  --tenant $env:DATAVERSE_TENANT_ID

pac auth select --name LaunchPadDataverse

.\scripts\Initialize-Solution.ps1 `
  -CodeAppProjectPath "<path-to-LaunchPad-Code-App-project>"
```

The helper detects the checked-in solution and runs `pac solution
add-reference`. The original project was generated using:

```powershell
pac solution init `
  --publisher-name LaunchPad `
  --publisher-prefix lppac `
  --outputDirectory .\solution

Set-Location .\solution
pac solution add-reference --path "<path-to-LaunchPad-Code-App-project>"
pac solution online-version --solution-name LaunchPadApp
```

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
