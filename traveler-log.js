/* Running activity log on travelers / work orders */
(function (root) {
  function uid(p) {
    return (p || "log") + "_" + Math.random().toString(36).slice(2, 9);
  }

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

  function ensure(tr) {
    if (!tr.activityLog) tr.activityLog = [];
    return tr.activityLog;
  }

  function push(tr, entry) {
    if (!tr) return null;
    var list = ensure(tr);
    var row = {
      id: uid("al"),
      at: new Date().toISOString(),
      type: (entry && entry.type) || "note",
      text: String((entry && entry.text) || "").trim(),
      by: (entry && entry.by) || "",
      byId: (entry && entry.byId) || "",
      opId: (entry && entry.opId) || "",
      opName: (entry && entry.opName) || ""
    };
    list.unshift(row);
    return row;
  }

  function formatWhen(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso || "";
      return (
        d.toLocaleDateString() +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch (e) {
      return iso || "";
    }
  }

  function typeLabel(t) {
    if (t === "tech") return "Tech complete";
    if (t === "qa-pass") return "QA pass";
    if (t === "qa-fail") return "QA fail";
    if (t === "step") return "Step complete";
    if (t === "checkin") return "Check in";
    return "Note";
  }

  function html(tr) {
    var list = (tr && tr.activityLog) || [];
    var head =
      '<div class="card" style="margin-top:.85rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap">' +
      "<h3 style=" +
      '"margin:0;font-size:.95rem"' +
      ">Activity log</h3>" +
      '<button type="button" class="btn small" data-action="add-log">+ Log note</button></div>';
    if (!list.length) {
      return (
        head +
        '<p style="color:var(--ink-soft);margin:.5rem 0 0;font-size:.88rem">No entries yet. Use <b>Log note</b> or complete an operation with notes.</p></div>'
      );
    }
    var rows = "";
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      rows +=
        '<div style="padding:.55rem 0;border-bottom:1px solid var(--rule)">' +
        '<div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">' +
        '<span class="pill open">' +
        esc(typeLabel(e.type)) +
        "</span>" +
        '<span style="font-size:.78rem;color:var(--ink-soft)">' +
        esc(formatWhen(e.at)) +
        "</span></div>";
      if (e.opName) {
        rows +=
          '<div style="font-size:.85rem;margin-top:.2rem"><b>' +
          esc(e.opName) +
          "</b></div>";
      }
      if (e.text) {
        rows +=
          '<div style="margin-top:.25rem;white-space:pre-wrap">' +
          esc(e.text) +
          "</div>";
      }
      rows +=
        '<div style="font-size:.78rem;color:var(--ink-soft);margin-top:.2rem">' +
        esc(e.by || "—") +
        "</div></div>";
    }
    return head + '<div style="margin-top:.5rem">' + rows + "</div></div>";
  }

  function openNoteModal(onSubmit) {
    var dlg = document.getElementById("modal");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "modal";
      document.body.appendChild(dlg);
    }
    dlg.innerHTML =
      '<form class="modal-card" data-form="activity-note">' +
      "<h3 style=" +
      '"margin:0"' +
      ">Log what you did</h3>" +
      '<p style="color:var(--ink-soft);font-size:.88rem;margin:.35rem 0 .75rem">This stays on the work order for the next tech / QA.</p>' +
      '<label style="display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;font-weight:650;color:var(--ink-soft)">Notes' +
      '<textarea class="field" name="text" rows="4" required placeholder="What you did"></textarea></label>' +
      '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem">' +
      '<button type="button" class="btn" data-action="close-modal">Cancel</button>' +
      '<button type="submit" class="btn primary">Save to log</button></div></form>';
    if (dlg.showModal) dlg.showModal();
    var form = dlg.querySelector("[data-form=activity-note]");
    if (form) {
      form.onsubmit = function (ev) {
        ev.preventDefault();
        var fd = new FormData(ev.target);
        var text = String(fd.get("text") || "").trim();
        if (!text) return;
        if (dlg.close) dlg.close();
        if (typeof onSubmit === "function") onSubmit(text);
      };
    }
  }

  root.TravelerLog = {
    push: push,
    html: html,
    openNoteModal: openNoteModal,
    ensure: ensure
  };
})(typeof window !== "undefined" ? window : globalThis);
