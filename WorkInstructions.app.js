/* Work Instructions app - QA is a step type only (no separate QA list) */
(function () {
  var STORAGE_KEY = "capacity-tracker.v1";
  var DEFAULT_CABLE = [
    { id: "labels", name: "Labels", steps: ["Confirm label content from drawing", "Print correct material", "Verify legibility", "Apply at location", "Text matches drawing", "Orientation OK", "Adhered"], media: [] },
    { id: "cut", name: "Cut Wire", steps: ["Verify wire vs BOM", "Measure", "Cut square", "Stage", "Correct wire", "Length OK", "Ends clean"], media: [] },
    { id: "strip", name: "Strip Wire", steps: ["Set strip length per tooling", "Strip no nick", "Inspect", "Length OK", "No nicked strands"], media: [] },
    { id: "crimp_circular", name: "Crimp - Circular / Glenair", doc: "F0026-1043", hasTool: "circular", steps: ["Select tool/positioner", "Set for wire size", "Strip 0.145-0.155 in", "Insert wire", "Full ratchet crimp", "Inspect window", "Correct tooling", "Strands in window", "Gap OK"], media: [] },
    { id: "crimp_molex", name: "Crimp - Molex", doc: "F0026-1044", hasTool: "molex", steps: ["Select crimper", "Strip per ATS", "Wire to stop", "Crimp", "Inspect clamps", "Correct tool", "Clamps good"], media: [] },
    { id: "crimp_rj45", name: "Crimp - RJ45", doc: "F0026-1046", hasTool: "rj45", steps: ["8-wire or 4-wire", "Prep jacket/shield", "Insert per drawing", "Crimp", "Tug test", "Correct tool", "Tug pass"], media: [] },
    { id: "solder", name: "Solder", doc: "F0026-1045", steps: ["Alloy/flux/temp", "Tin if required", "Joint", "Clearance", "Clean", "Damage limits OK", "Wetting good"], media: [] },
    { id: "populate", name: "Populate Connector", needsCrimp: true, steps: ["Verify pinout", "Insertion tool", "Insert to click", "Visual seat", "Correct cavities", "Seated"], media: [] },
    { id: "backshell", name: "Backshell / Jam Nut", steps: ["Hardware per drawing", "Spanner", "Torque", "Witness mark", "Hardware OK", "Torque OK"], media: [] },
    { id: "heatshrink", name: "Heat Shrink", steps: ["Correct tubing", "Position", "Shrink", "Recovered", "No burns"], media: [] },
    { id: "continuity", name: "Continuity / Test", steps: ["Setup", "Continuity", "HiPot if required", "Record", "Pass", "Recorded"], media: [] }
  ];
  var DEFAULT_ASSEMBLY = [
    { id: "asm_prep", name: "Kit / Prep", steps: ["Pull kit vs BOM", "Verify hardware/rev", "Stage tools and compounds", "Kit complete", "Rev matches"], media: [] },
    { id: "asm_assembly", name: "Assembly Operation", steps: ["Drawing sequence", "Install parts", "Check orientation/keying", "Torque if required", "Orientation OK", "Torque OK", "No damage"], media: [] },
    { id: "asm_antiseize", name: "Apply Anti-Seize", steps: ["Identify surfaces per drawing", "Clean surfaces", "Thin even coat", "Avoid excess", "Correct compound", "Coverage OK", "No contamination"], media: [] },
    { id: "asm_loctite", name: "Apply Loctite / Threadlocker", steps: ["Confirm grade per drawing", "Clean threads", "Apply to male threads", "Assemble within open time", "Correct grade", "Applied OK"], media: [] },
    { id: "asm_torque", name: "Torque Fasteners", steps: ["Calibrated tool", "Sequence per drawing", "Torque value", "Witness mark", "Value OK", "Sequence OK"], media: [] },
    { id: "asm_route", name: "Cable Route / Dress", steps: ["Route per drawing", "Clamps/ties", "Bend radius", "No pinch", "Routing OK", "Supports OK"], media: [] },
    { id: "asm_label", name: "Label / Serialize", steps: ["Apply labels", "Serialize if required", "Verify traveler", "Labels OK", "Serial matches"], media: [] },
    { id: "asm_inspect", name: "Final Visual / FOD", steps: ["Visual vs drawing", "FOD check", "Close-outs", "No FOD", "Visual pass"], media: [] }
  ];
  var CIRCULAR_TOOLS = [
    { size: "#23", contact: "809-002/001 22-28 AWG", tool: "AFM8 / M22520/2-01", positioner: "K1461 / 809-005", insert: "809-088" },
    { size: "#16", contact: "809-111/110 16-20 AWG", tool: "AF8 / M22520/1-01", positioner: "TH163 / 809-137", insert: "809-131" },
    { size: "#20HD", contact: "809-205/204 20-24 AWG", tool: "AFM8 / M22520/2-01", positioner: "809-206", insert: "809-203" },
    { size: "#22HD", contact: "850-095-1/094-1", tool: "AFM8", positioner: "809-005 / 859-147", insert: "859-163" }
  ];
  var MOLEX_TOOLS = [
    { crimp: "39000038/39", tool: "638190901/900", extract: "11030044" },
    { crimp: "39000046/47", tool: "638191000", extract: "11030044" },
    { crimp: "561349100", tool: "638116300", extract: "638132700" },
    { crimp: "39000185/86", tool: "638190900", extract: "11030044" },
    { crimp: "5600850101", tool: "638235100", extract: "11030043" },
    { crimp: "5040520098", tool: "638270800", extract: "638132700" }
  ];
  var RJ45_TOOLS = [
    { conn: "8 Wire (110629)", tool: "EZ-RJ PRO-HD", cable: "E6A5826" },
    { conn: "4 Wire (190007)", tool: "PIC 110340", cable: "E10424" }
  ];
  var DEFAULT_ASMS = [
    { id: "asm_core5", name: "CORE 5 Cable Assembly", productCode: "CORE 5", steps: ["Kit vs BOM", "Build per drawing", "Continuity", "Final visual"], media: [] },
    { id: "asm_core4", name: "CORE 4 Assembly", productCode: "CORE 4", steps: ["Review traveler", "Stage BOM", "Assemble", "Test", "Inspect"], media: [] },
    { id: "asm_kraken", name: "Kraken / POD Assembly", productCode: "Kraken POD", steps: ["Config kit", "Structure", "Assembly + compounds", "Route", "Close-out", "Test"], media: [] }
  ];
  var QA_LOOKS = /^(text matches|orientation ok|adhered|correct wire|length ok|ends clean|no nicked|correct tooling|strands in window|gap ok|correct tool|clamps good|tug pass|damage limits|wetting good|correct cavities|seated|hardware ok|torque ok|recovered|no burns|pass$|recorded|kit complete|rev matches|no damage|correct compound|coverage ok|no contamination|correct grade|applied ok|value ok|sequence ok|routing ok|supports ok|labels ok|serial matches|no fod|visual pass|electrical pass|config ok|bom complete|rev ok)/i;

  var state = {
    data: { workOrders: [], assemblies: [], cableOps: [], assemblyOps: [], workCenters: [], people: [] },
    view: "library",
    libraryTab: "cable",
    selectedOp: null,
    selectedAsm: null,
    editTarget: null
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
  function stepText(s) {
    return typeof s === "string" ? s : (s && s.text) || "";
  }
  function stepMedia(s) {
    return s && typeof s === "object" && Array.isArray(s.media) ? s.media : [];
  }
  function normalizeSteps(steps, legacyQa) {
    var out = (steps || []).map(function (s) {
      if (typeof s === "string") {
        var isQa = QA_LOOKS.test(String(s).trim());
        return { text: s, media: [], stepType: isQa ? "qa" : "assembly", projectedHours: 0, workCenterId: "" };
      }
      var st = String(s.stepType || s.type || "assembly");
      if (["assembly", "qa", "test"].indexOf(st) < 0) st = "assembly";
      return {
        text: String(s.text || ""),
        media: Array.isArray(s.media) ? s.media : [],
        stepType: st,
        projectedHours: Math.max(0, Number(s.projectedHours) || 0),
        workCenterId: s.workCenterId ? String(s.workCenterId) : ""
      };
    });
    if (legacyQa && legacyQa.length) {
      var existing = out.map(function (x) {
        return String(x.text || "")
          .toLowerCase()
          .trim();
      });
      legacyQa.forEach(function (q) {
        var t = typeof q === "string" ? q : (q && q.text) || "";
        t = String(t).trim();
        if (!t) return;
        if (existing.indexOf(t.toLowerCase()) >= 0) return;
        out.push({ text: t, media: [], stepType: "qa", projectedHours: 0, workCenterId: "" });
      });
    }
    return out;
  }
  function centerName(id) {
    var c = (state.data.workCenters || []).find(function (x) {
      return String(x.id) === String(id);
    });
    return c ? c.name : "";
  }
  function stepTypeLabel(st) {
    return st === "qa" ? "QA" : st === "test" ? "Test" : "Assembly";
  }
  function asmProjectedHours(asm) {
    return normalizeSteps(asm && asm.steps).reduce(function (sum, s) {
      return sum + (Number(s.projectedHours) || 0);
    }, 0);
  }
  function uid(p) {
    return p + "_" + Math.random().toString(36).slice(2, 9);
  }
  function toast(m) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = m;
    (document.querySelector(".toasts") || document.body).appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2800);
  }
  function countQa(steps) {
    return normalizeSteps(steps).filter(function (s) {
      return s.stepType === "qa";
    }).length;
  }

  function ensureOps(list, defaults) {
    if (!list || !list.length)
      return JSON.parse(JSON.stringify(defaults)).map(function (o) {
        o.steps = normalizeSteps(o.steps, o.qa);
        delete o.qa;
        o.media = o.media || [];
        return o;
      });
    return list.map(function (o) {
      var d =
        defaults.find(function (x) {
          return x.id === o.id;
        }) || {};
      var steps = o.steps && o.steps.length ? o.steps : d.steps || [];
      var legacyQa = o.qa && o.qa.length ? o.qa : d.qa || [];
      var merged = Object.assign({}, d, o, {
        steps: normalizeSteps(steps, legacyQa),
        media: Array.isArray(o.media) ? o.media : d.media || []
      });
      delete merged.qa;
      return merged;
    });
  }

  function normalizeDefaultAsms() {
    return JSON.parse(JSON.stringify(DEFAULT_ASMS)).map(function (a) {
      a.steps = normalizeSteps(a.steps, a.qa);
      delete a.qa;
      a.media = a.media || [];
      return a;
    });
  }

  function load() {
    try {
      var p = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.data.workOrders = p.workOrders || [];
      state.data.people = p.people || [];
      state.data.workCenters = p.workCenters || [];
      state.data.assemblies =
        p.assemblies && p.assemblies.length
          ? p.assemblies.map(function (a) {
              var row = Object.assign({}, a, {
                media: Array.isArray(a.media) ? a.media : [],
                steps: normalizeSteps(a.steps || [], a.qa)
              });
              delete row.qa;
              return row;
            })
          : normalizeDefaultAsms();
      state.data.cableOps = ensureOps(p.cableOps, DEFAULT_CABLE);
      state.data.assemblyOps = ensureOps(p.assemblyOps, DEFAULT_ASSEMBLY);
    } catch (e) {
      state.data.assemblies = normalizeDefaultAsms();
      state.data.cableOps = ensureOps(null, DEFAULT_CABLE);
      state.data.assemblyOps = ensureOps(null, DEFAULT_ASSEMBLY);
    }
  }

  function save() {
    var b = {};
    try {
      b = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {}
    b.assemblies = (state.data.assemblies || []).map(function (a) {
      var x = Object.assign({}, a);
      delete x.qa;
      x.steps = normalizeSteps(x.steps);
      return x;
    });
    b.cableOps = (state.data.cableOps || []).map(function (o) {
      var x = Object.assign({}, o);
      delete x.qa;
      x.steps = normalizeSteps(x.steps);
      return x;
    });
    b.assemblyOps = (state.data.assemblyOps || []).map(function (o) {
      var x = Object.assign({}, o);
      delete x.qa;
      x.steps = normalizeSteps(x.steps);
      return x;
    });
    b.workOrders = state.data.workOrders;
    b.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  }

  function ops() {
    return state.libraryTab === "assembly" ? state.data.assemblyOps : state.data.cableOps;
  }
  function opById(id) {
    return state.data.cableOps.concat(state.data.assemblyOps).find(function (o) {
      return o.id === id;
    });
  }
  function asmById(id) {
    return (state.data.assemblies || []).find(function (a) {
      return String(a.id) === String(id);
    });
  }
  function linked(kind, asmId) {
    return (state.data.workOrders || []).filter(function (wo) {
      if (wo.status === "complete") return false;
      if (kind === "cable") return wo.instructionKind === "cable";
      if (kind === "assembly") return wo.instructionKind === "assembly";
      if (kind === "product") return wo.instructionKind === "product" && String(wo.assemblyId) === String(asmId);
      return false;
    });
  }
  function toolHtml(k) {
    if (k === "circular")
      return (
        '<div class="table-wrap"><table><thead><tr><th>Size</th><th>Contact</th><th>Tool</th><th>Positioner</th><th>Insert</th></tr></thead><tbody>' +
        CIRCULAR_TOOLS.map(function (r) {
          return "<tr><td><b>" + esc(r.size) + "</b></td><td>" + esc(r.contact) + "</td><td>" + esc(r.tool) + "</td><td>" + esc(r.positioner) + "</td><td>" + esc(r.insert) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>"
      );
    if (k === "molex")
      return (
        '<div class="table-wrap"><table><thead><tr><th>Crimp</th><th>Tool</th><th>Extract</th></tr></thead><tbody>' +
        MOLEX_TOOLS.map(function (r) {
          return "<tr><td><b>" + esc(r.crimp) + "</b></td><td>" + esc(r.tool) + "</td><td>" + esc(r.extract) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>"
      );
    if (k === "rj45")
      return (
        '<div class="table-wrap"><table><thead><tr><th>Connector</th><th>Tool</th><th>Cable</th></tr></thead><tbody>' +
        RJ45_TOOLS.map(function (r) {
          return "<tr><td><b>" + esc(r.conn) + "</b></td><td>" + esc(r.tool) + "</td><td>" + esc(r.cable) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>"
      );
    return "";
  }

  function mediaHtml(media, opts) {
    media = media || [];
    opts = opts || {};
    if (!media.length) return '<p style="color:var(--ink-soft);margin:0;font-size:.88rem">No photos, videos, or links yet.</p>';
    return (
      '<div class="media-grid">' +
      media
        .map(function (m, i) {
          var rm = opts.removable
            ? '<button type="button" class="rm" title="Remove" data-action="remove-media" data-kind="' +
              esc(opts.kind || "") +
              '" data-id="' +
              esc(opts.id || "") +
              '" data-step="' +
              (opts.stepIndex != null ? opts.stepIndex : -1) +
              '" data-mi="' +
              i +
              '">x</button>'
            : "";
          if (m.type === "image")
            return (
              '<div class="media-item">' +
              rm +
              '<img src="' +
              esc(m.url) +
              '" alt="' +
              esc(m.caption || "") +
              '"><div class="cap">' +
              esc(m.caption || "Photo " + (i + 1)) +
              "</div></div>"
            );
          if (m.type === "video") {
            if (/youtube\.com|youtu\.be|vimeo\.com/i.test(m.url))
              return (
                '<div class="media-item">' +
                rm +
                '<a href="' +
                esc(m.url) +
                '" target="_blank" rel="noopener">Video: ' +
                esc(m.caption || m.url) +
                "</a></div>"
              );
            return (
              '<div class="media-item">' +
              rm +
              '<video src="' +
              esc(m.url) +
              '" controls preload="metadata"></video><div class="cap">' +
              esc(m.caption || "Video") +
              "</div></div>"
            );
          }
          return (
            '<div class="media-item">' +
            rm +
            '<a href="' +
            esc(m.url) +
            '" target="_blank" rel="noopener">' +
            (m.caption ? esc(m.caption) : "Open link") +
            '<div style="font-weight:400;font-size:.75rem;margin-top:.25rem;color:var(--ink-soft)">' +
            esc(m.url) +
            "</div></a></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function shell(inner) {
    return (
      '<div class="top"><div class="top-row"><div class="brand"><div class="mark">WI</div><div><h1>Work Instructions</h1><p>QA = step type only</p></div></div></div>' +
      '<nav class="tabs">' +
      '<a class="tab" href="CapacityTracker.html#dashboard">Work Centers</a>' +
      '<a class="tab" href="CapacityTracker.html#planning">Planning</a>' +
      '<a class="tab" href="WorkOrders.html">Work Orders</a>' +
      '<a class="tab" href="WipBoard.html">WIP Board</a>' +
      '<a class="tab is-on" href="WorkInstructions.html">Work Instructions</a>' +
      '<a class="tab" href="DowntimeLogger.html">Downtime</a>' +
      '<a class="tab" href="Analytics.html">Analytics</a>' +
      '<a class="tab" href="Settings.html">Settings</a>' +
      "</nav></div><div class=\"wrap\">" +
      inner +
      '</div><div class="toasts"></div><dialog id="modal"></dialog>'
    );
  }

  function renderLibrary() {
    var list = ops();
    var cards = list
      .map(function (op) {
        var steps = normalizeSteps(op.steps);
        var mc = (op.media || []).length;
        var smc = steps.reduce(function (n, s) {
          return n + stepMedia(s).length;
        }, 0);
        var qn = countQa(steps);
        return (
          '<div class="card op-card" data-action="open-op" data-id="' +
          op.id +
          '"><h3>' +
          esc(op.name) +
          "</h3><p>" +
          steps.length +
          " steps" +
          (qn ? " · " + qn + " QA" : "") +
          (mc || smc ? " · " + (mc + smc) + " media" : "") +
          (op.doc ? " · " + esc(op.doc) : "") +
          "</p></div>"
        );
      })
      .join("");
    var L = linked(state.libraryTab);
    var linkedHtml = L.length
      ? "<ul>" +
        L.slice(0, 12)
          .map(function (w) {
            return "<li><b>" + esc(w.number) + "</b> " + esc(w.title || "") + "</li>";
          })
          .join("") +
        "</ul>"
      : '<p style="color:var(--ink-soft);margin:0">None yet.</p>';
    return shell(
      '<div class="page-head"><h2 style="margin:0">Work instruction library</h2>' +
        '<p style="color:var(--ink-soft)">QA is a <b>step type</b> — no separate QA section. Edit a step and set type to QA.</p></div>' +
        '<div class="subtabs">' +
        '<button class="subtab ' +
        (state.libraryTab === "cable" ? "is-on" : "") +
        '" data-action="lib" data-tab="cable">Generic cable</button>' +
        '<button class="subtab ' +
        (state.libraryTab === "assembly" ? "is-on" : "") +
        '" data-action="lib" data-tab="assembly">Generic assembly / POD</button>' +
        '<button class="subtab" data-action="view" data-view="products">Product / LRU WIs</button></div>' +
        '<div class="warn-box">Edit a step → set <b>Step type = QA</b> for inspection criteria.</div>' +
        '<div class="grid">' +
        cards +
        "</div>" +
        '<div class="card" style="margin-top:1rem"><h3 style="margin:0 0 .5rem;font-size:.95rem">Open jobs tagged ' +
        (state.libraryTab === "cable" ? "Cable" : "Assembly/POD") +
        "</h3>" +
        linkedHtml +
        "</div>"
    );
  }

  function renderOp() {
    var op = opById(state.selectedOp);
    if (!op) {
      state.view = "library";
      return renderLibrary();
    }
    op.steps = normalizeSteps(op.steps);
    var steps = op.steps
      .map(function (s, i) {
        var media = stepMedia(s);
        var st = s.stepType || "assembly";
        return (
          '<li class="step-item ' +
          (st === "qa" ? "is-qa" : "") +
          '"><div style="display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start;flex-wrap:wrap"><div><span class="pill">' +
          (i + 1) +
          '</span> <span class="pill ' +
          (st === "qa" ? "qa" : "") +
          '">' +
          esc(stepTypeLabel(st)) +
          "</span> " +
          esc(stepText(s)) +
          (media.length ? ' <span class="pill">' + media.length + " photo(s)</span>" : "") +
          '</div><button class="btn small" data-action="add-step-media" data-kind="op" data-id="' +
          op.id +
          '" data-step="' +
          i +
          '">Add media</button></div>' +
          (media.length
            ? '<div style="margin-top:.5rem">' +
              mediaHtml(media, { removable: true, kind: "op", id: op.id, stepIndex: i }) +
              "</div>"
            : "") +
          "</li>"
        );
      })
      .join("");
    return shell(
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">' +
        '<button class="btn ghost small" data-action="view" data-view="library">&larr; Library</button>' +
        '<button class="btn primary small" data-action="edit-op" data-id="' +
        op.id +
        '">Edit instruction</button>' +
        '<button class="btn small" data-action="add-media" data-kind="op" data-id="' +
        op.id +
        '">Add photo / video / link</button></div>' +
        '<h2 style="margin:.5rem 0 0">' +
        esc(op.name) +
        "</h2>" +
        '<p style="color:var(--ink-soft)">' +
        (op.doc ? esc(op.doc) + " · " : "") +
        "Generic " +
        (state.libraryTab === "assembly" ? "assembly/POD" : "cable") +
        " · QA = steps tagged QA</p>" +
        (op.hasTool ? '<div class="card"><h3 style="margin:0 0 .5rem">Tooling</h3>' + toolHtml(op.hasTool) + "</div>" : "") +
        '<div class="card" style="margin-top:.85rem"><h3 style="margin:0 0 .5rem">Instruction-level media</h3>' +
        mediaHtml(op.media, { removable: true, kind: "op", id: op.id, stepIndex: -1 }) +
        "</div>" +
        '<div class="card" style="margin-top:.85rem"><h3 style="margin:0 0 .5rem">Steps</h3><ul class="step-list">' +
        steps +
        "</ul></div>"
    );
  }

  function renderProducts() {
    var list = state.data.assemblies || [];
    var cards = list
      .map(function (a) {
        var steps = normalizeSteps(a.steps);
        var mc = (a.media || []).length;
        var smc = steps.reduce(function (n, s) {
          return n + stepMedia(s).length;
        }, 0);
        var ph = asmProjectedHours(a);
        var qn = countQa(steps);
        return (
          '<div class="card op-card" data-action="open-asm" data-id="' +
          a.id +
          '"><h3>' +
          esc(a.name) +
          "</h3><p>" +
          esc(a.productCode || "") +
          " · " +
          steps.length +
          " steps" +
          (qn ? " · " + qn + " QA" : "") +
          (ph ? " · " + ph + "h" : "") +
          (mc || smc ? " · " + (mc + smc) + " media" : "") +
          '</p><p style="margin-top:.35rem">' +
          linked("product", a.id).length +
          " open job(s) linked</p></div>"
        );
      })
      .join("");
    return shell(
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:1rem;margin-bottom:1rem">' +
        '<div><h2 style="margin:0">Product / LRU / POD WIs</h2><p style="color:var(--ink-soft)">QA is a step type, not a separate list.</p></div>' +
        '<button class="btn primary" data-action="new-product">New product WI</button></div>' +
        '<div class="subtabs">' +
        '<button class="subtab" data-action="lib" data-tab="cable">Generic cable</button>' +
        '<button class="subtab" data-action="lib" data-tab="assembly">Generic assembly / POD</button>' +
        '<button class="subtab is-on" data-action="view" data-view="products">Product / LRU WIs</button></div>' +
        '<div class="grid">' +
        cards +
        "</div>"
    );
  }

  function renderAsm() {
    var a = asmById(state.selectedAsm);
    if (!a) {
      state.view = "products";
      return renderProducts();
    }
    a.steps = normalizeSteps(a.steps);
    var steps = a.steps
      .map(function (s, i) {
        var media = stepMedia(s);
        var st = s.stepType || "assembly";
        return (
          '<li class="step-item ' +
          (st === "qa" ? "is-qa" : "") +
          '"><div style="display:flex;justify-content:space-between;gap:.5rem;align-items:flex-start;flex-wrap:wrap"><div><span class="pill">' +
          (i + 1) +
          '</span> <span class="pill ' +
          (st === "qa" ? "qa" : "") +
          '">' +
          esc(stepTypeLabel(st)) +
          "</span> " +
          (s.projectedHours ? '<span class="pill">' + s.projectedHours + "h</span> " : "") +
          esc(stepText(s)) +
          (media.length ? ' <span class="pill">' + media.length + " photo(s)</span>" : "") +
          '</div><button class="btn small" data-action="add-step-media" data-kind="asm" data-id="' +
          a.id +
          '" data-step="' +
          i +
          '">Add media</button></div>' +
          (media.length
            ? '<div style="margin-top:.5rem">' +
              mediaHtml(media, { removable: true, kind: "asm", id: a.id, stepIndex: i }) +
              "</div>"
            : "") +
          "</li>"
        );
      })
      .join("");
    return shell(
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">' +
        '<button class="btn ghost small" data-action="view" data-view="products">&larr; Products</button>' +
        '<button class="btn primary small" data-action="edit-asm" data-id="' +
        a.id +
        '">Edit instruction</button>' +
        '<button class="btn small" data-action="add-media" data-kind="asm" data-id="' +
        a.id +
        '">Add photo / video / link</button></div>' +
        '<h2 style="margin:.5rem 0 0">' +
        esc(a.name) +
        '</h2><p style="color:var(--ink-soft)">' +
        esc(a.productCode || "") +
        " · QA = steps tagged QA</p>" +
        '<div class="card"><h3 style="margin:0 0 .5rem">Instruction-level media</h3>' +
        mediaHtml(a.media, { removable: true, kind: "asm", id: a.id, stepIndex: -1 }) +
        "</div>" +
        '<div class="card" style="margin-top:.85rem"><h3 style="margin:0 0 .5rem">Steps</h3><ul class="step-list">' +
        steps +
        "</ul></div>"
    );
  }

  function renderStepEditorList(kind, id) {
    var obj = kind === "op" ? opById(id) : asmById(id);
    if (!obj) return "";
    var steps = normalizeSteps(obj.steps);
    if (!steps.length) return '<p style="color:var(--ink-soft)">No steps yet.</p>';
    return (
      '<div style="display:flex;flex-direction:column;gap:.45rem">' +
      steps
        .map(function (s, i) {
          var mc = stepMedia(s).length;
          var st = s.stepType || "assembly";
          return (
            '<div class="step-item ' +
            (st === "qa" ? "is-qa" : "") +
            '" style="display:flex;justify-content:space-between;gap:.5rem;align-items:center;flex-wrap:wrap">' +
            "<div><span class=\"pill\">" +
            (i + 1) +
            '</span> <span class="pill ' +
            (st === "qa" ? "qa" : "") +
            '">' +
            esc(stepTypeLabel(st)) +
            "</span> " +
            (s.projectedHours ? '<span class="pill">' + s.projectedHours + "h</span> " : "") +
            (s.workCenterId ? '<span class="pill">' + esc(centerName(s.workCenterId)) + "</span> " : "") +
            esc(stepText(s)) +
            (mc ? ' <span class="pill">' + mc + " media</span>" : "") +
            '</div><div style="display:flex;gap:.35rem;flex-wrap:wrap">' +
            '<button type="button" class="btn small" data-action="edit-one-step" data-kind="' +
            kind +
            '" data-id="' +
            id +
            '" data-step="' +
            i +
            '">Edit</button>' +
            '<button type="button" class="btn small" data-action="add-step-media" data-kind="' +
            kind +
            '" data-id="' +
            id +
            '" data-step="' +
            i +
            '">Media</button>' +
            '<button type="button" class="btn small" data-action="move-step" data-dir="up" data-kind="' +
            kind +
            '" data-id="' +
            id +
            '" data-step="' +
            i +
            '">Up</button>' +
            '<button type="button" class="btn small" data-action="move-step" data-dir="down" data-kind="' +
            kind +
            '" data-id="' +
            id +
            '" data-step="' +
            i +
            '">Down</button>' +
            '<button type="button" class="btn small danger" data-action="delete-step" data-kind="' +
            kind +
            '" data-id="' +
            id +
            '" data-step="' +
            i +
            '">Delete</button></div></div>'
          );
        })
        .join("") +
      "</div>"
    );
  }

  function openEditOneStep(kind, id, stepIndex, isNew) {
    var obj = kind === "op" ? opById(id) : asmById(id);
    if (!obj) return;
    obj.steps = normalizeSteps(obj.steps);
    var si = Number(stepIndex);
    var existing = !isNew && obj.steps[si] ? obj.steps[si] : { text: "", media: [], stepType: "assembly" };
    state.editTarget = { kind: kind, id: id, stepIndex: isNew ? -1 : si, editingStep: true, isNew: !!isNew };
    var d = document.getElementById("modal");
    var st = existing.stepType || "assembly";
    var ph = existing.projectedHours != null ? existing.projectedHours : 0;
    d.innerHTML =
      '<div class="modal-card"><h3 style="margin:0">' +
      (isNew ? "New step" : "Edit step " + (si + 1)) +
      "</h3>" +
      '<form data-form="edit-one-step"><div class="form-grid">' +
      '<label class="span-2">Step text<textarea class="field" name="text" rows="4" required>' +
      esc(stepText(existing)) +
      "</textarea></label>" +
      '<label>Step type<select class="field" name="stepType">' +
      '<option value="assembly" ' +
      (st === "assembly" ? "selected" : "") +
      ">Assembly / build</option>' +
      '<option value="qa" ' +
      (st === "qa" ? "selected" : "") +
      ">QA</option>' +
      '<option value="test" ' +
      (st === "test" ? "selected" : "") +
      ">Test</option></select></label>" +
      '<label>Projected hours<input class="field" name="projectedHours" type="number" min="0" step="0.25" value="' +
      ph +
      '">" +
      '</label><label class="span-2">Work center<select class="field" name="workCenterId">' +
      '<option value="">— Unassigned —</option>' +
      (state.data.workCenters || [])
        .map(function (c) {
          return (
            '<option value="' +
            c.id +
            '" ' +
            (String(existing.workCenterId || "") === String(c.id) ? "selected" : "") +
            ">" +
            esc(c.name) +
            "</option>"
          );
        })
        .join("") +
      '</select></label><p class="span-2" style="margin:0;color:var(--ink-soft);font-size:.82rem">Set type to <b>QA</b> for inspection. No separate QA list.</p></div>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" data-action="back-step-editor" data-kind="' +
      kind +
      '" data-id="' +
      id +
      '">Back</button><button class="btn primary" type="submit">Save step</button></div></form></div>';
    d.showModal();
  }

  function reopenStepEditor(kind, id) {
    if (kind === "op") openEditOp(id);
    else openEditAsm(id);
  }

  function openEditOp(id) {
    var op = opById(id);
    if (!op) return;
    state.editTarget = { kind: "op", id: id };
    var d = document.getElementById("modal");
    d.innerHTML =
      '<div class="modal-card"><h3 style="margin:0">Edit — ' +
      esc(op.name) +
      "</h3>" +
      '<form data-form="edit-op-meta"><div class="form-grid">' +
      '<label class="span-2">Name<input class="field" name="name" value="' +
      esc(op.name) +
      '" required></label>' +
      '<label class="span-2">Doc / reference<input class="field" name="doc" value="' +
      esc(op.doc || "") +
      '"></label></div>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="btn primary" type="submit">Save header</button></div></form>' +
      '<hr style="border:0;border-top:1px solid var(--rule);margin:1rem 0">' +
      '<h4 style="margin:0 0 .5rem">Steps</h4>' +
      '<p style="color:var(--ink-soft);font-size:.85rem;margin:0 0 .65rem">Tag a step as <b>QA</b> for inspection.</p>' +
      renderStepEditorList("op", id) +
      '<button class="btn primary" style="margin-top:.65rem" data-action="add-step" data-kind="op" data-id="' +
      id +
      '">+ New step</button></div>';
    d.showModal();
  }

  function openEditAsm(id) {
    var a = asmById(id);
    if (!a) return;
    state.editTarget = { kind: "asm", id: id };
    var d = document.getElementById("modal");
    d.innerHTML =
      '<div class="modal-card"><h3 style="margin:0">Edit — ' +
      esc(a.name) +
      "</h3>" +
      '<form data-form="edit-asm-meta"><div class="form-grid">' +
      '<label>Name<input class="field" name="name" value="' +
      esc(a.name) +
      '" required></label>' +
      '<label>Product code<input class="field" name="productCode" value="' +
      esc(a.productCode || "") +
      '"></label></div>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="btn primary" type="submit">Save header</button></div></form>' +
      '<hr style="border:0;border-top:1px solid var(--rule);margin:1rem 0">' +
      '<h4 style="margin:0 0 .5rem">Steps</h4>' +
      '<p style="color:var(--ink-soft);font-size:.85rem;margin:0 0 .65rem">Tag steps as Assembly, QA, or Test.</p>' +
      renderStepEditorList("asm", id) +
      '<button class="btn primary" style="margin-top:.65rem" data-action="add-step" data-kind="asm" data-id="' +
      id +
      '">+ New step</button></div>';
    d.showModal();
  }

  function openAddMedia(kind, id, stepIndex) {
    state.editTarget = { kind: kind, id: id, media: true, stepIndex: stepIndex == null ? -1 : Number(stepIndex) };
    var obj = kind === "op" ? opById(id) : asmById(id);
    if (!obj) return;
    obj.steps = normalizeSteps(obj.steps);
    var si = state.editTarget.stepIndex;
    var existing = si >= 0 && obj.steps[si] ? stepMedia(obj.steps[si]) : obj.media || [];
    var d = document.getElementById("modal");
    var stepLabel = si >= 0 ? " for step " + (si + 1) : " (instruction-level)";
    d.innerHTML =
      '<div class="modal-card"><h3 style="margin:0">Add photo, video, or link' +
      stepLabel +
      "</h3>" +
      '<p style="color:var(--ink-soft);font-size:.88rem">Multiple photos OK. Multi-select files or keep adding.</p>' +
      (existing.length
        ? '<div style="margin:.75rem 0"><b>Already on this step (' +
          existing.length +
          ")</b>" +
          mediaHtml(existing, { removable: true, kind: kind, id: id, stepIndex: si }) +
          "</div>"
        : "") +
      '<form data-form="add-media"><div class="form-grid">' +
      '<label class="span-2">Type<select class="field" name="type" id="mtype">' +
      '<option value="image">Photo (upload one or many, or URL)</option>' +
      '<option value="link">URL / SharePoint link</option>' +
      '<option value="video">Video (URL)</option></select></label>' +
      '<label class="span-2">URL (optional if uploading)<input class="field" name="url" placeholder="https://..." id="murl"></label>' +
      '<label class="span-2" id="mfile-wrap">Upload photo(s) — hold Ctrl/Cmd to select multiple<input class="field" type="file" name="file" accept="image/*" id="mfile" multiple></label>' +
      '<label class="span-2">Caption / label<input class="field" name="caption" placeholder="e.g. Correct crimp appearance"></label></div>' +
      '<div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Done</button>' +
      '<button class="btn primary" type="submit">Add to step</button></div></form></div>';
    d.showModal();
    var type = d.querySelector("#mtype");
    var wrap = d.querySelector("#mfile-wrap");
    function sync() {
      wrap.style.display = type.value === "image" ? "" : "none";
    }
    type.onchange = sync;
    sync();
  }

  function targetObj(kind, id) {
    return kind === "op" ? opById(id) : asmById(id);
  }

  function removeMedia(kind, id, stepIndex, mediaIndex) {
    var obj = targetObj(kind, id);
    if (!obj) return;
    var si = Number(stepIndex);
    var mi = Number(mediaIndex);
    if (si >= 0) {
      obj.steps = normalizeSteps(obj.steps);
      if (!obj.steps[si] || !obj.steps[si].media) return;
      obj.steps[si].media.splice(mi, 1);
    } else {
      if (!obj.media) return;
      obj.media.splice(mi, 1);
    }
    save();
    toast("Media removed");
    if (state.editTarget && state.editTarget.media) openAddMedia(kind, id, si);
    else render();
  }

  function render() {
    var h =
      state.view === "detail"
        ? renderOp()
        : state.view === "products"
          ? renderProducts()
          : state.view === "asm"
            ? renderAsm()
            : renderLibrary();
    document.getElementById("app").innerHTML = h;
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-action]");
    if (!b) return;
    var a = b.getAttribute("data-action");
    if (a === "lib") {
      state.libraryTab = b.getAttribute("data-tab");
      state.view = "library";
      render();
    } else if (a === "view") {
      state.view = b.getAttribute("data-view");
      render();
    } else if (a === "open-op") {
      state.selectedOp = b.getAttribute("data-id");
      state.view = "detail";
      render();
    } else if (a === "open-asm") {
      state.selectedAsm = b.getAttribute("data-id");
      state.view = "asm";
      render();
    } else if (a === "close-modal") {
      var d = document.getElementById("modal");
      if (d) d.close();
      render();
    } else if (a === "edit-op") openEditOp(b.getAttribute("data-id"));
    else if (a === "edit-asm") openEditAsm(b.getAttribute("data-id"));
    else if (a === "add-media") openAddMedia(b.getAttribute("data-kind"), b.getAttribute("data-id"), -1);
    else if (a === "add-step-media") openAddMedia(b.getAttribute("data-kind"), b.getAttribute("data-id"), b.getAttribute("data-step"));
    else if (a === "remove-media")
      removeMedia(b.getAttribute("data-kind"), b.getAttribute("data-id"), b.getAttribute("data-step"), b.getAttribute("data-mi"));
    else if (a === "edit-one-step")
      openEditOneStep(b.getAttribute("data-kind"), b.getAttribute("data-id"), b.getAttribute("data-step"), false);
    else if (a === "add-step") openEditOneStep(b.getAttribute("data-kind"), b.getAttribute("data-id"), -1, true);
    else if (a === "back-step-editor") reopenStepEditor(b.getAttribute("data-kind"), b.getAttribute("data-id"));
    else if (a === "delete-step") {
      var kind = b.getAttribute("data-kind");
      var id = b.getAttribute("data-id");
      var si = Number(b.getAttribute("data-step"));
      var obj = kind === "op" ? opById(id) : asmById(id);
      if (!obj) return;
      obj.steps = normalizeSteps(obj.steps);
      if (!confirm("Delete step " + (si + 1) + "?")) return;
      obj.steps.splice(si, 1);
      save();
      reopenStepEditor(kind, id);
      toast("Step deleted");
    } else if (a === "move-step") {
      var kind = b.getAttribute("data-kind");
      var id = b.getAttribute("data-id");
      var si = Number(b.getAttribute("data-step"));
      var dir = b.getAttribute("data-dir");
      var obj = kind === "op" ? opById(id) : asmById(id);
      if (!obj) return;
      obj.steps = normalizeSteps(obj.steps);
      var j = dir === "up" ? si - 1 : si + 1;
      if (j < 0 || j >= obj.steps.length) return;
      var tmp = obj.steps[si];
      obj.steps[si] = obj.steps[j];
      obj.steps[j] = tmp;
      save();
      reopenStepEditor(kind, id);
    } else if (a === "new-product") {
      var d = document.getElementById("modal");
      d.innerHTML =
        '<div class="modal-card"><h3 style="margin:0">New product WI</h3><form data-form="np"><div class="form-grid">' +
        '<label>Name<input class="field" name="name" required></label><label>Product code<input class="field" name="productCode"></label>' +
        '<label class="span-2">Steps (one per line — tag QA later by editing each step)<textarea class="field" name="steps" rows="6"></textarea></label></div>' +
        '<div class="modal-actions"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>';
      d.showModal();
    }
  });

  document.addEventListener("submit", function (e) {
    var f = e.target.closest("[data-form]");
    if (!f) return;
    e.preventDefault();
    var form = f.getAttribute("data-form");
    var fd = new FormData(f);

    if (form === "np") {
      var rec = {
        id: uid("asm"),
        name: String(fd.get("name")).trim(),
        productCode: String(fd.get("productCode") || "").trim(),
        steps: normalizeSteps(
          String(fd.get("steps") || "")
            .split("\n")
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean)
        ),
        media: []
      };
      state.data.assemblies.unshift(rec);
      save();
      document.getElementById("modal").close();
      state.selectedAsm = rec.id;
      state.view = "asm";
      toast("Saved");
      render();
      return;
    }
    if (form === "edit-op-meta") {
      var op = opById(state.editTarget.id);
      if (!op) return;
      op.name = String(fd.get("name") || op.name).trim();
      op.doc = String(fd.get("doc") || "").trim();
      delete op.qa;
      save();
      toast("Header saved");
      reopenStepEditor("op", op.id);
      return;
    }
    if (form === "edit-asm-meta") {
      var a = asmById(state.editTarget.id);
      if (!a) return;
      a.name = String(fd.get("name") || a.name).trim();
      a.productCode = String(fd.get("productCode") || "").trim();
      delete a.qa;
      save();
      toast("Header saved");
      reopenStepEditor("asm", a.id);
      return;
    }
    if (form === "edit-one-step") {
      var kind = state.editTarget.kind;
      var id = state.editTarget.id;
      var obj = kind === "op" ? opById(id) : asmById(id);
      if (!obj) return;
      obj.steps = normalizeSteps(obj.steps);
      var text = String(fd.get("text") || "").trim();
      if (!text) {
        toast("Step text required");
        return;
      }
      var stepType = String(fd.get("stepType") || "assembly");
      if (["assembly", "qa", "test"].indexOf(stepType) < 0) stepType = "assembly";
      var projectedHours = Math.max(0, Number(fd.get("projectedHours")) || 0);
      var workCenterId = String(fd.get("workCenterId") || "");
      if (state.editTarget.isNew) {
        obj.steps.push({
          text: text,
          media: [],
          stepType: stepType,
          projectedHours: projectedHours,
          workCenterId: workCenterId
        });
        toast("Step added");
      } else {
        var si = state.editTarget.stepIndex;
        if (!obj.steps[si]) obj.steps[si] = { text: "", media: [], stepType: "assembly", projectedHours: 0 };
        obj.steps[si].text = text;
        obj.steps[si].stepType = stepType;
        obj.steps[si].projectedHours = projectedHours;
        obj.steps[si].workCenterId = workCenterId;
        if (!obj.steps[si].media) obj.steps[si].media = [];
        toast("Step updated");
      }
      save();
      reopenStepEditor(kind, id);
      return;
    }
    if (form === "add-media") {
      var kind = state.editTarget.kind;
      var id = state.editTarget.id;
      var obj = targetObj(kind, id);
      if (!obj) return;
      if (!obj.media) obj.media = [];
      var type = String(fd.get("type") || "image");
      var caption = String(fd.get("caption") || "").trim();
      var url = String(fd.get("url") || "").trim();
      var fileInput = f.querySelector("#mfile");
      var si = state.editTarget.stepIndex;

      function pushItem(item) {
        if (si != null && si >= 0) {
          obj.steps = normalizeSteps(obj.steps);
          if (!obj.steps[si]) {
            toast("Step not found");
            return false;
          }
          if (!obj.steps[si].media) obj.steps[si].media = [];
          obj.steps[si].media.push(item);
        } else {
          if (!obj.media) obj.media = [];
          obj.media.push(item);
        }
        return true;
      }

      function done(count) {
        save();
        toast(count > 1 ? count + " items added to step" : si >= 0 ? "Media added to step " + (si + 1) : "Media added");
        openAddMedia(kind, id, si);
      }

      if (type === "image" && fileInput && fileInput.files && fileInput.files.length) {
        var files = Array.prototype.slice.call(fileInput.files);
        var tooBig = files.filter(function (file) {
          return file.size > 2.5 * 1024 * 1024;
        });
        if (tooBig.length) {
          toast(tooBig.length + " file(s) over 2.5MB skipped. Use SharePoint URLs for large photos.");
          files = files.filter(function (file) {
            return file.size <= 2.5 * 1024 * 1024;
          });
        }
        if (!files.length && !url) {
          toast("Need a URL or photo under 2.5MB");
          return;
        }
        var pending = files.length;
        var added = 0;
        if (url) {
          if (pushItem({ id: uid("m"), type: type, url: url, caption: caption })) added++;
        }
        if (!files.length) {
          if (added) done(added);
          return;
        }
        files.forEach(function (file, idx) {
          var reader = new FileReader();
          reader.onload = function () {
            if (
              pushItem({
                id: uid("m"),
                type: "image",
                url: reader.result,
                caption: caption || file.name || "Photo " + (idx + 1)
              })
            )
              added++;
            pending--;
            if (pending <= 0) done(added);
          };
          reader.onerror = function () {
            pending--;
            if (pending <= 0) done(added);
          };
          reader.readAsDataURL(file);
        });
        return;
      }
      if (!url) {
        toast("Need a URL or photo");
        return;
      }
      if (pushItem({ id: uid("m"), type: type, url: url, caption: caption })) done(1);
    }
  });

  load();
  if (!(state.data.workOrders || []).length) {
    fetch("capacity-data.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        state.data.workOrders = d.workOrders || [];
        state.data.people = d.people || [];
        state.data.workCenters = d.workCenters || [];
        save();
        render();
      })
      .catch(function () {
        render();
      });
  } else render();
})();
