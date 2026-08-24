# Work Orders — activity log + downtime

## Files to put in capacity-main root (same folder as WorkOrders.html)

1. **traveler-log.js** — running log helpers
2. **downtime-report.js** — report downtime from a job
3. **WorkOrders.html** — (update coming) wires both

Until WorkOrders.html is fully re-pushed, you can add these three lines near the other script tags:

```html
<script src="traveler-log.js"></script>
<script src="downtime-report.js"></script>
<script src="wo-qa.js"></script>
<script src="scorecard.js"></script>
```

## Behavior

### Activity log (generic cable / assembly)
- On an open operation: **What did you do?** textarea before Tech complete
- Notes are saved into `traveler.activityLog` with who / when / op name
- **+ Log note** adds a freeform entry anytime
- Log shows on the traveler (newest first)

### Downtime
- **Downtime** button on each work order row
- Writes to `localStorage` → `capacity-tracker.v1.downtime`
- Visible on **DowntimeLogger.html** overview

## activityLog entry shape
```json
{
  "id": "al_…",
  "at": "ISO",
  "type": "note|tech|qa-pass|qa-fail|step|checkin",
  "text": "…",
  "by": "Name",
  "byId": "…",
  "opId": "crimp_circular",
  "opName": "Crimp - Circular"
}
```
