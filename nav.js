/* Shared top navigation + PIN session for Production Suite */
(function (root) {
  var SESSION_KEY = "capacity-tracker.session";
  var STORAGE_KEY = "capacity-tracker.v1";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      if (ch === "&") return "\x26amp;";
      if (ch === "<") return "\x26lt;";
      if (ch === ">") return "\x26gt;";
      if (ch === '"') return "\x26quot;";
      return "\x26#39;";
    });
  }

  function readSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function writeSession(s) {
    if (!s) sessionStorage.removeItem(SESSION_KEY);
    else sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  function people() {
    try {
      var p = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return p.people || [];
    } catch (e) {
      return [];
    }
  }

  function effectivePin(u) {
    if (!u) return "";
    if (u.pin != null && String(u.pin) !== "") return String(u.pin);
    return "1111";
  }

  function personByPin(pin) {
    var entered = String(pin || "");
    return people().find(function (u) {
      return effectivePin(u) === entered;
    });
  }

  function authHtml() {
    var s = readSession();
    if (s && s.name) {
      return (
        '<div class="suite-auth" id="suite-auth">' +
        '<span class="suite-who">' +
        esc(s.name) +
        (s.role ? " · " + esc(s.role) : "") +
        "</span>" +
        '<button type="button" class="suite-auth-btn" data-suite-auth="out">Sign out</button>' +
        "</div>"
      );
    }
    return (
      '<div class="suite-auth" id="suite-auth">' +
      '<button type="button" class="suite-auth-btn primary" data-suite-auth="in">Sign in</button>' +
      "</div>"
    );
  }

  function ensureStyles() {
    if (document.getElementById("suite-nav-css")) return;
    var st = document.createElement("style");
    st.id = "suite-nav-css";
    st.textContent =
      ".suite-auth{display:flex;align-items:center;gap:.5rem;margin-left:auto;flex-wrap:wrap}" +
      ".suite-who{font-size:.82rem;font-weight:650;padding:.2rem .55rem;border-radius:999px;background:#d5ebe8;color:#0e3d3a}" +
      ".suite-auth-btn{border:1px solid #d4cbb8;background:#fffcf6;border-radius:10px;padding:.35rem .7rem;cursor:pointer;font:inherit;font-size:.85rem}" +
      ".suite-auth-btn.primary{background:#0e3d3a;color:#f6f1e7;border-color:#0e3d3a}" +
      ".suite-auth-dlg{border:0;padding:0;background:transparent;max-width:94vw}" +
      ".suite-auth-dlg::backdrop{background:rgba(27,24,20,.45)}" +
      ".suite-auth-card{background:#fffcf6;border:1px solid #d4cbb8;border-radius:14px;padding:1.15rem;width:min(360px,94vw);box-shadow:0 12px 28px rgba(27,24,20,.12)}" +
      ".suite-auth-card h3{margin:0 0 .35rem;font-size:1.05rem}" +
      ".suite-auth-card p{margin:0 0 .75rem;color:#5c564c;font-size:.88rem}" +
      ".suite-auth-card label{display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;font-weight:650;color:#5c564c}" +
      ".suite-auth-card input{border:1px solid #d4cbb8;border-radius:10px;padding:.45rem .65rem;font:inherit}" +
      ".suite-auth-card .row{display:flex;justify-content:space-between;gap:.5rem;margin-top:1rem}" +
      ".suite-auth-err{color:#9b2c1a;font-size:.88rem;margin:.5rem 0 0}";
    document.head.appendChild(st);
  }

  function openSignIn() {
    ensureStyles();
    var dlg = document.getElementById("suite-auth-dialog");
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.id = "suite-auth-dialog";
      dlg.className = "suite-auth-dlg";
      document.body.appendChild(dlg);
    }
    dlg.innerHTML =
      '<form class="suite-auth-card" data-suite-login>' +
      "<h3>Sign in</h3>" +
      "<p>Employee PIN. Default first-time PIN is 1111.</p>" +
      '<label>PIN<input name="pin" type="password" inputmode="numeric" required autofocus></label>' +
      '<div class="suite-auth-err" id="suite-auth-err" hidden></div>' +
      '<div class="row">' +
      '<button type="button" class="suite-auth-btn" data-suite-auth="cancel">Cancel</button>' +
      '<button type="submit" class="suite-auth-btn primary">Sign in</button>' +
      "</div></form>";
    if (typeof dlg.showModal === "function") dlg.showModal();
  }

  function refreshAuthBars() {
    document.querySelectorAll("#suite-auth, .suite-auth").forEach(function (el) {
      el.outerHTML = authHtml();
    });
    // pages that inject into a known host
    var host = document.getElementById("suite-auth-host");
    if (host) host.innerHTML = authHtml();
  }

  function signOut() {
    writeSession(null);
    try {
      if (window.TimeTrack) TimeTrack.stop();
    } catch (e) {}
    refreshAuthBars();
    // Work Orders and others that track session in memory should reload lightly
    if (location.pathname && /WorkOrders/i.test(location.pathname)) {
      location.reload();
      return;
    }
  }

  function onDocClick(e) {
    var btn = e.target.closest("[data-suite-auth]");
    if (!btn) return;
    var a = btn.getAttribute("data-suite-auth");
    if (a === "in") openSignIn();
    if (a === "out") signOut();
    if (a === "cancel") {
      var dlg = document.getElementById("suite-auth-dialog");
      if (dlg && dlg.open) dlg.close();
    }
  }

  function onDocSubmit(e) {
    var form = e.target.closest("[data-suite-login]");
    if (!form) return;
    e.preventDefault();
    var pin = (new FormData(form).get("pin") || "").toString();
    var user = personByPin(pin);
    var err = document.getElementById("suite-auth-err");
    if (!user) {
      if (err) {
        err.hidden = false;
        err.textContent = "Invalid PIN. First-time default is 1111 (set on employee in roster).";
      }
      return;
    }
    writeSession({
      userId: user.id,
      personId: user.id,
      name: user.name,
      role: user.role || "tech"
    });
    var dlg = document.getElementById("suite-auth-dialog");
    if (dlg && dlg.open) dlg.close();
    refreshAuthBars();
    if (/WorkOrders/i.test(location.pathname || "")) location.reload();
  }

  if (!root.__suiteAuthBound) {
    root.__suiteAuthBound = true;
    document.addEventListener("click", onDocClick);
    document.addEventListener("submit", onDocSubmit);
  }

  root.SuiteNav = {
    items: [
      { href: "CapacityTracker.html#dashboard", label: "Work Centers", match: ["CapacityTracker"] },
      { href: "CapacityTracker.html#planning", label: "Planning", match: ["CapacityTracker"] },
      { href: "WorkOrders.html", label: "Work Orders", match: ["WorkOrders"] },
      { href: "WipBoard.html", label: "WIP Board", match: ["WipBoard"] },
      { href: "WorkInstructions.html", label: "Work Instructions", match: ["WorkInstructions"] },
      { href: "Analytics.html", label: "Analytics", match: ["Analytics", "DowntimeLogger"] },
      { href: "Settings.html", label: "Settings", match: ["Settings", "SkillsMatrix"] }
    ],
    currentFile: function () {
      var path = (location.pathname || "").split("/").pop() || "";
      return path.replace(/\.html$/i, "") || "index";
    },
    html: function (activeLabel) {
      ensureStyles();
      var file = this.currentFile();
      var tabs = this.items
        .map(function (item) {
          var on = activeLabel
            ? item.label === activeLabel
            : (item.match || []).some(function (m) {
                return file.indexOf(m) === 0 || file === m;
              });
          return (
            '<a class="tab' +
            (on ? " is-on" : "") +
            '" href="' +
            item.href +
            '">' +
            item.label +
            "</a>"
          );
        })
        .join("");
      return tabs;
    },
    authHtml: authHtml,
    session: readSession,
    /** Call after painting top-row: inject auth into #suite-auth-host or append */
    paintAuth: function () {
      ensureStyles();
      var host = document.getElementById("suite-auth-host");
      if (host) host.innerHTML = authHtml();
      else {
        var top = document.querySelector(".top-row");
        if (top && !top.querySelector(".suite-auth")) {
          var wrap = document.createElement("div");
          wrap.innerHTML = authHtml();
          top.appendChild(wrap.firstChild);
        }
      }
    }
  };

  // Auto-paint auth when DOM is ready if host exists
  function auto() {
    try {
      SuiteNav.paintAuth();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else setTimeout(auto, 0);
})(typeof window !== "undefined" ? window : globalThis);
