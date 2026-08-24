/**
 * Capacity math for work centers, people, and work orders.
 * Works in the browser (window.CapacityCalc) and in Node tests.
 *
 * Lead-time standards (every open work order):
 *   Ordering center — 1 hour, week of (kitting start − 6 weeks)
 *   Kitting center  — 1 hour per kit, week of (job start − 3 workdays)
 * Centers are matched by name ("Ordering", "Kitting") or wc.kind.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CapacityCalc = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MS_DAY = 86400000;
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  /** Standard overhead hours applied to lead-time centers per open WO */
  const LEAD = {
    orderingHours: 1,
    kittingHoursPerKit: 1,
    kittingLeadWorkdays: 3,
    orderingLeadWeeks: 6,
    hoursPerWorkDay: 8
  };

  function parseDate(value) {
    if (!value && value !== 0) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const s = String(value).trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function formatISO(date) {
    const d = date instanceof Date ? date : parseDate(date);
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatShort(date) {
    const d = date instanceof Date ? date : parseDate(date);
    if (!d) return "";
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }

  function startOfWeek(date, weekStartsOn) {
    const startOn = weekStartsOn == null ? 1 : Number(weekStartsOn);
    const d = parseDate(date) || parseDate(new Date());
    const day = d.getDay();
    const diff = (day - startOn + 7) % 7;
    return addDays(d, -diff);
  }

  function addDays(date, n) {
    const d = parseDate(date) || parseDate(new Date());
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + Number(n));
  }

  function isWeekday(date) {
    const d = parseDate(date);
    if (!d) return false;
    const day = d.getDay();
    return day !== 0 && day !== 6;
  }

  function isWeekend(date) {
    const d = parseDate(date);
    if (!d) return false;
    const day = d.getDay();
    return day === 0 || day === 6;
  }

  /** Move n workdays forward (n>0) or backward (n<0), skipping weekends. */
  function addWorkDays(date, n) {
    const d = parseDate(date) || parseDate(new Date());
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const step = n >= 0 ? 1 : -1;
    let left = Math.abs(Number(n) || 0);
    while (left > 0) {
      out.setDate(out.getDate() + step);
      if (isWeekday(out)) left -= 1;
    }
    return out;
  }

  function weekKey(date, weekStartsOn) {
    return formatISO(startOfWeek(date, weekStartsOn));
  }

  function weekLabel(start, end) {
    return `${formatShort(start)}–${formatShort(end)}`;
  }

  function planningWeeks(count, weekStartsOn, from) {
    const n = Math.max(1, Number(count) || 8);
    const origin = startOfWeek(from || new Date(), weekStartsOn);
    const weeks = [];
    for (let i = 0; i < n; i++) {
      const start = addDays(origin, i * 7);
      const end = addDays(start, 6);
      weeks.push({
        index: i,
        key: formatISO(start),
        start,
        end,
        label: weekLabel(start, end),
        isCurrent: i === 0
      });
    }
    return weeks;
  }

  function num(value, fallback) {
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function workDays(person) {
    const days = num(person && person.workDays, 5);
    return days > 0 ? days : 5;
  }

  function hoursPerWorkDay(person) {
    const weekly = num(person && person.hoursPerWeek, 0);
    if (weekly <= 0) return 0;
    return weekly / workDays(person);
  }

  function efficiencyFactor(person) {
    const eff = num(person && person.efficiency, 100);
    return eff > 0 ? eff / 100 : 0;
  }

  function effectiveWeeklyHours(person) {
    const hours = num(person && person.hoursPerWeek, 0);
    if (hours <= 0) return 0;
    return hours * efficiencyFactor(person);
  }

  function flagOn(value) {
    return value === true || value === "true" || value === "on" || value === 1 || value === "1";
  }

  function countsWeekends(person, absence) {
    if (absence && absence.includeWeekends !== undefined && absence.includeWeekends !== null && absence.includeWeekends !== "") {
      return flagOn(absence.includeWeekends);
    }
    return flagOn(person && person.worksWeekends);
  }

  function isCountableDay(date, includeWeekends) {
    if (isWeekday(date)) return true;
    return Boolean(includeWeekends) && isWeekend(date);
  }

  function eachDate(start, end, fn) {
    const a = parseDate(start);
    const b = parseDate(end) || a;
    if (!a || !b) return;
    let cursor = a <= b ? a : b;
    const stop = a <= b ? b : a;
    while (cursor <= stop) {
      fn(new Date(cursor.getTime()));
      cursor = addDays(cursor, 1);
    }
  }

  function weekdayCount(start, end, includeWeekends) {
    let count = 0;
    eachDate(start, end, (d) => {
      if (isCountableDay(d, includeWeekends)) count += 1;
    });
    return count;
  }

  function datesOverlap(aStart, aEnd, bStart, bEnd) {
    const a0 = parseDate(aStart);
    const a1 = parseDate(aEnd) || a0;
    const b0 = parseDate(bStart);
    const b1 = parseDate(bEnd) || b0;
    if (!a0 || !b0) return false;
    const aLo = a0 <= a1 ? a0 : a1;
    const aHi = a0 <= a1 ? a1 : a0;
    return aLo <= b1 && aHi >= b0;
  }

  function hasExplicitHours(absence) {
    return !(absence.hours === null || absence.hours === undefined || absence.hours === "");
  }

  function weekdayCountInWeek(start, end, week, includeWeekends) {
    let count = 0;
    eachDate(start, end, (d) => {
      if (isCountableDay(d, includeWeekends) && d >= week.start && d <= week.end) count += 1;
    });
    return count;
  }

  function absenceHoursInWeek(absence, person, week) {
    if (!absence || !week) return 0;
    const start = absence.startDate;
    const end = absence.endDate || absence.startDate;
    if (!datesOverlap(start, end, week.start, week.end)) return 0;

    const weekends = countsWeekends(person, absence);
    const daysInWeek = weekdayCountInWeek(start, end, week, weekends);
    const daysTotal = weekdayCount(start, end, weekends);

    if (hasExplicitHours(absence)) {
      const total = Math.max(0, num(absence.hours, 0));
      if (daysTotal === 0) {
        const s = parseDate(start);
        return s && s >= week.start && s <= week.end ? total : 0;
      }
      return total * (daysInWeek / daysTotal);
    }

    return daysInWeek * hoursPerWorkDay(person);
  }

  function timeOffHoursForPerson(person, absences, week) {
    if (!person) return 0;
    const pid = String(person.id);
    let off = 0;
    for (const absence of absences || []) {
      if (!absence || String(absence.personId) !== pid) continue;
      off += absenceHoursInWeek(absence, person, week);
    }
    return Math.min(off, Math.max(0, num(person.hoursPerWeek, 0)));
  }

  function personWeekBreakdown(person, absences, week) {
    const baseHours = Math.max(0, num(person && person.hoursPerWeek, 0));
    const off = timeOffHoursForPerson(person, absences, week);
    const remainingClock = Math.max(0, baseHours - off);
    const factor = efficiencyFactor(person);
    return {
      baseHours,
      off,
      remainingClock,
      available: remainingClock * factor,
      effectiveBase: baseHours * factor
    };
  }

  function upcomingAbsence(person, absences, from) {
    const today = parseDate(from || new Date());
    const pid = String(person && person.id);
    return (absences || [])
      .filter((a) => a && String(a.personId) === pid)
      .filter((a) => {
        const end = parseDate(a.endDate || a.startDate);
        return end && end >= today;
      })
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0] || null;
  }

  function remainingHours(wo) {
    if (!wo || wo.status === "complete") return 0;
    if (wo.remainingHours === null || wo.remainingHours === undefined || wo.remainingHours === "") {
      return Math.max(0, num(wo.hours, 0));
    }
    return Math.max(0, num(wo.remainingHours, 0));
  }

  function isOpen(wo) {
    return Boolean(wo) && wo.status !== "complete";
  }

  function isOverdue(wo, from) {
    if (!isOpen(wo)) return false;
    const due = parseDate(wo.dueDate);
    if (!due) return false;
    const today = parseDate(from || new Date());
    return due < today;
  }

  function weeksUntilDue(dueDate, weekStartsOn, from) {
    const due = parseDate(dueDate);
    if (!due) return null;
    const dueWeek = startOfWeek(due, weekStartsOn);
    const nowWeek = startOfWeek(from || new Date(), weekStartsOn);
    return Math.round((dueWeek - nowWeek) / (7 * MS_DAY));
  }

  /**
   * Classify a work center for lead-time rules.
   * Prefer explicit wc.kind; otherwise match name.
   */
  function centerKind(wc) {
    if (!wc) return "production";
    const k = String(wc.kind || wc.role || "").toLowerCase().trim();
    if (k === "ordering" || k === "order") return "ordering";
    if (k === "kitting" || k === "kit") return "kitting";
    if (k === "qa" || k === "quality" || k === "inspection") return "qa";
    const n = String(wc.name || "").toLowerCase();
    if (/\border(ing)?\b/.test(n)) return "ordering";
    if (/\bkit(ting)?\b/.test(n)) return "kitting";
    if (/\bqa\b|\bquality\b|\binspect/.test(n)) return "qa";
    return "production";
  }

  /**
   * Must-start date = due date minus workdays needed for remaining hours (8h/day).
   */
  function mustStartDate(wo, hoursPerDay) {
    if (!wo || !isOpen(wo)) return null;
    const due = parseDate(wo.dueDate);
    if (!due) return null;
    const rem = remainingHours(wo);
    if (rem <= 0) return null;
    const hpd = hoursPerDay > 0 ? hoursPerDay : LEAD.hoursPerWorkDay;
    const daysNeeded = Math.max(1, Math.ceil(rem / hpd));
    let lastWork = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    if (!isWeekday(lastWork)) lastWork = addWorkDays(lastWork, -1);
    return daysNeeded <= 1 ? lastWork : addWorkDays(lastWork, -(daysNeeded - 1));
  }

  /**
   * Kit qty for kitting hours. Defaults to 1 kit per work order.
   */
  function kitQuantity(wo) {
    const q = num(wo && (wo.kitQty != null ? wo.kitQty : wo.quantity), 1);
    return q > 0 ? q : 1;
  }

  /**
   * Lead-time schedule for one open work order.
   * jobStart → kittingStart (3 workdays earlier) → orderingStart (6 weeks earlier).
   */
  function leadTimeSchedule(wo, hoursPerDay) {
    const jobStart = mustStartDate(wo, hoursPerDay);
    if (!jobStart) return null;
    const kittingStart = addWorkDays(jobStart, -LEAD.kittingLeadWorkdays);
    const orderingStart = addDays(kittingStart, -(LEAD.orderingLeadWeeks * 7));
    return {
      jobStart,
      kittingStart,
      orderingStart,
      orderingHours: LEAD.orderingHours,
      kittingHours: LEAD.kittingHoursPerKit * kitQuantity(wo)
    };
  }

  function weeklyCapacityByCenter(people) {
    const map = Object.create(null);
    for (const person of people || []) {
      if (!person || !person.workCenterId) continue;
      const id = String(person.workCenterId);
      map[id] = (map[id] || 0) + effectiveWeeklyHours(person);
    }
    return map;
  }

  function headcountByCenter(people) {
    const map = Object.create(null);
    for (const person of people || []) {
      if (!person || !person.workCenterId) continue;
      const id = String(person.workCenterId);
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }

  function utilization(load, capacity) {
    const l = num(load, 0);
    const c = num(capacity, 0);
    if (c <= 0) return l > 0 ? Infinity : 0;
    return l / c;
  }

  function utilLevel(util) {
    if (!Number.isFinite(util)) return util > 0 ? "over" : "none";
    if (util > 1) return "over";
    if (util >= 0.85) return "tight";
    if (util >= 0.55) return "healthy";
    if (util > 0) return "light";
    return "none";
  }

  function formatUtil(util) {
    if (!Number.isFinite(util)) return util > 0 ? "No cap." : "—";
    return `${Math.round(util * 100)}%`;
  }

  function formatHours(value) {
    const n = num(value, 0);
    const rounded = Math.round(n * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function distributeHours(wo, weeks, weekStartsOn, mode, from) {
    const hours = remainingHours(wo);
    if (hours <= 0) return {};

    const due = parseDate(wo.dueDate);
    if (!due) return { unscheduled: hours };

    const currentStart = startOfWeek(from || new Date(), weekStartsOn);
    const dueStart = startOfWeek(due, weekStartsOn);
    const dueKey = formatISO(dueStart);
    const horizonKeys = new Set((weeks || []).map((w) => w.key));

    if (dueStart < currentStart) {
      return { overdue: hours };
    }

    if (mode !== "spread") {
      if (horizonKeys.has(dueKey)) return { [dueKey]: hours };
      return { later: hours };
    }

    const keys = [];
    let cursor = new Date(currentStart.getTime());
    while (cursor <= dueStart) {
      keys.push(formatISO(cursor));
      cursor = addDays(cursor, 7);
    }
    if (!keys.length) return { overdue: hours };

    const per = hours / keys.length;
    const out = Object.create(null);
    for (const key of keys) {
      if (horizonKeys.has(key)) {
        out[key] = (out[key] || 0) + per;
      } else {
        out.later = (out.later || 0) + per;
      }
    }
    return out;
  }

  function emptyWeekMap(weeks) {
    const map = Object.create(null);
    for (const week of weeks) map[week.key] = 0;
    return map;
  }

  function emptyCenter(wc, weeklyCap, headcount, weeks) {
    const capacityByWeek = emptyWeekMap(weeks);
    const timeOffByWeek = emptyWeekMap(weeks);
    for (const week of weeks) capacityByWeek[week.key] = weeklyCap;
    return {
      id: String(wc.id),
      name: wc.name || "Untitled",
      notes: wc.notes || "",
      color: wc.color || "#1f6f6a",
      kind: centerKind(wc),
      weeklyCapacity: weeklyCap,
      headcount,
      remainingHours: 0,
      overdueHours: 0,
      laterHours: 0,
      unscheduledHours: 0,
      completeHours: 0,
      openCount: 0,
      leadOrderingHours: 0,
      leadKittingHours: 0,
      loadByWeek: emptyWeekMap(weeks),
      capacityByWeek,
      timeOffByWeek,
      orders: [],
      overdueOrders: [],
      thisWeekLoad: 0,
      thisWeekCapacity: weeklyCap,
      thisWeekTimeOff: 0,
      thisWeekUtil: 0,
      thisWeekLevel: "none",
      horizonLoad: 0,
      horizonCapacity: weeklyCap * weeks.length,
      horizonUtil: 0,
      horizonLevel: "none",
      availableThisWeek: weeklyCap
    };
  }

  function applyWeekCapacity(center, weeks, capacityByWeek, timeOffByWeek) {
    const id = center.id;
    for (const week of weeks) {
      if (capacityByWeek && capacityByWeek[id]) {
        center.capacityByWeek[week.key] = capacityByWeek[id][week.key] || 0;
      }
      if (timeOffByWeek && timeOffByWeek[id]) {
        center.timeOffByWeek[week.key] = timeOffByWeek[id][week.key] || 0;
      }
    }
    return center;
  }

  function finalizeCenter(center, weeks) {
    const thisKey = weeks.length ? weeks[0].key : "";
    center.thisWeekLoad = thisKey ? center.loadByWeek[thisKey] || 0 : 0;
    center.thisWeekCapacity = thisKey ? center.capacityByWeek[thisKey] || 0 : 0;
    center.thisWeekTimeOff = thisKey ? center.timeOffByWeek[thisKey] || 0 : 0;
    center.thisWeekUtil = utilization(center.thisWeekLoad, center.thisWeekCapacity);
    center.thisWeekLevel = utilLevel(center.thisWeekUtil);
    center.horizonLoad = weeks.reduce((sum, week) => sum + (center.loadByWeek[week.key] || 0), 0);
    center.horizonCapacity = weeks.reduce((sum, week) => sum + (center.capacityByWeek[week.key] || 0), 0);
    center.horizonUtil = utilization(center.horizonLoad, center.horizonCapacity);
    center.horizonLevel = utilLevel(center.horizonUtil);
    center.availableThisWeek = center.thisWeekCapacity - center.thisWeekLoad;
    return center;
  }

  function rollup(centers, weeks) {
    const totals = emptyCenter(
      { id: "all", name: "All work centers", color: "#1f6f6a" },
      centers.reduce((s, c) => s + c.weeklyCapacity, 0),
      centers.reduce((s, c) => s + c.headcount, 0),
      weeks
    );
    for (const week of weeks) {
      totals.capacityByWeek[week.key] = 0;
      totals.timeOffByWeek[week.key] = 0;
    }
    for (const center of centers) {
      totals.remainingHours += center.remainingHours;
      totals.overdueHours += center.overdueHours;
      totals.laterHours += center.laterHours;
      totals.unscheduledHours += center.unscheduledHours;
      totals.completeHours += center.completeHours;
      totals.openCount += center.openCount;
      totals.leadOrderingHours += center.leadOrderingHours || 0;
      totals.leadKittingHours += center.leadKittingHours || 0;
      totals.orders = totals.orders.concat(center.orders);
      totals.overdueOrders = totals.overdueOrders.concat(center.overdueOrders);
      for (const week of weeks) {
        totals.loadByWeek[week.key] += center.loadByWeek[week.key] || 0;
        totals.capacityByWeek[week.key] += center.capacityByWeek[week.key] || 0;
        totals.timeOffByWeek[week.key] += center.timeOffByWeek[week.key] || 0;
      }
    }
    return finalizeCenter(totals, weeks);
  }

  function fitsAlone(wo, weeklyCapacity, weekStartsOn, from, capacityByWeek) {
    if (!isOpen(wo)) return true;
    const hours = remainingHours(wo);
    if (hours <= 0) return true;
    const until = weeksUntilDue(wo.dueDate, weekStartsOn, from);
    if (until == null) return true;
    if (until < 0) return false;
    if (capacityByWeek && typeof capacityByWeek === "object") {
      const origin = startOfWeek(from || new Date(), weekStartsOn);
      let sum = 0;
      for (let i = 0; i <= until; i++) {
        sum += num(capacityByWeek[formatISO(addDays(origin, i * 7))], 0);
      }
      return hours <= sum + 1e-9;
    }
    const cap = num(weeklyCapacity, 0);
    if (cap <= 0) return false;
    return hours <= cap * (until + 1) + 1e-9;
  }

  function weekCapacityMaps(people, absences, weeks) {
    const capacityByWeek = Object.create(null);
    const timeOffByWeek = Object.create(null);
    for (const person of people || []) {
      if (!person || !person.workCenterId) continue;
      const id = String(person.workCenterId);
      if (!capacityByWeek[id]) {
        capacityByWeek[id] = emptyWeekMap(weeks);
        timeOffByWeek[id] = emptyWeekMap(weeks);
      }
      for (const week of weeks) {
        const row = personWeekBreakdown(person, absences, week);
        capacityByWeek[id][week.key] += row.available;
        timeOffByWeek[id][week.key] += row.off;
      }
    }
    return { capacityByWeek, timeOffByWeek };
  }

  function findCenterByKind(byCenter, workCenters, kind) {
    for (const wc of workCenters || []) {
      if (centerKind(wc) === kind) {
        const row = byCenter[String(wc.id)];
        if (row) return row;
      }
    }
    return null;
  }

  /**
   * Drop Ordering / Kitting hours onto their centers for every open WO.
   * Production hours still land on the WO's assigned center via distributeHours.
   */
  function applyLeadTimeLoad(byCenter, workCenters, orders, weeks, weekStartsOn, from) {
    const horizonKeys = new Set((weeks || []).map((w) => w.key));
    const currentStart = startOfWeek(from || new Date(), weekStartsOn);
    const orderingCenter = findCenterByKind(byCenter, workCenters, "ordering");
    const kittingCenter = findCenterByKind(byCenter, workCenters, "kitting");
    if (!orderingCenter && !kittingCenter) return;

    for (const wo of orders || []) {
      if (!isOpen(wo)) continue;
      const sched = leadTimeSchedule(wo, LEAD.hoursPerWorkDay);
      if (!sched) continue;

      function place(center, when, hours, field) {
        if (!center || hours <= 0 || !when) return;
        const weekStart = startOfWeek(when, weekStartsOn);
        const key = formatISO(weekStart);
        if (weekStart < currentStart) {
          center.overdueHours += hours;
          center.remainingHours += hours;
          if (field) center[field] = (center[field] || 0) + hours;
          return;
        }
        if (horizonKeys.has(key)) {
          center.loadByWeek[key] = (center.loadByWeek[key] || 0) + hours;
          center.remainingHours += hours;
          if (field) center[field] = (center[field] || 0) + hours;
        } else {
          center.laterHours += hours;
          center.remainingHours += hours;
          if (field) center[field] = (center[field] || 0) + hours;
        }
      }

      place(orderingCenter, sched.orderingStart, sched.orderingHours, "leadOrderingHours");
      place(kittingCenter, sched.kittingStart, sched.kittingHours, "leadKittingHours");
    }
  }

  function summarize(data, options) {
    const opts = options || {};
    const weekCount = num(opts.planningWeeks, 8);
    const weekStartsOn = num(opts.weekStartsOn, 1);
    const loadMode = opts.loadMode === "spread" ? "spread" : "due-week";
    const from = opts.from || new Date();
    const weeks = planningWeeks(weekCount, weekStartsOn, from);
    const people = (data && data.people) || [];
    const orders = (data && data.workOrders) || [];
    const workCenters = (data && data.workCenters) || [];
    const absences = (data && data.absences) || [];
    const capacity = weeklyCapacityByCenter(people);
    const headcount = headcountByCenter(people);
    const weekMaps = weekCapacityMaps(people, absences, weeks);
    const byCenter = Object.create(null);

    for (const wc of workCenters) {
      const id = String(wc.id);
      byCenter[id] = applyWeekCapacity(
        emptyCenter(wc, capacity[id] || 0, headcount[id] || 0, weeks),
        weeks,
        weekMaps.capacityByWeek,
        weekMaps.timeOffByWeek
      );
    }

    const unassigned = { hours: 0, orders: [] };

    for (const wo of orders) {
      const wcId = wo.workCenterId ? String(wo.workCenterId) : "";
      const target = wcId ? byCenter[wcId] : null;
      const rem = remainingHours(wo);

      if (!target) {
        if (isOpen(wo) && rem > 0) {
          unassigned.hours += rem;
          unassigned.orders.push(wo);
        }
        continue;
      }

      target.orders.push(wo);
      if (!isOpen(wo)) {
        target.completeHours += Math.max(0, num(wo.hours, 0));
        continue;
      }

      target.openCount += 1;
      target.remainingHours += rem;
      const buckets = distributeHours(wo, weeks, weekStartsOn, loadMode, from);
      if (buckets.overdue) {
        target.overdueHours += buckets.overdue;
        target.overdueOrders.push(wo);
      }
      if (buckets.unscheduled) target.unscheduledHours += buckets.unscheduled;
      if (buckets.later) target.laterHours += buckets.later;
      for (const week of weeks) {
        const hours = buckets[week.key] || 0;
        if (hours) target.loadByWeek[week.key] += hours;
      }
    }

    // Ordering 1h / Kitting 1h per kit — timed from job must-start
    applyLeadTimeLoad(byCenter, workCenters, orders, weeks, weekStartsOn, from);

    const centers = workCenters.map((wc) => finalizeCenter(byCenter[String(wc.id)], weeks));
    const totals = rollup(centers, weeks);

    const atRisk = [];
    for (const center of centers) {
      for (const wo of center.orders) {
        if (!isOpen(wo)) continue;
        const due = parseDate(wo.dueDate);
        const dueKey = due ? weekKey(due, weekStartsOn) : null;
        const dueWeekLoad = dueKey && Object.prototype.hasOwnProperty.call(center.loadByWeek, dueKey)
          ? center.loadByWeek[dueKey]
          : 0;
        const dueWeekCap = dueKey && Object.prototype.hasOwnProperty.call(center.capacityByWeek, dueKey)
          ? center.capacityByWeek[dueKey]
          : center.weeklyCapacity;
        const dueWeekOver = dueKey && Object.prototype.hasOwnProperty.call(center.loadByWeek, dueKey)
          ? dueWeekLoad > dueWeekCap + 1e-9
          : false;
        const overdue = isOverdue(wo, from);
        const alone = fitsAlone(wo, center.weeklyCapacity, weekStartsOn, from, center.capacityByWeek);
        if (overdue || dueWeekOver || !alone) {
          atRisk.push({
            wo,
            workCenter: center,
            overdue,
            dueWeekOver,
            fitsAlone: alone
          });
        }
      }
    }

    return {
      weeks,
      centers,
      totals,
      unassigned,
      atRisk,
      absences,
      loadMode,
      weekStartsOn,
      asOf: parseDate(from),
      leadStandards: Object.assign({}, LEAD)
    };
  }

  return {
    parseDate,
    formatISO,
    formatShort,
    formatHours,
    formatUtil,
    startOfWeek,
    addDays,
    addWorkDays,
    weekKey,
    weekLabel,
    planningWeeks,
    workDays,
    hoursPerWorkDay,
    effectiveWeeklyHours,
    isWeekday,
    isWeekend,
    countsWeekends,
    isCountableDay,
    weekdayCount,
    remainingHours,
    isOpen,
    isOverdue,
    weeksUntilDue,
    centerKind,
    mustStartDate,
    leadTimeSchedule,
    kitQuantity,
    LEAD,
    weeklyCapacityByCenter,
    headcountByCenter,
    utilization,
    utilLevel,
    distributeHours,
    fitsAlone,
    absenceHoursInWeek,
    timeOffHoursForPerson,
    personWeekBreakdown,
    upcomingAbsence,
    weekCapacityMaps,
    summarize
  };
});
