/* Report downtime from a work order — writes capacity-tracker.v1.downtime */
(function (root) {
  var STORAGE_KEY = "capacity-tracker.v1";
  var REASONS = [
    { id: "material", label: "Waiting on material" },
    { id: "tooling", label: "Tooling / setup" },
    { id: "machine", label: "Machine issue" },
    { id: "engineering", label: "Engineering question" },
    { id: "quality", label: "Quality hold" },
    { id: "personnel", label: "Missing personnel" },
    { id: "instruction", label: "Work instruction unclear" },
    { id: "other", label: "Other" }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """);
  }

  function uid(p) {
    return p + "_" + Math.random().toString(36).slice(2, 9);
  }

  function nowParts() {
    var d = new Date();
    var date =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    var time =
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0");
    return { date: date, time: time };
  }

  function writeEntry(entry) {
    var base = {};
    try {
      base = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      base = {};
    }
    if (!Array.isArray(base.downtime)) base.downtime = [];
    base.downtime.unshift(entry);
    base.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    return entry;
  }

  /**
   * Open a modal to log downtime for a work order.
   * @param {object} wo - work order
   * @param {object} session - { personId, name }
   * @param {function} [onSaved] - callback after save
   */
  function open(wo, session, onSaved) {
    if (!wo) return;
    var dlg = document.getElementById("modal");
    var host = dlg;
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "dt-modal";
      document.body.appendChild(dlg);
      host = dlg;
    }
    var reasonOpts = REASONS.map(function (r) {
      return '<option value="' + r.id + '">' + esc(r.label) + "</option>";
    }).join("");

    host.innerHTML =
      '<form class="modal-card" data-form="report-downtime" style="background:#fffcf6;border:1px solid #d4cbb8;border-radius:14px;padding:1.15rem;width:min(440px,94vw);box-shadow:0 12px 28px rgba(0,0,0,.15)">' +
      "<h3 style=\"margin:0\">Report downtime</h3>" +
      '<p style="color:#5c564c;font-size:.88rem;margin:.35rem 0 .75rem"><b>' +
      esc(wo.number || "") +
      "</b>" +
      (wo.title ? " · " + esc(wo.title) : "") +
      "</p>" +
      '<label style="display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;font-weight:650;color:#5c564c">Reason' +
      '<select class="field" name="reason" required style="border:1px solid #d4cbb8;border-radius:10px;padding:.4rem .65rem;font:inherit">' +
      reasonOpts +
      "</select></label>" +
      '<label style="display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;font-weight:650;color:#5c564c;margin-top:.65rem">Notes' +
      '<textarea class="field" name="notes" rows="3" placeholder="What is blocked / what is needed" style="border:1px solid #d4cbb8;border-radius:10px;padding:.4rem .65rem;font:inherit"></textarea></label>' +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem">' +
      '<button type="button" class="btn" data-dt-close style="border:1px solid #d4cbb8;background:#fffcf6;border-radius:10px;padding:.4rem .7rem;cursor:pointer;font:inherit">Cancel</button>' +
      '<button type="submit" class="btn primary" style="background:#0e3d3a;color:#f6f1e7;border:1px solid #0e3d3a;border-radius:10px;padding:.4rem .7rem;cursor:pointer;font:inherit">Submit issue</button>' +
      "</div></form>";

    if (host.showModal) host.showModal();
    else host.setAttribute("open", "");

    function close() {
      if (host.close) host.close();
      else host.removeAttribute("open");
    }

    host.querySelector("[data-dt-close]").onclick = function () {
      close();
    };

    host.querySelector("[data-form=report-downtime]").onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var np = nowParts();
      var entry = {
        id: uid("dt"),
        workOrderId: String(wo.id),
        workOrderNumber: wo.number || "",
        workOrderTitle: wo.title || "",
        workCenterId: wo.workCenterId || "",
        chargeCode: wo.chargeCode || "",
        personId: (session && (session.personId || session.userId)) || "",
        personName: (session && session.name) || "",
        reason: String(fd.get("reason") || "other"),
        notes: String(fd.get("notes") || "").trim(),
        startDate: np.date,
        startTime: np.time,
        endDate: "",
        endTime: "",
        minutes: 0,
        status: "open",
        createdAt: Date.now(),
        source: "work-order"
      };
      writeEntry(entry);
      close();
      if (typeof onSaved === "function") onSaved(entry);
    };
  }

  root.DowntimeReport = { open: open, writeEntry: writeEntry, REASONS: REASONS };
})(typeof window !== "undefined" ? window : globalThis);
