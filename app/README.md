# Launch App Code App

Launch App is a React and TypeScript Power Apps Code App that reads active
application records from the Dataverse `lppac_launchpadapp` table. It supports
text search, audience and category filters, Grid and List card views, responsive
application cards, details dialogs, and HTTPS launch links.

The application entry form loads Audience, Category, and App Type dropdowns
from `lppac_launchpadchoice`. Use **Manage dropdown choices** in that form to
add shared values directly to Dataverse; the new value is selected
automatically for the current application.

App Owner and Microsoft 365 Group use searchable Office 365 Users and Office
365 Groups connector pickers. The selected email address or UPN is stored in
the existing Dataverse text column. Users must have access to the app's
connector connections, or an administrator must rebind those connection
references after importing the solution into another environment.

Users with the `LaunchPad Admin` Dataverse role see **Admin view** and **Add
application** controls. Admin view provides a table for editing one record at a
time or selecting multiple records to update status, audience, category, and
app type in bulk. It includes every status so inactive or retired records remain
manageable. Viewer users see only the read-only application directory.

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

The checked-in `power.config.json` identifies the registered Code App, its
Dataverse data source, and its Microsoft 365 connector references. The solution
ID above is the unmanaged `LaunchPadApp` solution in the configured US
Government environment.
