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
    var html = '<label style="margin:.75rem 0">Complexity (output score)';
    html += '<select class="field" name="complexity" data-bind-tag="complexity">';
    var opts = [
      ["easy", "Easy"],
      ["medium", "Medium"],
      ["hard", "Hard"]
    ];
    for (var i = 0; i < opts.length; i++) {
      html +=
        '<option value="' +
        opts[i][0] +
        '"' +
        (cur === opts[i][0] ? " selected" : "") +
        ">" +
        opts[i][1] +
        "</option>";
    }
    html += "</select></label>";
    return html;
  }

  function ncFormHtml(opName) {
    var cats = "";
    for (var i = 0; i < NC_CATEGORIES.length; i++) {
      cats +=
        '<option value="' +
        NC_CATEGORIES[i].id +
        '">' +
        NC_CATEGORIES[i].label +
        "</option>";
    }
    return (
      '<form class="modal-card" data-form="qa-nc">' +
      "<h3 style=" +
      '"margin:0"' +
      ">Non-compliance</h3>" +
      '<p style="color:var(--ink-soft);font-size:.88rem;margin:.35rem 0 .75rem">QA Fail · ' +
      (opName || "Operation") +
      "</p>" +
      "<label>Category<select class=" +
      '"field"' +
      ' name="category" required>' +
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
