/* Report downtime from a work order - writes capacity-tracker.v1.downtime */
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
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      if (ch === "&") return "\x26amp;";
      if (ch === "<") return "\x26lt;";
      if (ch === ">") return "\x26gt;";
      if (ch === '"') return "\x26quot;";
      return "\x26#39;";
    });
  }

  function uid(p) {
    return p + "_" + Math.random().toString(36).slice(2, 9);
  }

  function pad2(n) {
    var s = String(n);
    return s.length < 2 ? "0" + s : s;
  }

  function nowParts() {
    var d = new Date();
    return {
      date: d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()),
      time: pad2(d.getHours()) + ":" + pad2(d.getMinutes())
    };
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

  function open(wo, session, onSaved) {
    if (!wo) return;
    var dlg = document.getElementById("modal");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "modal";
      document.body.appendChild(dlg);
    }

    var reasonOpts = "";
    for (var i = 0; i < REASONS.length; i++) {
      reasonOpts +=
        '<option value="' +
        REASONS[i].id +
        '">' +
        esc(REASONS[i].label) +
        "</option>";
    }

    dlg.innerHTML =
      '<form class="modal-card" data-form="report-downtime">' +
      "<h3 style=\"margin:0\">Report downtime</h3>" +
      '<p style="color:#5c564c;font-size:.88rem;margin:.35rem 0 .75rem"><b>' +
      esc(wo.number || "") +
      "</b>" +
      (wo.title ? " · " + esc(wo.title) : "") +
      "</p>" +
      "<label>Reason" +
      '<select class="field" name="reason" required>' +
      reasonOpts +
      "</select></label>" +
      '<label style="margin-top:.65rem">Notes' +
      '<textarea class="field" name="notes" rows="3" placeholder="What is blocked / what is needed"></textarea></label>' +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem">' +
      '<button type="button" class="btn" data-dt-close>Cancel</button>' +
      '<button type="submit" class="btn primary">Submit issue</button>' +
      "</div></form>";

    if (dlg.showModal) dlg.showModal();
    else dlg.setAttribute("open", "");

    function close() {
      if (dlg.close) dlg.close();
      else dlg.removeAttribute("open");
    }

    var closeBtn = dlg.querySelector("[data-dt-close]");
    if (closeBtn) closeBtn.onclick = close;

    var form = dlg.querySelector("[data-form=report-downtime]");
    if (form) {
      form.onsubmit = function (e) {
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
  }

  root.DowntimeReport = { open: open, writeEntry: writeEntry, REASONS: REASONS };
})(typeof window !== "undefined" ? window : globalThis);
