/**
 * Browser persistence: localStorage plus JSON import/export.
 * Preserves suite fields (charge codes, travelers, WIs, timeEntries).
 */
(function (root) {
  const STORAGE_KEY = "capacity-tracker.v1";
  const SETTINGS_KEY = "capacity-tracker.settings.v1";

  const DEFAULT_SETTINGS = {
    siteName: "Shop floor",
    planningWeeks: 8,
    weekStartsOn: 1,
    loadMode: "due-week",
    storage: "local",
    teamApiKey: "",
    teamBinId: "",
    sharepointSiteUrl: "",
    clientId: "",
    tenantId: "",
    listWorkCenters: "CT Work Centers",
    listPeople: "CT People",
    listWorkOrders: "CT Work Orders",
    listAbsences: "CT Time Off"
  };

  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
  }

  function emptyData() {
    return {
      version: 1,
      updatedAt: 0,
      workCenters: [],
      people: [],
      workOrders: [],
      absences: [],
      travelers: [],
      assemblies: [],
      cableOps: [],
      assemblyOps: [],
      timeEntries: [],
      downtime: []
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const memoryStore = Object.create(null);

  function storageGet(key) {
    try {
      if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    } catch (err) {}
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }

  function storageSet(key, text) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, text);
        return;
      }
    } catch (err) {}
    memoryStore[key] = text;
  }

  function readJson(key, fallback) {
    try {
      const raw = storageGet(key);
      if (!raw) return clone(fallback);
      return JSON.parse(raw);
    } catch (err) {
      console.warn("Capacity Tracker: could not read storage", err);
      return clone(fallback);
    }
  }

  function writeJson(key, value) {
    storageSet(key, JSON.stringify(value));
  }

  function normalizeSettings(raw) {
    const merged = Object.assign({}, DEFAULT_SETTINGS, raw || {});
    merged.planningWeeks = Math.min(16, Math.max(4, Number(merged.planningWeeks) || 8));
    merged.weekStartsOn = Number(merged.weekStartsOn) === 0 ? 0 : 1;
    merged.loadMode = merged.loadMode === "spread" ? "spread" : "due-week";
    merged.storage = ["file", "team", "sharepoint", "local"].indexOf(merged.storage) >= 0 ? merged.storage : "local";
    merged.teamApiKey = String(merged.teamApiKey || "");
    merged.teamBinId = String(merged.teamBinId || "");
    merged.siteName = String(merged.siteName || DEFAULT_SETTINGS.siteName);
    merged.sharepointSiteUrl = String(merged.sharepointSiteUrl || "");
    merged.clientId = String(merged.clientId || "");
    merged.tenantId = String(merged.tenantId || "");
    merged.listWorkCenters = String(merged.listWorkCenters || DEFAULT_SETTINGS.listWorkCenters);
    merged.listPeople = String(merged.listPeople || DEFAULT_SETTINGS.listPeople);
    merged.listWorkOrders = String(merged.listWorkOrders || DEFAULT_SETTINGS.listWorkOrders);
    merged.listAbsences = String(merged.listAbsences || DEFAULT_SETTINGS.listAbsences);
    return merged;
  }

  function normalizeData(raw) {
    const data = emptyData();
    if (!raw || typeof raw !== "object") return data;
    data.workCenters = Array.isArray(raw.workCenters) ? raw.workCenters.map(normalizeCenter) : [];
    data.people = Array.isArray(raw.people) ? raw.people.map(normalizePerson) : [];
    data.workOrders = Array.isArray(raw.workOrders) ? raw.workOrders.map(normalizeOrder) : [];
    data.absences = Array.isArray(raw.absences) ? raw.absences.map(normalizeAbsence) : [];
    data.updatedAt = Number(raw.updatedAt) || 0;
    // Suite extras — never drop these on Capacity Tracker save
    if (Array.isArray(raw.travelers)) data.travelers = raw.travelers;
    if (Array.isArray(raw.assemblies)) data.assemblies = raw.assemblies;
    if (Array.isArray(raw.cableOps)) data.cableOps = raw.cableOps;
    if (Array.isArray(raw.assemblyOps)) data.assemblyOps = raw.assemblyOps;
    if (Array.isArray(raw.timeEntries)) data.timeEntries = raw.timeEntries;
    if (Array.isArray(raw.downtime)) data.downtime = raw.downtime;
    return data;
  }

  function normalizeColor(value) {
    const s = String(value || "").trim();
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : "#1f6f6a";
  }

  function normalizeCenter(item) {
    return {
      id: String(item.id || uid("wc")),
      name: String(item.name || "Untitled work center"),
      notes: String(item.notes || ""),
      color: normalizeColor(item.color),
      kind: String(item.kind || "")
    };
  }

  function normalizePerson(item) {
    const workDays = Number(item.workDays);
    const out = {
      id: String(item.id || uid("p")),
      name: String(item.name || "Unnamed"),
      workCenterId: item.workCenterId ? String(item.workCenterId) : "",
      hoursPerWeek: Number(item.hoursPerWeek) || 0,
      workDays: workDays >= 1 && workDays <= 7 ? workDays : 5,
      worksWeekends: Boolean(item.worksWeekends),
      efficiency: item.efficiency == null || item.efficiency === "" ? 100 : Number(item.efficiency),
      notes: String(item.notes || ""),
      role: String(item.role || "tech")
    };
    // Keep PIN fields for Work Orders / suite login
    if (item.pin != null && String(item.pin) !== "") out.pin = String(item.pin);
    if (item.mustChangePin != null) out.mustChangePin = item.mustChangePin;
    return out;
  }

  function normalizeAbsenceType(value) {
    const allowed = ["pto", "sick", "other"];
    return allowed.includes(value) ? value : "pto";
  }

  function normalizeAbsence(item) {
    const start = item.startDate ? String(item.startDate).slice(0, 10) : "";
    let end = item.endDate ? String(item.endDate).slice(0, 10) : start;
    if (start && end && end < start) end = start;
    return {
      id: String(item.id || uid("abs")),
      personId: item.personId ? String(item.personId) : "",
      type: normalizeAbsenceType(item.type),
      startDate: start,
      endDate: end,
      hours:
        item.hours === null || item.hours === undefined || item.hours === ""
          ? ""
          : Number(item.hours),
      includeWeekends: Boolean(item.includeWeekends),
      notes: String(item.notes || "")
    };
  }

  function normalizeOrder(item) {
    const out = {
      id: String(item.id || uid("wo")),
      number: String(item.number || ""),
      title: String(item.title || ""),
      workCenterId: item.workCenterId ? String(item.workCenterId) : "",
      hours: Number(item.hours) || 0,
      remainingHours:
        item.remainingHours === null || item.remainingHours === undefined || item.remainingHours === ""
          ? Number(item.hours) || 0
          : Number(item.remainingHours) || 0,
      dueDate: item.dueDate ? String(item.dueDate).slice(0, 10) : "",
      status: normalizeStatus(item.status),
      priority: normalizePriority(item.priority),
      notes: String(item.notes || ""),
      // Suite / Work Orders fields — must survive Capacity Tracker saves
      chargeCode: String(item.chargeCode || "").trim(),
      instructionKind: item.instructionKind ? String(item.instructionKind) : "",
      productTag: String(item.productTag || ""),
      assemblyId: item.assemblyId ? String(item.assemblyId) : "",
      taskNotes: String(item.taskNotes || ""),
      hoursFromWi: Boolean(item.hoursFromWi),
      assignedTechId: item.assignedTechId ? String(item.assignedTechId) : "",
      assignedTechName: String(item.assignedTechName || ""),
      assignedQaId: item.assignedQaId ? String(item.assignedQaId) : "",
      assignedQaName: String(item.assignedQaName || "")
    };
    if (item.travelerProgress != null && item.travelerProgress !== "") {
      out.travelerProgress = Number(item.travelerProgress);
    }
    if (item.currentOp) out.currentOp = String(item.currentOp);
    if (item.travelerId) out.travelerId = String(item.travelerId);
    if (item.travelerStatus) out.travelerStatus = String(item.travelerStatus);
    if (item.hoursLogged != null) out.hoursLogged = Number(item.hoursLogged) || 0;
    return out;
  }

  function normalizeStatus(value) {
    const allowed = ["queued", "in-progress", "on-hold", "complete"];
    return allowed.includes(value) ? value : "queued";
  }

  function normalizePriority(value) {
    const allowed = ["high", "medium", "low"];
    return allowed.includes(value) ? value : "medium";
  }

  const LocalStore = {
    loadSettings() {
      return normalizeSettings(readJson(SETTINGS_KEY, DEFAULT_SETTINGS));
    },
    saveSettings(settings) {
      const next = normalizeSettings(settings);
      writeJson(SETTINGS_KEY, next);
      return next;
    },
    load() {
      return normalizeData(readJson(STORAGE_KEY, emptyData()));
    },
    save(data) {
      // Merge with existing storage so suite-only keys are not wiped if caller omitted them
      const prev = readJson(STORAGE_KEY, emptyData()) || {};
      const merged = Object.assign({}, prev, data || {});
      const next = normalizeData(merged);
      writeJson(STORAGE_KEY, next);
      return next;
    },
    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
    }
  };

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvEscape(value) {
    const s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCsv(rows) {
    return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function nextWorkOrderNumber(orders) {
    let max = 1000;
    for (const wo of orders || []) {
      const match = String(wo.number || "").match(/(\d+)\s*$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `WO-${max + 1}`;
  }

  const COLORS = ["#1f6f6a", "#1d4e89", "#8a3b12", "#6b4c9a", "#3d5a40", "#9a3412", "#0f4c5c", "#7a2f4b"];

  function nextColor(centers) {
    return COLORS[(centers || []).length % COLORS.length];
  }

  function addDaysIso(iso, days) {
    const d = (root.CapacityCalc && CapacityCalc.parseDate(iso)) || new Date();
    if (root.CapacityCalc) return CapacityCalc.formatISO(CapacityCalc.addDays(d, days));
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x.toISOString().slice(0, 10);
  }

  function demoData(from) {
    const today = root.CapacityCalc
      ? CapacityCalc.formatISO(from || new Date())
      : new Date().toISOString().slice(0, 10);
    const wc = [
      { id: "wc_laser", name: "Laser / Burn", notes: "Table 1 & 2", color: "#1d4e89" },
      { id: "wc_brake", name: "Press Brake", notes: "120-ton", color: "#6b4c9a" },
      { id: "wc_weld", name: "Welding", notes: "MIG / TIG booths", color: "#8a3b12" },
      { id: "wc_assy", name: "Assembly", notes: "Final build", color: "#1f6f6a" },
      { id: "wc_paint", name: "Paint / Finish", notes: "Booth A", color: "#0f4c5c" }
    ];
    const people = [
      { id: "p1", name: "Maya Chen", workCenterId: "wc_laser", hoursPerWeek: 40, workDays: 5, efficiency: 90, notes: "" },
      { id: "p2", name: "Luis Ortega", workCenterId: "wc_laser", hoursPerWeek: 40, workDays: 5, efficiency: 85, notes: "" },
      { id: "p3", name: "Priya Shah", workCenterId: "wc_brake", hoursPerWeek: 40, workDays: 5, efficiency: 95, notes: "" },
      { id: "p4", name: "Chris Nguyen", workCenterId: "wc_weld", hoursPerWeek: 40, workDays: 5, efficiency: 90, notes: "" },
      { id: "p5", name: "Dana Brooks", workCenterId: "wc_weld", hoursPerWeek: 40, workDays: 5, efficiency: 80, notes: "" },
      { id: "p6", name: "Omar Haddad", workCenterId: "wc_weld", hoursPerWeek: 32, workDays: 4, efficiency: 85, notes: "4-day week" },
      { id: "p7", name: "Elena Rossi", workCenterId: "wc_assy", hoursPerWeek: 40, workDays: 5, efficiency: 100, notes: "" },
      { id: "p8", name: "James Okoye", workCenterId: "wc_assy", hoursPerWeek: 20, workDays: 5, efficiency: 100, notes: "Part-time" },
      { id: "p9", name: "Hannah Kim", workCenterId: "wc_paint", hoursPerWeek: 48, workDays: 6, worksWeekends: true, efficiency: 85, notes: "Works Saturdays" },
      { id: "p10", name: "Riley Cole", workCenterId: "", hoursPerWeek: 40, workDays: 5, efficiency: 100, notes: "New hire — not assigned yet" }
    ];
    const absences = [
      { id: "abs1", personId: "p4", type: "sick", startDate: addDaysIso(today, 1), endDate: addDaysIso(today, 1), hours: "", notes: "Flu" },
      { id: "abs2", personId: "p1", type: "pto", startDate: addDaysIso(today, 7), endDate: addDaysIso(today, 9), hours: "", notes: "Long weekend" },
      { id: "abs3", personId: "p7", type: "pto", startDate: addDaysIso(today, 14), endDate: addDaysIso(today, 18), hours: "", notes: "Vacation" },
      { id: "abs4", personId: "p3", type: "other", startDate: addDaysIso(today, 3), endDate: addDaysIso(today, 3), hours: 4, notes: "School conference, half day" },
      { id: "abs5", personId: "p9", type: "pto", startDate: addDaysIso(today, 5), endDate: addDaysIso(today, 6), hours: "", includeWeekends: true, notes: "Weekend off" }
    ];
    const workOrders = [
      { id: "wo1", number: "WO-1041", title: "Frame kit — Northline", workCenterId: "wc_laser", hours: 28, remainingHours: 28, dueDate: addDaysIso(today, 2), status: "in-progress", priority: "high", notes: "" },
      { id: "wo2", number: "WO-1042", title: "Guard panels", workCenterId: "wc_laser", hours: 36, remainingHours: 36, dueDate: addDaysIso(today, 4), status: "queued", priority: "medium", notes: "" },
      { id: "wo3", number: "WO-1044", title: "Hopper sides", workCenterId: "wc_brake", hours: 18, remainingHours: 10, dueDate: addDaysIso(today, 3), status: "in-progress", priority: "high", notes: "" },
      { id: "wo4", number: "WO-1045", title: "Skid weldment", workCenterId: "wc_weld", hours: 60, remainingHours: 60, dueDate: addDaysIso(today, 5), status: "queued", priority: "high", notes: "Customer hold lifted" },
      { id: "wo5", number: "WO-1046", title: "Handrail lot", workCenterId: "wc_weld", hours: 24, remainingHours: 24, dueDate: addDaysIso(today, 8), status: "queued", priority: "medium", notes: "" },
      { id: "wo6", number: "WO-1048", title: "Cart assembly", workCenterId: "wc_assy", hours: 16, remainingHours: 16, dueDate: addDaysIso(today, 6), status: "queued", priority: "medium", notes: "" },
      { id: "wo7", number: "WO-1033", title: "Repair — mixer lid", workCenterId: "wc_weld", hours: 12, remainingHours: 8, dueDate: addDaysIso(today, -2), status: "in-progress", priority: "high", notes: "Already late" },
      { id: "wo8", number: "WO-1049", title: "Enclosures — 6 ea", workCenterId: "wc_paint", hours: 22, remainingHours: 22, dueDate: addDaysIso(today, 11), status: "queued", priority: "low", notes: "" },
      { id: "wo9", number: "WO-1050", title: "Platform weldment", workCenterId: "wc_weld", hours: 48, remainingHours: 48, dueDate: addDaysIso(today, 12), status: "queued", priority: "medium", notes: "" },
      { id: "wo10", number: "WO-1051", title: "Control box build", workCenterId: "wc_assy", hours: 30, remainingHours: 30, dueDate: addDaysIso(today, 14), status: "queued", priority: "medium", notes: "" },
      { id: "wo11", number: "WO-1028", title: "Bracket lot", workCenterId: "wc_brake", hours: 14, remainingHours: 0, dueDate: addDaysIso(today, -5), status: "complete", priority: "low", notes: "" },
      { id: "wo12", number: "WO-1052", title: "Tank wrappers", workCenterId: "wc_laser", hours: 40, remainingHours: 40, dueDate: addDaysIso(today, 18), status: "queued", priority: "medium", notes: "" },
      { id: "wo13", number: "WO-1055", title: "Stair stringers", workCenterId: "wc_brake", hours: 26, remainingHours: 26, dueDate: addDaysIso(today, 21), status: "queued", priority: "high", notes: "" },
      { id: "wo14", number: "WO-1056", title: "Mezzanine rails", workCenterId: "wc_weld", hours: 70, remainingHours: 70, dueDate: addDaysIso(today, 25), status: "on-hold", priority: "low", notes: "Waiting on steel" }
    ];
    return normalizeData({ version: 1, workCenters: wc, people, workOrders, absences });
  }

  root.CapacityStore = {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    uid,
    emptyData,
    clone,
    normalizeData,
    normalizeSettings,
    normalizeCenter,
    normalizePerson,
    normalizeOrder,
    normalizeAbsence,
    LocalStore,
    download,
    toCsv,
    stamp,
    nextWorkOrderNumber,
    nextColor,
    demoData
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
