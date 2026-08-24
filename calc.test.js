const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Calc = require("../js/calc");

const monday = new Date(2026, 7, 10); // Mon Aug 10, 2026

function wo(partial) {
  return Object.assign(
    {
      id: "wo1",
      number: "WO-1",
      title: "Job",
      workCenterId: "wc1",
      hours: 10,
      remainingHours: 10,
      dueDate: "2026-08-14",
      status: "queued"
    },
    partial
  );
}

describe("parseDate", () => {
  it("parses YYYY-MM-DD as a local calendar date", () => {
    const d = Calc.parseDate("2026-08-13");
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getDate(), 13);
  });

  it("strips time from ISO timestamps", () => {
    const d = Calc.parseDate("2026-08-13T22:00:00.000Z");
    assert.equal(d.getDate(), 13);
  });

  it("returns null for empty values", () => {
    assert.equal(Calc.parseDate(""), null);
    assert.equal(Calc.parseDate(null), null);
  });
});

describe("weeks", () => {
  it("starts weeks on Monday by default", () => {
    const start = Calc.startOfWeek(new Date(2026, 7, 13), 1); // Thursday
    assert.equal(Calc.formatISO(start), "2026-08-10");
  });

  it("starts weeks on Sunday when configured", () => {
    const start = Calc.startOfWeek(new Date(2026, 7, 13), 0);
    assert.equal(Calc.formatISO(start), "2026-08-09");
  });

  it("builds a horizon of N weeks from the current week", () => {
    const weeks = Calc.planningWeeks(4, 1, monday);
    assert.equal(weeks.length, 4);
    assert.equal(weeks[0].key, "2026-08-10");
    assert.equal(weeks[0].isCurrent, true);
    assert.equal(weeks[3].key, "2026-08-31");
    assert.equal(Calc.formatISO(weeks[0].end), "2026-08-16");
  });
});

describe("people hours", () => {
  it("applies efficiency to weekly hours", () => {
    assert.equal(Calc.effectiveWeeklyHours({ hoursPerWeek: 40, efficiency: 80 }), 32);
  });

  it("treats missing efficiency as 100%", () => {
    assert.equal(Calc.effectiveWeeklyHours({ hoursPerWeek: 40 }), 40);
  });

  it("returns 0 for missing or negative inputs", () => {
    assert.equal(Calc.effectiveWeeklyHours({ hoursPerWeek: 0, efficiency: 100 }), 0);
    assert.equal(Calc.effectiveWeeklyHours({ hoursPerWeek: 40, efficiency: 0 }), 0);
    assert.equal(Calc.effectiveWeeklyHours({}), 0);
  });

  it("sums capacity by work center", () => {
    const cap = Calc.weeklyCapacityByCenter([
      { workCenterId: "a", hoursPerWeek: 40, efficiency: 100 },
      { workCenterId: "a", hoursPerWeek: 20, efficiency: 50 },
      { workCenterId: "b", hoursPerWeek: 40, efficiency: 100 },
      { hoursPerWeek: 40 }
    ]);
    assert.equal(cap.a, 50);
    assert.equal(cap.b, 40);
    assert.equal(cap.undefined, undefined);
  });
});

describe("remaining hours", () => {
  it("uses remainingHours when set", () => {
    assert.equal(Calc.remainingHours(wo({ hours: 20, remainingHours: 6 })), 6);
  });

  it("falls back to estimated hours", () => {
    assert.equal(Calc.remainingHours(wo({ hours: 20, remainingHours: "" })), 20);
  });

  it("is zero when the order is complete", () => {
    assert.equal(Calc.remainingHours(wo({ status: "complete", remainingHours: 8 })), 0);
  });
});

describe("due-week loading", () => {
  it("puts all hours in the week that contains the due date", () => {
    const weeks = Calc.planningWeeks(4, 1, monday);
    const buckets = Calc.distributeHours(
      wo({ remainingHours: 24, dueDate: "2026-08-21" }),
      weeks,
      1,
      "due-week",
      monday
    );
    assert.equal(buckets["2026-08-17"], 24);
    assert.equal(buckets["2026-08-10"], undefined);
  });

  it("marks work due before today as overdue", () => {
    const weeks = Calc.planningWeeks(4, 1, monday);
    const buckets = Calc.distributeHours(
      wo({ remainingHours: 12, dueDate: "2026-08-03" }),
      weeks,
      1,
      "due-week",
      monday
    );
    assert.equal(buckets.overdue, 12);
  });

  it("marks work beyond the horizon as later", () => {
    const weeks = Calc.planningWeeks(2, 1, monday);
    const buckets = Calc.distributeHours(
      wo({ remainingHours: 8, dueDate: "2026-09-15" }),
      weeks,
      1,
      "due-week",
      monday
    );
    assert.equal(buckets.later, 8);
  });

  it("marks missing due dates as unscheduled", () => {
    const weeks = Calc.planningWeeks(2, 1, monday);
    const buckets = Calc.distributeHours(
      wo({ remainingHours: 5, dueDate: "" }),
      weeks,
      1,
      "due-week",
      monday
    );
    assert.equal(buckets.unscheduled, 5);
  });
});

describe("spread loading", () => {
  it("splits hours evenly from this week through the due week", () => {
    const weeks = Calc.planningWeeks(6, 1, monday);
    const buckets = Calc.distributeHours(
      wo({ remainingHours: 30, dueDate: "2026-08-26" }),
      weeks,
      1,
      "spread",
      monday
    );
    // Aug 10, 17, 24 — 3 weeks
    assert.equal(buckets["2026-08-10"], 10);
    assert.equal(buckets["2026-08-17"], 10);
    assert.equal(buckets["2026-08-24"], 10);
  });

  it("parks the tail beyond the horizon in later", () => {
    const weeks = Calc.planningWeeks(2, 1, monday);
    const buckets = Calc.distributeHours(
      wo({ remainingHours: 30, dueDate: "2026-08-26" }),
      weeks,
      1,
      "spread",
      monday
    );
    assert.equal(buckets["2026-08-10"], 10);
    assert.equal(buckets["2026-08-17"], 10);
    assert.equal(buckets.later, 10);
  });
});

describe("summarize", () => {
  const data = {
    workCenters: [
      { id: "wc1", name: "Welding", color: "#c0392b" },
      { id: "wc2", name: "Assembly", color: "#1f6f6a" }
    ],
    people: [
      { id: "p1", workCenterId: "wc1", hoursPerWeek: 40, efficiency: 100 },
      { id: "p2", workCenterId: "wc1", hoursPerWeek: 40, efficiency: 50 },
      { id: "p3", workCenterId: "wc2", hoursPerWeek: 40, efficiency: 100 }
    ],
    workOrders: [
      wo({ id: "a", workCenterId: "wc1", remainingHours: 70, dueDate: "2026-08-12" }),
      wo({ id: "b", workCenterId: "wc1", remainingHours: 20, dueDate: "2026-08-20" }),
      wo({ id: "c", workCenterId: "wc2", remainingHours: 10, dueDate: "2026-08-12", status: "complete" }),
      wo({ id: "d", workCenterId: "", remainingHours: 7, dueDate: "2026-08-12" }),
      wo({ id: "e", workCenterId: "wc1", remainingHours: 15, dueDate: "2026-08-01" })
    ]
  };

  it("rolls capacity, this-week load, overdue, and unassigned work", () => {
    const summary = Calc.summarize(data, {
      planningWeeks: 4,
      weekStartsOn: 1,
      loadMode: "due-week",
      from: monday
    });

    const weld = summary.centers.find((c) => c.id === "wc1");
    const assy = summary.centers.find((c) => c.id === "wc2");

    assert.equal(weld.weeklyCapacity, 60);
    assert.equal(weld.headcount, 2);
    assert.equal(weld.loadByWeek["2026-08-10"], 70);
    assert.equal(weld.loadByWeek["2026-08-17"], 20);
    assert.equal(weld.overdueHours, 15);
    assert.equal(weld.openCount, 3);
    assert.ok(weld.thisWeekUtil > 0.8);
    assert.equal(weld.thisWeekLevel, "over");

    assert.equal(assy.weeklyCapacity, 40);
    assert.equal(assy.thisWeekLoad, 0);
    assert.equal(assy.completeHours, 10);

    assert.equal(summary.unassigned.hours, 7);
    assert.equal(summary.totals.weeklyCapacity, 100);
    assert.equal(summary.totals.overdueHours, 15);
  });

  it("drops this-week capacity when someone is out", () => {
    const withPto = Object.assign({}, data, {
      absences: [{ id: "abs1", personId: "p3", startDate: "2026-08-10", endDate: "2026-08-14" }]
    });
    const summary = Calc.summarize(withPto, {
      planningWeeks: 4,
      weekStartsOn: 1,
      loadMode: "due-week",
      from: monday
    });
    const assy = summary.centers.find((c) => c.id === "wc2");
    assert.equal(assy.weeklyCapacity, 40);
    assert.equal(assy.thisWeekCapacity, 0);
    assert.equal(assy.thisWeekTimeOff, 40);
    assert.equal(assy.capacityByWeek["2026-08-17"], 40);
  });

  it("flags jobs that cannot fit before their due date", () => {
    const summary = Calc.summarize(data, {
      planningWeeks: 4,
      weekStartsOn: 1,
      loadMode: "due-week",
      from: monday
    });
    const ids = summary.atRisk.map((row) => row.wo.id);
    assert.ok(ids.includes("a")); // 50h in a 60h week plus other load → due week over
    assert.ok(ids.includes("e")); // overdue
  });
});

describe("utilization helpers", () => {
  it("is infinite when there is load and no capacity", () => {
    assert.equal(Calc.utilization(10, 0), Infinity);
    assert.equal(Calc.utilLevel(Infinity), "over");
    assert.equal(Calc.formatUtil(Infinity), "No cap.");
  });

  it("is zero when both sides are empty", () => {
    assert.equal(Calc.utilization(0, 0), 0);
    assert.equal(Calc.formatUtil(0), "0%");
  });

  it("rounds display hours to one decimal", () => {
    assert.equal(Calc.formatHours(10), "10");
    assert.equal(Calc.formatHours(10.25), "10.3");
  });
});

describe("time off", () => {
  const person = { id: "p1", workCenterId: "wc1", hoursPerWeek: 40, efficiency: 100, workDays: 5 };
  const week = { key: "2026-08-10", start: new Date(2026, 7, 10), end: new Date(2026, 7, 16) };
  const nextWeek = { key: "2026-08-17", start: new Date(2026, 7, 17), end: new Date(2026, 7, 23) };

  it("counts weekdays only", () => {
    assert.equal(Calc.weekdayCount("2026-08-14", "2026-08-16"), 1); // Fri–Sun
    assert.equal(Calc.weekdayCount("2026-08-10", "2026-08-14"), 5);
  });

  it("can include Saturday and Sunday", () => {
    assert.equal(Calc.weekdayCount("2026-08-14", "2026-08-16", true), 3);
    const hours = Calc.absenceHoursInWeek(
      { personId: "p1", startDate: "2026-08-14", endDate: "2026-08-16", includeWeekends: true },
      person,
      week
    );
    assert.equal(hours, 24);
  });

  it("inherits weekend work from the employee when the absence does not say", () => {
    const weekendPerson = Object.assign({}, person, { worksWeekends: true });
    const hours = Calc.absenceHoursInWeek(
      { personId: "p1", startDate: "2026-08-15", endDate: "2026-08-15" },
      weekendPerson,
      week
    );
    assert.equal(hours, 8);
  });

  it("skips a weekend-only range unless weekends are included", () => {
    assert.equal(
      Calc.absenceHoursInWeek(
        { personId: "p1", startDate: "2026-08-15", endDate: "2026-08-16" },
        person,
        week
      ),
      0
    );
  });

  it("treats a full weekday as one work day of hours", () => {
    const hours = Calc.absenceHoursInWeek(
      { personId: "p1", startDate: "2026-08-12", endDate: "2026-08-12" },
      person,
      week
    );
    assert.equal(hours, 8);
  });

  it("splits a multi-day absence across weeks", () => {
    const absence = { personId: "p1", startDate: "2026-08-13", endDate: "2026-08-18" }; // Thu–Tue
    assert.equal(Calc.absenceHoursInWeek(absence, person, week), 16); // Thu Fri
    assert.equal(Calc.absenceHoursInWeek(absence, person, nextWeek), 16); // Mon Tue
  });

  it("spreads an explicit hour total across the weekdays in range", () => {
    const absence = { personId: "p1", startDate: "2026-08-10", endDate: "2026-08-11", hours: 6 };
    assert.equal(Calc.absenceHoursInWeek(absence, person, week), 6);
  });

  it("reduces available hours after efficiency", () => {
    const row = Calc.personWeekBreakdown(
      { id: "p1", hoursPerWeek: 40, efficiency: 80, workDays: 5 },
      [{ personId: "p1", startDate: "2026-08-10", endDate: "2026-08-10" }],
      week
    );
    assert.equal(row.off, 8);
    assert.equal(row.available, 25.6); // (40-8) * 0.8
  });

  it("lowers only the affected week's work-center capacity", () => {
    const weeks = Calc.planningWeeks(2, 1, monday);
    const maps = Calc.weekCapacityMaps(
      [person],
      [{ personId: "p1", type: "pto", startDate: "2026-08-17", endDate: "2026-08-19" }],
      weeks
    );
    assert.equal(maps.capacityByWeek.wc1["2026-08-10"], 40);
    assert.equal(maps.capacityByWeek.wc1["2026-08-17"], 16); // 3 days off
    assert.equal(maps.timeOffByWeek.wc1["2026-08-17"], 24);
  });

  it("does not count unassigned employees toward a center", () => {
    const maps = Calc.weekCapacityMaps(
      [{ id: "p2", workCenterId: "", hoursPerWeek: 40, efficiency: 100 }],
      [],
      Calc.planningWeeks(1, 1, monday)
    );
    assert.equal(maps.capacityByWeek.undefined, undefined);
  });
});

describe("fitsAlone", () => {
  it("allows a job that fits in the remaining weeks", () => {
    assert.equal(
      Calc.fitsAlone(wo({ remainingHours: 80, dueDate: "2026-08-20" }), 40, 1, monday),
      true
    );
  });

  it("rejects a job larger than capacity through the due week", () => {
    assert.equal(
      Calc.fitsAlone(wo({ remainingHours: 90, dueDate: "2026-08-20" }), 40, 1, monday),
      false
    );
  });

  it("rejects overdue jobs", () => {
    assert.equal(
      Calc.fitsAlone(wo({ remainingHours: 1, dueDate: "2026-08-01" }), 40, 1, monday),
      false
    );
  });
});
