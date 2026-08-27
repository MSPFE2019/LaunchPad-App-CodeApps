# LaunchPad Code App

LaunchPad is a React and TypeScript Power Apps Code App that reads active
application records from the Dataverse `lppac_launchpadapp` table. It supports
text search, audience and category filters, responsive application cards, and
HTTPS launch links.

The application entry form loads Audience, Category, and App Type dropdowns
from `lppac_launchpadchoice`. Use **Manage dropdown choices** in that form to
add shared values directly to Dataverse; the new value is selected
automatically for the current application.

## Local development

```powershell
npm install
pa auth login --cloud usgov --environment-id 49bbfcac-da3f-e270-b01a-908cebe939c4
npm run dev
```

Open the Vite URL in the same browser profile used to authenticate to Power
Platform.

## Build and publish

```powershell
npm run lint
npm run build
pa app push --solution-id c3fe7801-5e68-49bf-be01-bb72235328fd --non-interactive
```

The checked-in `power.config.json` identifies the registered Code App and its
Dataverse data source. The solution ID above is the unmanaged `LaunchPadApp`
solution in the configured US Government environment.
