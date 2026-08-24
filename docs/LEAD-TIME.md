# Ordering & Kitting lead-time capacity

## Standards (every open work order)

| Center | Hours | When load is booked |
|--------|--------|----------------------|
| **Ordering** | **1 hour** | **6 weeks before** kitting start |
| **Kitting** | **1 hour per kit** | **3 workdays before** job must-start |

Job **must-start** is derived from the work order due date and remaining hours (8h workdays).

- Kitting start = must-start − 3 workdays  
- Ordering start = kitting start − 6 calendar weeks  

Kit quantity defaults to **1**. Optional field on a work order: `kitQty` or `quantity`.

## Setup in the app

1. Open **Work Centers** in Capacity Tracker.
2. **Add** three centers (exact names work; any name containing these words also matches):
   - **Ordering**
   - **Kitting**
   - **QA** (optional; used for step-level QA later — not auto-hour’d by this rule)
3. Assign people to those centers so they have capacity.
4. Keep production work orders on Production Lab / Annex / Test Lab as usual.

Optional: set `kind` on a center to `ordering`, `kitting`, or `qa` if you prefer not to rely on the name.

## Code

Logic lives in **`calc.js`** (`CapacityCalc.summarize` → `applyLeadTimeLoad`).

- Multi-file shell (`index.aspx` + `calc.js`): pick up automatically after `git pull`.
- Single-file **`CapacityTracker.html`**: still has the older embedded calc until we merge the same logic into that file (or you load `calc.js` ahead of the app in a custom shell).

## Check it

1. Create **Ordering** and **Kitting** centers.
2. Add a work order with a due date several weeks out and remaining hours.
3. Open **Planning** — Ordering should show ~1h in the week ~6 weeks before kitting; Kitting ~1h three workdays before must-start.
