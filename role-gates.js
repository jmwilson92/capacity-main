/**
 * Runtime role gates for Work Orders / Downtime / Work Instructions.
 * Depends on roles.js (SuiteRoles).
 */
(function (root) {
  function roles() {
    return root.SuiteRoles || null;
  }

  function sessionFromStorage() {
    try {
      return JSON.parse(sessionStorage.getItem("capacity-tracker.session") || "null");
    } catch (e) {
      return null;
    }
  }

  function personRole(u) {
    var R = roles();
    if (!R || !u) return "tech";
    return R.norm(u.role || "tech");
  }

  function canAs(action, personOrSession) {
    var R = roles();
    if (!R) return true;
    var s = personOrSession || sessionFromStorage();
    if (!s) return false;
    // Normalize shape for can()
    var shape = {
      personId: s.personId || s.userId || s.id,
      userId: s.userId || s.personId || s.id,
      name: s.name,
      role: s.role
    };
    return R.can(action, shape);
  }

  function deny(msg) {
    var R = roles();
    if (R && R.deny) return R.deny(msg);
    alert(msg || "Not allowed for your role");
    return false;
  }

  /** Filter a WO list for the signed-in role */
  function filterList(list, session) {
    var R = roles();
    if (!R) return list || [];
    return R.filterWorkOrders(list || [], session || sessionFromStorage());
  }

  /** After PIN identifies a person, check they may sign this purpose */
  function maySign(purpose, stepType, signer) {
    var R = roles();
    if (!R) return true;
    var shape = { role: personRole(signer), name: signer && signer.name, personId: signer && signer.id };
    if (purpose === "tech-done") return R.can("signTechStep", shape);
    if (purpose === "qa-done") return R.can("signQaStep", shape);
    if (purpose === "prod-step") {
      if (String(stepType || "") === "qa") return R.can("signQaStep", shape);
      return R.can("signTechStep", shape);
    }
    return true;
  }

  function maySetChargeOrWi(session) {
    return canAs("setChargeCode", session) || canAs("setWiType", session);
  }

  function mayCheckIn(session) {
    return canAs("checkIn", session);
  }

  function mayEditWi(session) {
    return canAs("editWorkInstructions", session);
  }

  function mayResolveDowntime(session) {
    return canAs("resolveDowntime", session);
  }

  function mayCreateDowntime(session) {
    return canAs("createDowntime", session);
  }

  function isAssignedOnly(session) {
    return canAs("viewAssignedOnly", session);
  }

  root.RoleGates = {
    canAs: canAs,
    deny: deny,
    filterList: filterList,
    maySign: maySign,
    maySetChargeOrWi: maySetChargeOrWi,
    mayCheckIn: mayCheckIn,
    mayEditWi: mayEditWi,
    mayResolveDowntime: mayResolveDowntime,
    mayCreateDowntime: mayCreateDowntime,
    isAssignedOnly: isAssignedOnly,
    session: sessionFromStorage
  };
})(typeof window !== "undefined" ? window : globalThis);
