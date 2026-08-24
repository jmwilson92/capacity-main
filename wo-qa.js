/* Work Orders extensions: complexity field helpers + QA non-compliance */
(function (root) {
  var STORAGE_KEY = "capacity-tracker.v1";

  var NC_CATEGORIES = [
    { id: "nick", label: "Wire nicks / insulation" },
    { id: "wrong_tool", label: "Wrong tool / die / adapter" },
    { id: "crimp", label: "Crimp quality" },
    { id: "solder", label: "Solder quality" },
    { id: "length", label: "Cut / strip length" },
    { id: "seat", label: "Pin / contact seating" },
    { id: "label", label: "Label content / adhesion" },
    { id: "torque", label: "Torque / hardware" },
    { id: "fod", label: "FOD / cleanliness" },
    { id: "sequence", label: "Sequence / missing step" },
    { id: "other", label: "Other" }
  ];

  function loadBase() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveBase(base) {
    base.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
  }

  function uid(p) {
    return p + "_" + Math.random().toString(36).slice(2, 9);
  }

  function writeQaRecord(rec) {
    var base = loadBase();
    if (!Array.isArray(base.qaRecords)) base.qaRecords = [];
    base.qaRecords.unshift(rec);
    saveBase(base);
    return rec;
  }

  function complexitySelectHtml(current) {
    var cur = String(current || "medium").toLowerCase();
    var opts = [
      { v: "easy", t: "Easy" },
      { v: "medium", t: "Medium" },
      { v: "hard", t: "Hard" }
    ];
    return (
      '<label style="margin:.75rem 0">Complexity (output score)' +
      '<select class="field" name="complexity" data-bind-tag="complexity">' +
      opts
        .map(function (o) {
          return (
            '<option value="' +
            o.v +
            '"' +
            (cur === o.v ? " selected" : "") +
            ">" +
            o.t +
            "</option>"
          );
        })
        .join("") +
      "</select></label>"
    );
  }

  function ncFormHtml(opName) {
    var cats = NC_CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '">' + c.label + "</option>";
    }).join("");
    return (
      '<form class="modal-card" data-form="qa-nc">' +
      "<h3 style="margin:0">Non-compliance</h3>" +
      '<p style="color:var(--ink-soft);font-size:.88rem;margin:.35rem 0 .75rem">QA Fail · ' +
      (opName || "Operation") +
      "</p>" +
      "<label>Category<select class="field" name="category" required>" +
      '<option value="">Select…</option>' +
      cats +
      "</select></label>" +
      '<label style="margin-top:.65rem">Severity<select class="field" name="severity" required>' +
      '<option value="minor">Minor</option>' +
      '<option value="major" selected>Major</option>' +
      '<option value="critical">Critical</option>' +
      "</select></label>" +
      '<label style="margin-top:.65rem">Notes<textarea class="field" name="notes" rows="3" required placeholder="What failed and what was expected"></textarea></label>' +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem">' +
      '<button type="button" class="btn" data-action="close-modal">Cancel</button>' +
      '<button type="submit" class="btn primary">Save fail record</button>' +
      "</div></form>"
    );
  }

  root.WoQa = {
    NC_CATEGORIES: NC_CATEGORIES,
    writeQaRecord: writeQaRecord,
    complexitySelectHtml: complexitySelectHtml,
    ncFormHtml: ncFormHtml,
    uid: uid
  };
})(typeof window !== "undefined" ? window : globalThis);
