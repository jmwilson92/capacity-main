# QA + Tech Scorecard

## Work order complexity
Set on **WI / Code** tag modal: `easy` | `medium` | `hard`

Weights for output pace:
- easy: 1.0
- medium: 1.25
- hard: 1.5

## qaRecords (localStorage capacity-tracker.v1)
Written on every QA Pass/Fail (generic cable/assembly ops).

```
{
  id, workOrderId, workOrderNumber, chargeCode,
  travelerId, opId, opName, kind,
  result: "pass" | "fail",
  by, byId, at,
  techId, techName,          // builder from traveler / techDone
  productTag, instructionKind, workCenterId, complexity,
  nonCompliance: null | { category, severity, notes }
}
```

Fail categories: nick, wrong_tool, crimp, solder, length, seat, label, torque, fod, sequence, other
Severity: minor | major | critical

## Scorecard pillars (0-100)
| Pillar | Weight | Source |
|--------|--------|--------|
| Output | 30% | expected hrs / actual hrs * complexity weight |
| Quality | 30% | qa pass / (pass+fail) as tech of record |
| Skill | 20% | IPC certs: J-STD, 610, 620 (~33 each) |
| Soft | 20% | Manager grades: attitude, teamwork, accountability, reliability (1-5) |

**Visibility:** individual named scorecards = Manager + Admin only.

## Soft skill reviews
`softSkillReviews[]`: personId, attitude, teamwork, accountability, reliability, notes, byManagerId, at
