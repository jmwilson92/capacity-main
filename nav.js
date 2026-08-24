/* Shared nav + suite login gate (name + PIN, force change from 1111) */
(function (root) {
  var SESSION_KEY = "capacity-tracker.session";
  var STORAGE_KEY = "capacity-tracker.v1";

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

  function loadData() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveData(data) {
    data.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function people() {
    return loadData().people || [];
  }

  function effectivePin(u) {
    if (!u) return "";
    if (u.pin != null && String(u.pin) !== "") return String(u.pin);
    return "1111";
  }

  function mustChangePin(u) {
    if (!u) return false;
    if (u.mustChangePin === true || u.mustChangePin === "true") return true;
    if (u.mustChangePin === false || u.mustChangePin === "false") return false;
    return effectivePin(u) === "1111";
  }

  function findPerson(id) {
    var list = people();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
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
      ".suite-gate{position:fixed;inset:0;z-index:9999;background:rgba(27,24,20,.55);display:flex;align-items:center;justify-content:center;padding:1rem}" +
      ".suite-gate-card{background:#fffcf6;border:1px solid #d4cbb8;border-radius:14px;padding:1.25rem;width:min(400px,94vw);box-shadow:0 12px 28px rgba(27,24,20,.18)}" +
      ".suite-gate-card h3{margin:0 0 .35rem;font-size:1.15rem}" +
      ".suite-gate-card p{margin:0 0 .85rem;color:#5c564c;font-size:.9rem}" +
      ".suite-gate-card label{display:flex;flex-direction:column;gap:.3rem;font-size:.8rem;font-weight:650;color:#5c564c;margin-bottom:.75rem}" +
      ".suite-gate-card input,.suite-gate-card select{border:1px solid #d4cbb8;border-radius:10px;padding:.5rem .65rem;font:inherit;background:#fff}" +
      ".suite-gate-err{color:#9b2c1a;font-size:.88rem;margin:0 0 .75rem}" +
      ".suite-gate-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.25rem}";
    document.head.appendChild(st);
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

  function removeGate() {
    var g = document.getElementById("suite-login-gate");
    if (g) g.remove();
  }

  function showChangePinGate(personId) {
    ensureStyles();
    removeGate();
    var gate = document.createElement("div");
    gate.id = "suite-login-gate";
    gate.className = "suite-gate";
    gate.innerHTML =
      '<form class="suite-gate-card" data-suite-change-pin data-person-id="' +
      esc(personId) +
      '">' +
      "<h3>Set your PIN</h3>" +
      "<p>First login uses 1111. Choose a new PIN (at least 4 digits). You will use this every time you open the suite.</p>" +
      '<label>New PIN<input name="a" type="password" inputmode="numeric" minlength="4" required autofocus></label>' +
      '<label>Confirm PIN<input name="b" type="password" inputmode="numeric" minlength="4" required></label>' +
      '<div class="suite-gate-err" id="suite-gate-err" hidden></div>' +
      '<div class="suite-gate-actions">' +
      '<button type="submit" class="suite-auth-btn primary">Save PIN</button>' +
      "</div></form>";
    document.body.appendChild(gate);
  }

  function showLoginGate() {
    ensureStyles();
    removeGate();
    var list = people()
      .slice()
      .sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    var opts = '<option value="">Select your name</option>';
    for (var i = 0; i < list.length; i++) {
      opts +=
        '<option value="' +
        esc(list[i].id) +
        '">' +
        esc(list[i].name || "Unnamed") +
        "</option>";
    }
    var gate = document.createElement("div");
    gate.id = "suite-login-gate";
    gate.className = "suite-gate";
    var emptyMsg = list.length
      ? "Select your name and enter your PIN. First-time PIN is 1111."
      : "No employees in the roster yet. Add people in Settings (or Capacity Tracker roster), then sign in.";
    gate.innerHTML =
      '<form class="suite-gate-card" data-suite-login>' +
      "<h3>Sign in</h3>" +
      "<p>" +
      emptyMsg +
      "</p>" +
      (list.length
        ? '<label>Name<select name="personId" required>' +
          opts +
          "</select></label>" +
          '<label>PIN<input name="pin" type="password" inputmode="numeric" required autocomplete="current-password"></label>'
        : "") +
      '<div class="suite-gate-err" id="suite-gate-err" hidden></div>' +
      '<div class="suite-gate-actions">' +
      (list.length
        ? '<button type="submit" class="suite-auth-btn primary">Sign in</button>'
        : '<a class="suite-auth-btn primary" href="Settings.html" style="text-decoration:none">Open Settings</a>') +
      "</div></form>";
    document.body.appendChild(gate);
  }

  function completeLogin(user) {
    writeSession({
      userId: user.id,
      personId: user.id,
      name: user.name,
      role: user.role || "tech"
    });
    removeGate();
    refreshAuthBars();
    if (typeof root.__suiteOnAuth === "function") {
      try {
        root.__suiteOnAuth(readSession());
      } catch (e) {}
    }
  }

  function setGateError(msg) {
    var err = document.getElementById("suite-gate-err");
    if (err) {
      err.hidden = !msg;
      err.textContent = msg || "";
    }
  }

  function refreshAuthBars() {
    document.querySelectorAll("#suite-auth, .suite-auth").forEach(function (el) {
      el.outerHTML = authHtml();
    });
    var host = document.getElementById("suite-auth-host");
    if (host) host.innerHTML = authHtml();
  }

  function signOut() {
    writeSession(null);
    try {
      if (window.TimeTrack) TimeTrack.stop();
    } catch (e) {}
    refreshAuthBars();
    showLoginGate();
  }

  function requireAuth(onReady) {
    ensureStyles();
    root.__suiteOnAuth = onReady || null;
    var s = readSession();
    if (!s || !s.personId) {
      showLoginGate();
      return false;
    }
    var user = findPerson(s.personId);
    if (!user) {
      writeSession(null);
      showLoginGate();
      return false;
    }
    if (mustChangePin(user)) {
      showChangePinGate(user.id);
      return false;
    }
    refreshAuthBars();
    if (typeof onReady === "function") {
      try {
        onReady(s);
      } catch (e) {}
    }
    return true;
  }

  function onDocClick(e) {
    var btn = e.target.closest("[data-suite-auth]");
    if (!btn) return;
    var a = btn.getAttribute("data-suite-auth");
    if (a === "in") showLoginGate();
    if (a === "out") signOut();
  }

  function onDocSubmit(e) {
    var login = e.target.closest("[data-suite-login]");
    if (login) {
      e.preventDefault();
      var fd = new FormData(login);
      var personId = String(fd.get("personId") || "");
      var pin = String(fd.get("pin") || "");
      var user = findPerson(personId);
      if (!user) {
        setGateError("Select your name.");
        return;
      }
      if (effectivePin(user) !== pin) {
        setGateError("Wrong PIN. First-time default is 1111.");
        return;
      }
      if (mustChangePin(user)) {
        writeSession({
          userId: user.id,
          personId: user.id,
          name: user.name,
          role: user.role || "tech",
          pendingPinChange: true
        });
        showChangePinGate(user.id);
        return;
      }
      completeLogin(user);
      return;
    }

    var chg = e.target.closest("[data-suite-change-pin]");
    if (chg) {
      e.preventDefault();
      var fd2 = new FormData(chg);
      var a = String(fd2.get("a") || "");
      var b = String(fd2.get("b") || "");
      var pid = chg.getAttribute("data-person-id");
      if (a.length < 4) {
        setGateError("PIN must be at least 4 digits.");
        return;
      }
      if (a !== b) {
        setGateError("PINs do not match.");
        return;
      }
      if (a === "1111") {
        setGateError("Choose something other than 1111.");
        return;
      }
      var data = loadData();
      if (!data.people) data.people = [];
      var person = null;
      for (var i = 0; i < data.people.length; i++) {
        if (String(data.people[i].id) === String(pid)) {
          person = data.people[i];
          break;
        }
      }
      if (!person) {
        setGateError("Employee not found.");
        return;
      }
      person.pin = a;
      person.mustChangePin = false;
      saveData(data);
      completeLogin(person);
    }
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
      return this.items
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
    },
    authHtml: authHtml,
    session: readSession,
    requireAuth: requireAuth,
    signOut: signOut,
    paintAuth: function () {
      ensureStyles();
      var host = document.getElementById("suite-auth-host");
      if (host) host.innerHTML = authHtml();
      else {
        var top = document.querySelector(".top-row");
        if (top && !top.querySelector(".suite-auth")) {
          var wrap = document.createElement("div");
          wrap.innerHTML = authHtml();
          if (wrap.firstChild) top.appendChild(wrap.firstChild);
        }
      }
    }
  };

  function auto() {
    try {
      SuiteNav.paintAuth();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", auto);
  else setTimeout(auto, 0);
})(typeof window !== "undefined" ? window : globalThis);
