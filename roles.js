/**
 * Shop-floor roles and permissions.
 * Session: capacity-tracker.session { personId, name, role }
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

  /** Permission checks */
  function can(action, s) {
    var r = roleOf(s);
    if (r === "admin") return true;

    switch (action) {
      case "viewAnalytics":
      case "viewWip":
      case "viewCapacity":
        return true;

      case "createDowntime":
        return true; // all shop roles

      case "resolveDowntime":
      case "deleteDowntime":
        return r === "mfgeng" || r === "manager" || r === "supervisor";

      case "signTechStep":
        return r === "tech" || r === "mfgeng" || r === "supervisor" || r === "manager";

      case "signQaStep":
        return r === "qa" || r === "mfgeng" || r === "supervisor" || r === "manager";

      case "checkIn":
        return r === "tech" || r === "qa" || r === "mfgeng" || r === "supervisor" || r === "manager";

      case "editWorkInstructions":
        return r === "mfgeng" || r === "manager";

      case "assignWork":
        return r === "supervisor" || r === "manager";

      case "createTaskOrder":
        return r === "supervisor" || r === "manager";

      case "createWorkOrder":
        return r === "manager";

      case "setChargeCode":
      case "setWiType":
        return r === "manager" || r === "mfgeng";

      case "viewAllWorkOrders":
        return r === "mfgeng" || r === "supervisor" || r === "manager";

      case "viewAssignedOnly":
        return r === "tech" || r === "qa";

      case "manageEmployees":
      case "manageWorkCenters":
      case "manageSettings":
        return false; // admin only (handled above)

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
    if (name && ((wo.assignedTechName || "").toLowerCase() === name || (wo.assignedQaName || "").toLowerCase() === name))
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
    else if (window.SuiteNav) {
      /* optional */
    }
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
