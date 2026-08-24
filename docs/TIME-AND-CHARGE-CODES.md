# Charge codes & check-in time tracking

## How time is recorded

1. Assign a **charge code** on the work order (WI type dialog → Charge code field).
2. Tech **Check in** (or **Resume**) → timer starts for that person + charge code.
3. **Exit**, **Mark complete**, **Sign out**, or close the tab → session is saved.
4. Sessions under **15 seconds** are ignored (accidental clicks).

Data is stored in `localStorage` → `capacity-tracker.v1` → `timeEntries[]`.

## Analytics

Open **Analytics → Timecard**.

- Filter: Today / This week / Last week / All time
- One **card per person**
- Inside each card: **charge code** rows with hours (`H:MM` and decimal)
- Session detail table at the bottom

Use those boxes to fill the timesheet.

## Files

| File | Role |
|------|------|
| `time-track.js` | Start/stop session helper |
| `WorkOrders.html` | Must load `time-track.js` and call start/stop (see below) |
| `Analytics.html` | Timecard UI |

## Wire-up inside WorkOrders.html (if not already present)

1. Before the main app script:

```html
<script src="time-track.js"></script>
```

2. After `startTraveler` creates/opens the traveler:

```js
if (window.TimeTrack) TimeTrack.start(state.session, wo, t.id);
```

3. On **Resume**:

```js
var t = trById(...); var wo = woById(t.workOrderId);
if (window.TimeTrack && wo) TimeTrack.start(state.session, wo, t.id);
```

4. On **Exit**, **Mark complete**, **logout**:

```js
if (window.TimeTrack) TimeTrack.stop();
```

5. WI type dialog — charge code field bound to `state.tagChargeCode`, saved as `wo.chargeCode`.
