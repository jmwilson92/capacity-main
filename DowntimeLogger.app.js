/* Downtime Logger app */
(function () {
  var STORAGE_KEY = "capacity-tracker.v1";
  var REASONS = {
    material: "Waiting on material",
    tooling: "Tooling / setup",
    machine: "Machine issue",
    engineering: "Engineering question",
    quality: "Quality hold",
    personnel: "Missing personnel",
    instruction: "Work instruction unclear",
    other: "Other"
  };

  var state = {
    workCenters: [],
    people: [],
    workOrders: [],
    downtime: [],
    filterOpenOnly: true,
    filterCenter: ""
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      if (ch === "&") return "\x26amp;";
      if (ch === "<") return "\x26lt;";
      if (ch === ">") return "\x26gt;";
      if (ch === '"') return "\x26quot;";
      return "\x26#39;";
    });
  }

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.workCenters = p.workCenters || [];
      state.people = p.people || [];
      state.workOrders = p.workOrders || [];
      state.downtime = Array.isArray(p.downtime) ? p.downtime : [];
    } catch (e) {
      state.downtime = [];
    }
  }

  function save() {
    var base = {};
    try {
      base = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      base = {};
    }
    base.downtime = state.downtime;
    base.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
  }

  function toast(m) {
    var host = document.querySelector(".toasts");
    if (!host) {
      host = document.createElement("div");
      host.className = "toasts";
      document.body.appendChild(host);
    }
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = m;
    host.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2800);
  }

  function centerName(id) {
    for (var i = 0; i < state.workCenters.length; i++) {
      if (String(state.workCenters[i].id) === String(id)) return state.workCenters[i].name;
    }
    return "-";
  }

  function personName(id) {
    for (var i = 0; i < state.people.length; i++) {
      if (String(state.people[i].id) === String(id)) return state.people[i].name;
    }
    return "-";
  }

  function reasonLabel(id) {
    return REASONS[id] || id || "-";
  }

  function filtered() {
    var list = state.downtime.slice();
    if (state.filterOpenOnly) {
      list = list.filter(function (d) {
        return d.status === "open";
      });
    }
    if (state.filterCenter) {
      list = list.filter(function (d) {
        return String(d.workCenterId) === String(state.filterCenter);
      });
    }
    return list;
  }

  function pad2(n) {
    var s = String(n);
    return s.length < 2 ? "0" + s : s;
  }

  function closeLog(id) {
    for (var i = 0; i < state.downtime.length; i++) {
      if (state.downtime[i].id === id) {
        state.downtime[i].status = "closed";
        var now = new Date();
        state.downtime[i].endDate =
          now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
        state.downtime[i].endTime = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
        break;
      }
    }
    save();
    toast("Closed");
    render();
  }

  function removeLog(id) {
    if (!confirm("Delete this downtime entry?")) return;
    state.downtime = state.downtime.filter(function (d) {
      return d.id !== id;
    });
    save();
    toast("Deleted");
    render();
  }

  function navHtml() {
    return (
      '<nav class="tabs">' +
      '<a class="tab" href="CapacityTracker.html#dashboard">Work Centers</a>' +
      '<a class="tab" href="CapacityTracker.html#planning">Planning</a>' +
      '<a class="tab" href="WorkOrders.html">Work Orders</a>' +
      '<a class="tab" href="WipBoard.html">WIP Board</a>' +
      '<a class="tab" href="WorkInstructions.html">Work Instructions</a>' +
      '<a class="tab is-on" href="DowntimeLogger.html">Downtime</a>' +
      '<a class="tab" href="Analytics.html">Analytics</a>' +
      '<a class="tab" href="Settings.html">Settings</a>' +
      "</nav>"
    );
  }

  function rowHtml(d) {
    var html =
      "<tr>" +
      "<td>" +
      esc(d.startDate || "") +
      " " +
      esc(d.startTime || "") +
      "</td>" +
      "<td><b>" +
      esc(d.workOrderNumber || "-") +
      "</b>";
    if (d.workOrderTitle) {
      html +=
        '<div style="font-size:.8rem;color:var(--ink-soft)">' +
        esc(d.workOrderTitle) +
        "</div>";
    }
    html +=
      "</td>" +
      "<td>" +
      esc(centerName(d.workCenterId)) +
      "</td>" +
      "<td>" +
      esc(reasonLabel(d.reason)) +
      "</td>" +
      "<td>" +
      esc(d.personName || personName(d.personId)) +
      "</td>" +
      '<td><span class="pill ' +
      (d.status === "open" ? "open" : "closed") +
      '">' +
      esc(d.status || "open") +
      "</span></td>" +
      "<td>" +
      (d.notes ? esc(d.notes) : "-") +
      "</td>" +
      '<td style="white-space:nowrap">';
    if (d.status === "open") {
      html +=
        '<button class="btn small primary" data-action="close" data-id="' +
        esc(d.id) +
        '">Close</button> ';
    }
    html +=
      '<button class="btn small danger" data-action="delete" data-id="' +
      esc(d.id) +
      '">x</button></td></tr>';
    return html;
  }

  function render() {
    try {
      var open = 0;
      for (var i = 0; i < state.downtime.length; i++) {
        if (state.downtime[i].status === "open") open++;
      }
      var list = filtered();

      var centerOpts = '<option value="">All centers</option>';
      for (var c = 0; c < state.workCenters.length; c++) {
        var wc = state.workCenters[c];
        var sel = String(state.filterCenter) === String(wc.id) ? " selected" : "";
        centerOpts +=
          '<option value="' + esc(wc.id) + '"' + sel + ">" + esc(wc.name) + "</option>";
      }

      var openJobs = 0;
      for (var j = 0; j < state.workOrders.length; j++) {
        if (state.workOrders[j].status !== "complete") openJobs++;
      }

      var rows = "";
      for (var r = 0; r < list.length; r++) rows += rowHtml(list[r]);

      var tableBlock = list.length
        ? '<div style="overflow-x:auto"><table><thead><tr><th>When</th><th>Job</th><th>Center</th><th>Reason</th><th>By</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>' +
          rows +
          "</tbody></table></div>"
        : '<div class="empty">No downtime events yet.<br><br>On Work Orders, press Downtime on a job to report one.</div>';

      var html =
        '<div class="top"><div class="top-row"><div class="brand"><div class="mark">DT</div><div><h1>Downtime</h1><p>Issues from the floor</p></div></div></div>' +
        navHtml() +
        "</div>" +
        '<div class="wrap">' +
        "<h2>Downtime overview</h2>" +
        '<p class="lede">Report from Work Orders. This is the board.</p>' +
        '<div class="kpis">' +
        '<div class="kpi' +
        (open ? " over" : "") +
        '"><div class="label">Open</div><div class="value">' +
        open +
        "</div></div>" +
        '<div class="kpi"><div class="label">Total logged</div><div class="value">' +
        state.downtime.length +
        "</div></div>" +
        '<div class="kpi"><div class="label">Work centers</div><div class="value">' +
        state.workCenters.length +
        "</div></div>" +
        '<div class="kpi"><div class="label">Open jobs</div><div class="value">' +
        openJobs +
        "</div></div></div>" +
        '<div class="card">' +
        '<div class="filters">' +
        '<label class="chk"><input type="checkbox" id="fOpen"' +
        (state.filterOpenOnly ? " checked" : "") +
        "> Open only</label>" +
        '<select class="field" id="fCenter">' +
        centerOpts +
        "</select>" +
        '<button class="btn small" type="button" id="btnReload">Reload</button>' +
        "</div>" +
        tableBlock +
        "</div></div>" +
        '<div class="toasts"></div>';

      document.getElementById("app").innerHTML = html;

      var fo = document.getElementById("fOpen");
      if (fo) {
        fo.onchange = function () {
          state.filterOpenOnly = fo.checked;
          render();
        };
      }
      var fc = document.getElementById("fCenter");
      if (fc) {
        fc.onchange = function () {
          state.filterCenter = fc.value;
          render();
        };
      }
      var br = document.getElementById("btnReload");
      if (br) {
        br.onclick = function () {
          load();
          toast("Reloaded");
          render();
        };
      }
    } catch (err) {
      document.getElementById("app").innerHTML =
        '<div class="wrap"><div class="err">Downtime error: ' +
        esc(err && err.message ? err.message : String(err)) +
        "</div></div>";
    }
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-action]");
    if (!b) return;
    var a = b.getAttribute("data-action");
    var id = b.getAttribute("data-id") || "";
    if (a === "close") closeLog(id);
    if (a === "delete") removeLog(id);
  });

  try {
    load();
    render();
  } catch (boot) {
    var app = document.getElementById("app");
    if (app) {
      app.innerHTML =
        '<div class="wrap"><div class="err">Boot failed: ' +
        String(boot && boot.message ? boot.message : boot) +
        "</div></div>";
    }
  }
})();
