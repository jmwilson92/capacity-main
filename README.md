# Put Capacity Tracker on SharePoint

There are two layers: **where the app files live** and **where the data lives**.

## 1. Host the app on the site

Upload this whole folder (keep `index.html`, `index.aspx`, `css/`, and `js/` together) to **Site Assets** — for example:

`Site Assets / capacity /`

### Option A — Embed on a modern page (usual path)

1. Create a SharePoint page, e.g. **Capacity**.
2. Add the **Embed** web part.
3. Point it at the file URL:

   `https://YOURTENANT.sharepoint.com/sites/YOURSITE/SiteAssets/capacity/index.aspx`

   Use `index.aspx` rather than `index.html`. SharePoint Online often downloads `.html` instead of showing it.

4. Give the embed a tall height (900–1100px) so the planning board is usable.

If the tenant blocks custom `.aspx` in Site Assets, host the same folder on any HTTPS static site (Azure Static Web Apps, GitHub Pages, Netlify) and embed *that* URL instead. The app still works; only shared SharePoint-list storage needs the app to be served from the same SharePoint site.

### Option B — Open it full screen

Share the `index.aspx` link directly. People with site access can bookmark it.

## 2. Share one dataset (recommended for a team)

By default each browser keeps its own copy. To share capacity across the team:

1. Install [PnP.PowerShell](https://pnp.github.io/powershell/) if needed:

   ```powershell
   Install-Module PnP.PowerShell -Scope CurrentUser
   ```

2. From this `sharepoint` folder:

   ```powershell
   Connect-PnPOnline -Url "https://YOURTENANT.sharepoint.com/sites/YOURSITE" -Interactive
   .\New-CapacityLists.ps1
   ```

   That creates four lists: **CT Work Centers**, **CT People**, **CT Work Orders**, and **CT Time Off**.

   Re-run the script if you already created lists before time off existed — it adds missing columns and the new list.

3. Open Capacity Tracker → **Settings** → store data in **SharePoint lists**.
4. Confirm the site URL (`https://YOURTENANT.sharepoint.com/sites/YOURSITE`) and click **Test connection**.
5. If you already built data in the browser, click **Push browser data to lists**.

The signed-in SharePoint user needs contribute permission on those lists. The app talks to SharePoint with that user’s cookies — no extra app registration when it is hosted on the same site.

## 3. Permissions

| Task | Permission |
| --- | --- |
| Use the tracker, add/edit orders | Contribute on the four lists |
| Run `New-CapacityLists.ps1` | Manage lists / site owner |
| Embed the page | Read on Site Assets |

## 4. List columns the app expects

Internal names must match. The script creates them.

**CT Work Centers** — Title (name), Notes, Color  
**CT People** — Title (name), WorkCenterId, WorkCenterName, HoursPerWeek, WorkDays, WorksWeekends, Efficiency, Notes  
**CT Work Orders** — Title (WO #), JobName, WorkCenterId, WorkCenterName, Hours, RemainingHours, DueDate, Status, Priority, Notes  
**CT Time Off** — Title, PersonId, PersonName, AbsenceType, StartDate, EndDate, Hours, IncludeWeekends, Notes

Do not rename those internal names. Display names can change.

## 5. If the embed is blank or downloads a file

- Try `index.aspx` instead of `index.html`.
- Confirm custom script is allowed on the site if `.aspx` is blocked (SharePoint admin: allow custom script on that site).
- Host the files elsewhere and embed the public HTTPS URL. Use **this browser** storage, or export/import JSON to share a snapshot.
