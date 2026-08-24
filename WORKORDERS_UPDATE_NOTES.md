# WorkOrders update (in progress)

## Complexity (WI / Code modal)
- Field: `wo.complexity` = easy | medium | hard (default medium)
- Shown in tag modal under charge code
- Used by scorecard.js output pace weights

## QA non-compliance
On **QA Fail · PIN**:
1. Enter PIN
2. Modal: category, severity (minor/major/critical), notes (required)
3. Writes `qaRecords[]` with result fail + nonCompliance

On **QA Pass · PIN**:
- Writes `qaRecords[]` with result pass, nonCompliance null

## qaRecord shape
See scorecard.js / QA_SCORECARD.md

## Soft skills (manager)
initiative, criticalThinking, communication, leadership (1-5)

## Files to download when ready
- WorkOrders.html (this update)
- scorecard.js (done)
- Analytics.html (scorecard UI next)
