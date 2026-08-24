/**
 * Check-in time tracker → capacity-tracker.v1 timeEntries
 * Start when a traveler opens; stop on Exit / Complete / unload.
 */
(function (root) {
  const STORAGE_KEY = "capacity-tracker.v1";
  const ACTIVE_KEY = "capacity-tracker.activeTime";

  function uid() {
    return "te_" + Math.random().toString(36).slice(2, 10);
  }

  function loadBase() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveEntry(entry) {
    const base = loadBase();
    if (!Array.isArray(base.timeEntries)) base.timeEntries = [];
    base.timeEntries.push(entry);
    base.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    return entry;
  }

  function readActive() {
    try {
      return JSON.parse(sessionStorage.getItem(ACTIVE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeActive(a) {
    if (!a) sessionStorage.removeItem(ACTIVE_KEY);
    else sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(a));
  }

  /**
   * Start (or ignore if same WO already running).
   * session: { personId, name }
   * wo: work order object
   */
  function start(session, wo, travelerId) {
    if (!session || !wo) return null;
    const cur = readActive();
    if (cur && String(cur.workOrderId) === String(wo.id)) {
      return cur; // already timing this job
    }
    if (cur) stop(); // switch jobs → close previous
    const active = {
      travelerId: travelerId || "",
      workOrderId: String(wo.id),
      workOrderNumber: wo.number || "",
      chargeCode: (wo.chargeCode && String(wo.chargeCode).trim()) || "UNASSIGNED",
      productTag: wo.productTag || wo.instructionKind || "",
      instructionKind: wo.instructionKind || "",
      personId: String(session.personId || session.userId || ""),
      personName: session.name || "",
      startedAt: Date.now(),
      source: "checkin"
    };
    writeActive(active);
    return active;
  }

  /** Stop active session and persist if at least 15 seconds. */
  function stop() {
    const cur = readActive();
    writeActive(null);
    if (!cur || !cur.startedAt) return null;
    const endedAt = Date.now();
    const durationMs = Math.max(0, endedAt - Number(cur.startedAt));
    if (durationMs < 15000) return null; // ignore accidental clicks
    return saveEntry({
      id: uid(),
      personId: cur.personId,
      personName: cur.personName,
      workOrderId: cur.workOrderId,
      workOrderNumber: cur.workOrderNumber,
      chargeCode: cur.chargeCode || "UNASSIGNED",
      productTag: cur.productTag || "",
      instructionKind: cur.instructionKind || "",
      startedAt: new Date(cur.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationMs: durationMs,
      source: cur.source || "checkin"
    });
  }

  function current() {
    return readActive();
  }

  function elapsedMs() {
    const cur = readActive();
    if (!cur || !cur.startedAt) return 0;
    return Math.max(0, Date.now() - Number(cur.startedAt));
  }

  // Survive refresh / tab close
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", function () {
      stop();
    });
    window.addEventListener("pagehide", function () {
      stop();
    });
  }

  root.TimeTrack = { start: start, stop: stop, current: current, elapsedMs: elapsedMs, ACTIVE_KEY: ACTIVE_KEY };
})(typeof window !== "undefined" ? window : globalThis);
