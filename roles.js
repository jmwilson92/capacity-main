/**
 * Shop-floor roles and permissions.
 * Session: capacity-tracker.session { personId, name, role }
 *
 * Floor Tech  — only assigned WOs; sign Tech steps only; create downtime; view analytics
 * QA          — only assigned WOs; sign QA steps only; create downtime; view analytics
 * Mfg Eng     — edit work instructions / steps; resolve downtime; set WI type
 * Supervisor  — assign work; create task orders; view analytics
 * Manager     — create work orders; charge codes; assign; view analytics + downtime
 * Admin       — everything
 */
(function (root) {
  var SESSION_KEY = "capacity-tracker.session";
  var STORAGE_KEY = "capacity-tracker.v1";

  var LABELS = {
    tech: "Floor Tech",
    qa: "QA",
    mfgeng: "Mfg Eng",
    supervisor: "Supervisor",
    manager: "Manager",
    admin: "Admin"
  };

  var ORDER = ["tech", "qa", "mfgeng", "supervisor", "manager", "admin"];

  function normRole(r) {
    var s = String(r || "tech").toLowerCase().replace(/\s+/g, "");
    if (s === "floortech" || s === "technician") return "tech";
    if (s === "quality" || s === "inspector") return "qa";
    if (s === "mfg" || s === "mfgengineer" || s === "engineer" || s === "me") return "mfgeng";
    if (s === "super" || s === "lead") return "supervisor";
    if (s === "mgr") return "manager";
    if (LABELS[s]) return s;
    return "tech";
  }

  function session() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function roleOf(s) {
    s = s || session();
    if (!s) return "tech";
    return normRole(s.role);
  }

  function label(r) {
    return LABELS[normRole(r)] || r || "Floor Tech";
  }

  /** Permission checks — admin always true */
  function can(action, s) {
    var r = roleOf(s);
    if (r === "admin") return true;

    switch (action) {
      // Everyone can view boards / analytics (read-only for lower roles)
      case "viewAnalytics":
      case "viewWip":
      case "viewCapacity":
      case "viewDowntime":
        return true;

      // All shop roles can open a downtime ticket
      case "createDowntime":
        return true;

      // Resolve / close / delete downtime — Mfg Eng primary (Manager can help)
      case "resolveDowntime":
      case "deleteDowntime":
        return r === "mfgeng" || r === "manager";

      // Tech step sign-off (assembly / build / test steps)
      case "signTechStep":
        return r === "tech" || r === "mfgeng" || r === "supervisor" || r === "manager";

      // QA step sign-off only
      case "signQaStep":
        return r === "qa" || r === "mfgeng" || r === "supervisor" || r === "manager";

      // Check in to a work order traveler
      case "checkIn":
        return r === "tech" || r === "qa" || r === "mfgeng" || r === "supervisor" || r === "manager";

      // Edit work instruction library / steps
      case "editWorkInstructions":
        return r === "mfgeng" || r === "manager";

      // Assign tech / QA on a work order
      case "assignWork":
        return r === "supervisor" || r === "manager";

      // Task orders (not BOM-bound)
      case "createTaskOrder":
        return r === "supervisor" || r === "manager";

      // Full work order create (from planning / capacity)
      case "createWorkOrder":
        return r === "manager";

      // Charge code + WI type tagging on a job
      case "setChargeCode":
      case "setWiType":
        return r === "manager" || r === "mfgeng";

      // See every open job vs assigned-only
      case "viewAllWorkOrders":
        return r === "mfgeng" || r === "supervisor" || r === "manager";

      case "viewAssignedOnly":
        return r === "tech" || r === "qa";

      // Settings / employees / work centers
      case "manageEmployees":
      case "manageWorkCenters":
      case "manageSettings":
        return false; // admin only

      default:
        return false;
    }
  }

  function isAssignedToMe(wo, s) {
    s = s || session();
    if (!s || !wo) return false;
    var pid = String(s.personId || s.userId || "");
    var name = String(s.name || "").toLowerCase();
    if (pid && (String(wo.assignedTechId) === pid || String(wo.assignedQaId) === pid)) return true;
    if (
      name &&
      ((wo.assignedTechName || "").toLowerCase() === name ||
        (wo.assignedQaName || "").toLowerCase() === name)
    )
      return true;
    return false;
  }

  /** Filter work orders list for current role */
  function filterWorkOrders(list, s) {
    s = s || session();
    if (!s) return list || [];
    if (can("viewAllWorkOrders", s)) return list || [];
    return (list || []).filter(function (wo) {
      return isAssignedToMe(wo, s);
    });
  }

  function optionsHtml(selected) {
    var sel = normRole(selected);
    return ORDER.map(function (r) {
      return (
        '<option value="' +
        r +
        '"' +
        (r === sel ? " selected" : "") +
        ">" +
        LABELS[r] +
        "</option>"
      );
    }).join("");
  }

  function denyToast(msg) {
    if (typeof toast === "function") toast(msg || "Not allowed for your role");
    else alert(msg || "Not allowed for your role");
    return false;
  }

  root.SuiteRoles = {
    LABELS: LABELS,
    ORDER: ORDER,
    norm: normRole,
    label: label,
    session: session,
    roleOf: roleOf,
    can: can,
    isAssignedToMe: isAssignedToMe,
    filterWorkOrders: filterWorkOrders,
    optionsHtml: optionsHtml,
    deny: denyToast
  };
})(typeof window !== "undefined" ? window : globalThis);
