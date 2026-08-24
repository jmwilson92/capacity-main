/* Settings page logic - keep outside Settings.html to avoid script-in-HTML parse issues */
(function () {
  var STORAGE_KEY = "capacity-tracker.v1";
  var COLORS = ["#1f6f6a", "#1d4e89", "#8a3b12", "#6b4c9a", "#3d5a40", "#9a3412", "#0f4c5c", "#7a2f4b"];
  var ROLE_ORDER = ["tech", "qa", "mfgeng", "supervisor", "manager", "admin"];
  var ROLE_LABELS = {
    tech: "Floor Tech",
    qa: "QA",
    mfgeng: "Mfg Eng",
    supervisor: "Supervisor",
    manager: "Manager",
    admin: "Admin"
  };

  function esc(s) {
    var t = String(s == null ? "" : s);
    var out = "";
    for (var i = 0; i < t.length; i++) {
      var c = t.charAt(i);
      if (c === "&") out += "&" + "amp;";
      else if (c === "<") out += "&" + "lt;";
      else if (c === ">") out += "&" + "gt;";
      else if (c === '"') out += "&" + "quot;";
      else if (c === "'") out += "&" + "#39;";
      else out += c;
    }
    return out;
  }

  function uid(p) {
    return p + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function toast(m) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = m;
    var host = document.getElementById("toasts");
    if (host) host.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2800);
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    data.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function normRole(r) {
    var s = String(r || "tech").toLowerCase().replace(/\s+/g, "");
    if (s === "floortech" || s === "technician") return "tech";
    if (s === "quality" || s === "inspector") return "qa";
    if (s === "mfg" || s === "mfgengineer" || s === "engineer" || s === "me") return "mfgeng";
    if (s === "super" || s === "lead") return "supervisor";
    if (s === "mgr") return "manager";
    if (ROLE_LABELS[s]) return s;
    return "tech";
  }

  function roleLabel(r) {
    if (window.SuiteRoles && SuiteRoles.label) return SuiteRoles.label(r);
    return ROLE_LABELS[normRole(r)] || r || "Floor Tech";
  }

  function roleOpts(sel) {
    if (window.SuiteRoles && SuiteRoles.optionsHtml) return SuiteRoles.optionsHtml(sel);
    var cur = normRole(sel);
    return ROLE_ORDER.map(function (r) {
      return (
        "<option value=\"" +
        r +
        "\"" +
        (r === cur ? " selected" : "") +
        ">" +
        ROLE_LABELS[r] +
        "</option>"
      );
    }).join("");
  }

  function paintNav() {
    try {
      var tabs = document.getElementById("tabs");
      if (tabs) {
        if (window.SuiteNav && SuiteNav.html) {
          tabs.innerHTML = SuiteNav.html("Settings");
        } else {
          tabs.innerHTML =
            '<a class="tab" href="CapacityTracker.html#dashboard">Work Centers</a>' +
            '<a class="tab" href="CapacityTracker.html#planning">Planning</a>' +
            '<a class="tab" href="WorkOrders.html">Work Orders</a>' +
            '<a class="tab" href="WipBoard.html">WIP Board</a>' +
            '<a class="tab" href="WorkInstructions.html">Work Instructions</a>' +
            '<a class="tab" href="Analytics.html">Analytics</a>' +
            '<a class="tab is-on" href="Settings.html">Settings</a>';
        }
      }
      if (window.SuiteNav && SuiteNav.paintAuth) SuiteNav.paintAuth();
    } catch (e) {}
  }

  function showError(msg) {
    var main = document.getElementById("main");
    if (main) main.innerHTML = '<div class="err">Settings error: ' + esc(msg) + "</div>";
  }

  function render() {
    try {
      paintNav();
      var d = load();
      var centers = d.workCenters || [];
      var people = (d.people || []).slice().sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
      var html = "";

      html += '<div class="card help"><b>Roles</b><br>';
      html += "Floor Tech - only assigned jobs; tech step sign-off; downtime create; analytics view.<br>";
      html += "QA - only assigned jobs; QA step sign-off; downtime create; analytics view.<br>";
      html += "Mfg Eng - edit work instructions; resolve downtime; set WI type.<br>";
      html += "Supervisor - assign work; create task orders; analytics.<br>";
      html += "Manager - create work orders; charge codes; assign; downtime view.<br>";
      html += "Admin - everything.</div>";

      html += '<div class="page-head"><div><h2>Work centers</h2>';
      html += '<p class="lede">Ordering, Kitting, QA, production cells.</p></div>';
      html += '<button type="button" class="btn primary" data-action="new-wc">New work center</button></div>';

      if (!centers.length) {
        html += '<div class="card"><p class="help" style="margin:0">No work centers yet. Click New work center.</p></div>';
      } else {
        centers.forEach(function (c) {
          html +=
            '<div class="wc-row"><div><span class="dot" style="background:' +
            esc(c.color || "#1f6f6a") +
            '"></span><b>' +
            esc(c.name) +
            "</b>";
          if (c.kind) html += ' <span class="pill">' + esc(c.kind) + "</span>";
          html +=
            '</div><div><button type="button" class="btn small" data-action="edit-wc" data-id="' +
            esc(c.id) +
            '">Edit</button> ';
          html +=
            '<button type="button" class="btn small danger" data-action="del-wc" data-id="' +
            esc(c.id) +
            '">Delete</button></div></div>';
        });
      }

      html += '<div class="page-head" style="margin-top:1.75rem"><div><h2>Employees and roles</h2>';
      html +=
        '<p class="lede">Assign Floor Tech, QA, Mfg Eng, Supervisor, Manager, or Admin. PIN default 1111.</p></div>';
      html += '<button type="button" class="btn primary" data-action="new-emp">Add employee</button></div>';

      if (!people.length) {
        html +=
          '<div class="card"><p class="help" style="margin:0">No people yet. Add employees here or in Capacity Tracker roster.</p></div>';
      } else {
        people.forEach(function (p) {
          html +=
            '<div class="emp-row"><div><b>' +
            esc(p.name) +
            '</b> <span class="pill">' +
            esc(roleLabel(p.role)) +
            "</span>";
          if (p.workCenterId) {
            var wc = centers.find(function (c) {
              return String(c.id) === String(p.workCenterId);
            });
            html += ' <span class="help">' + esc(wc ? wc.name : "") + "</span>";
          }
          html += '</div><div style="display:flex;gap:.35rem;flex-wrap:wrap;align-items:center">';
          html +=
            '<select class="field" style="width:auto;min-width:9rem" data-role-id="' +
            esc(p.id) +
            '">' +
            roleOpts(p.role || "tech") +
            "</select>";
          html +=
            '<button type="button" class="btn small" data-action="reset-pin" data-id="' +
            esc(p.id) +
            '">Reset PIN 1111</button>';
          html +=
            '<button type="button" class="btn small danger" data-action="del-emp" data-id="' +
            esc(p.id) +
            '">Remove</button></div></div>';
        });
      }

      html += '<h2 style="margin-top:1.75rem">More</h2><div class="grid" style="margin-top:.75rem">';
      html +=
        '<a class="card" href="CapacityTracker.html#people"><h3 style="margin:0 0 .35rem">Full roster</h3>';
      html += '<p class="help" style="margin:0">Hours, PTO, center assign in Capacity Tracker.</p></a>';
      html +=
        '<a class="card" href="SkillsMatrix.html"><h3 style="margin:0 0 .35rem">Skills matrix</h3>';
      html += '<p class="help" style="margin:0">Training levels.</p></a>';
      html +=
        '<a class="card" href="CapacityTracker.html#settings"><h3 style="margin:0 0 .35rem">Capacity settings</h3>';
      html += '<p class="help" style="margin:0">Planning horizon, storage.</p></a></div>';

      document.getElementById("main").innerHTML = html;
    } catch (err) {
      showError(err && err.message ? err.message : String(err));
    }
  }

  function openWc(id) {
    var d = load();
    var centers = d.workCenters || [];
    var existing = id
      ? centers.find(function (c) {
          return String(c.id) === String(id);
        })
      : null;
    var c = existing || {
      name: "",
      notes: "",
      color: COLORS[centers.length % COLORS.length],
      kind: ""
    };
    var dlg = document.getElementById("modal");
    var taClose = "</" + "textarea>";
    dlg.innerHTML =
      '<form class="modal-card" data-form="wc" data-id="' +
      esc(existing ? existing.id : "") +
      '"><h3 style="margin:0">' +
      (existing ? "Edit" : "New") +
      ' work center</h3><div class="form-grid">' +
      '<label class="span-2">Name<input class="field" name="name" required value="' +
      esc(c.name) +
      '"></label>' +
      '<label>Kind<select class="field" name="kind">' +
      '<option value="">General</option>' +
      '<option value="ordering"' +
      (c.kind === "ordering" ? " selected" : "") +
      ">Ordering</option>' +
      '<option value="kitting"' +
      (c.kind === "kitting" ? " selected" : "") +
      ">Kitting</option>' +
      '<option value="qa"' +
      (c.kind === "qa" ? " selected" : "") +
      ">QA</option></select></label>' +
      '<label>Color<input class="field" type="color" name="color" value="' +
      esc(c.color || "#1f6f6a") +
      '"></label>' +
      '<label class="span-2">Notes<textarea class="field" name="notes" rows="2">' +
      esc(c.notes || "") +
      taClose +
      "</label></div>" +
      '<div style="display:flex;justify-content:space-between;margin-top:.5rem">' +
      '<button type="button" class="btn" data-action="close">Cancel</button>' +
      '<button type="submit" class="btn primary">Save</button></div></form>';
    if (dlg.showModal) dlg.showModal();
  }

  function openEmp() {
    var d = load();
    var centers = d.workCenters || [];
    var dlg = document.getElementById("modal");
    dlg.innerHTML =
      '<form class="modal-card" data-form="emp"><h3 style="margin:0">Add employee</h3><div class="form-grid">' +
      '<label class="span-2">Name<input class="field" name="name" required></label>' +
      '<label>Role<select class="field" name="role">' +
      roleOpts("tech") +
      "</select></label>" +
      '<label>Work center<select class="field" name="workCenterId"><option value="">Unassigned</option>' +
      centers
        .map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>";
        })
        .join("") +
      "</select></label>" +
      '<label class="span-2">Hours / week<input class="field" name="hoursPerWeek" type="number" value="40" min="0" step="0.5"></label></div>' +
      '<p class="help">PIN starts at 1111. Change it after first Work Orders login.</p>' +
      '<div style="display:flex;justify-content:space-between;margin-top:.5rem">' +
      '<button type="button" class="btn" data-action="close">Cancel</button>' +
      '<button type="submit" class="btn primary">Save</button></div></form>';
    if (dlg.showModal) dlg.showModal();
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-action]");
    if (!b) return;
    var a = b.getAttribute("data-action");
    if (a === "new-wc") openWc("");
    if (a === "edit-wc") openWc(b.getAttribute("data-id"));
    if (a === "new-emp") openEmp();
    if (a === "close") {
      var m = document.getElementById("modal");
      if (m && m.close) m.close();
    }
    if (a === "del-wc") {
      if (!confirm("Delete this work center?")) return;
      var id = b.getAttribute("data-id");
      var d = load();
      d.workCenters = (d.workCenters || []).filter(function (c) {
        return String(c.id) !== String(id);
      });
      (d.people || []).forEach(function (p) {
        if (String(p.workCenterId) === String(id)) p.workCenterId = "";
      });
      (d.workOrders || []).forEach(function (o) {
        if (String(o.workCenterId) === String(id)) o.workCenterId = "";
      });
      save(d);
      toast("Deleted");
      render();
    }
    if (a === "del-emp") {
      if (!confirm("Remove employee?")) return;
      var id2 = b.getAttribute("data-id");
      var d2 = load();
      d2.people = (d2.people || []).filter(function (p) {
        return String(p.id) !== String(id2);
      });
      save(d2);
      toast("Removed");
      render();
    }
    if (a === "reset-pin") {
      var id3 = b.getAttribute("data-id");
      var d3 = load();
      var p = (d3.people || []).find(function (x) {
        return String(x.id) === String(id3);
      });
      if (!p) return;
      p.pin = "1111";
      p.mustChangePin = true;
      save(d3);
      toast((p.name || "Employee") + " PIN reset to 1111");
    }
  });

  document.addEventListener("change", function (e) {
    var sel = e.target.closest("[data-role-id]");
    if (!sel) return;
    var id = sel.getAttribute("data-role-id");
    var d = load();
    var p = (d.people || []).find(function (x) {
      return String(x.id) === String(id);
    });
    if (!p) return;
    p.role =
      window.SuiteRoles && SuiteRoles.norm ? SuiteRoles.norm(sel.value) : normRole(sel.value);
    save(d);
    toast((p.name || "") + " -> " + roleLabel(p.role));
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    var fd = new FormData(form);
    var d = load();
    if (form.getAttribute("data-form") === "wc") {
      if (!d.workCenters) d.workCenters = [];
      var id = form.getAttribute("data-id") || "";
      var rec = {
        id: id || uid("wc"),
        name: String(fd.get("name") || "").trim() || "Untitled",
        kind: String(fd.get("kind") || ""),
        color: String(fd.get("color") || "#1f6f6a"),
        notes: String(fd.get("notes") || "")
      };
      var idx = d.workCenters.findIndex(function (c) {
        return String(c.id) === String(rec.id);
      });
      if (idx >= 0) d.workCenters[idx] = Object.assign({}, d.workCenters[idx], rec);
      else d.workCenters.push(rec);
      save(d);
      var modal = document.getElementById("modal");
      if (modal && modal.close) modal.close();
      toast("Work center saved");
      render();
    }
    if (form.getAttribute("data-form") === "emp") {
      if (!d.people) d.people = [];
      var role =
        window.SuiteRoles && SuiteRoles.norm
          ? SuiteRoles.norm(fd.get("role"))
          : normRole(fd.get("role"));
      d.people.push({
        id: uid("p"),
        name: String(fd.get("name") || "").trim() || "Unnamed",
        role: role,
        workCenterId: String(fd.get("workCenterId") || ""),
        hoursPerWeek: Number(fd.get("hoursPerWeek")) || 40,
        workDays: 5,
        efficiency: 100,
        pin: "1111",
        mustChangePin: true,
        notes: ""
      });
      save(d);
      var modal2 = document.getElementById("modal");
      if (modal2 && modal2.close) modal2.close();
      toast("Employee added - PIN 1111");
      render();
    }
  });

  try {
    render();
  } catch (bootErr) {
    showError(bootErr && bootErr.message ? bootErr.message : String(bootErr));
  }
})();
