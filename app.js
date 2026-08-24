(function () {
  function bootFailed(err) {
    const host = document.getElementById("app") || document.body;
    const message = err && err.message ? err.message : String(err || "Unknown error");
    host.innerHTML =
      '<div style="font-family:Segoe UI,sans-serif;padding:1.5rem;max-width:40rem">' +
      "<h2>Capacity Tracker could not start</h2>" +
      "<p>SharePoint loaded the page but a script failed. Open this file directly, or use the single-file <code>CapacityTracker.html</code> upload.</p>" +
      "<pre style=\"white-space:pre-wrap;background:#f3efe6;padding:0.75rem\">" +
      String(message).replace(/[&<>]/g, function (ch) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch];
      }) +
      "</pre></div>";
    console.error(err);
  }

  const Calc = window.CapacityCalc;
  const Store = window.CapacityStore;
  const SP = window.CapacitySharePoint;
  const Sync = window.CapacitySync;
  const Auth = window.CapacityAuth;
  const Graph = window.CapacityGraph;
  const Files = window.CapacityFileStore;
  if (!Calc || !Store || !SP || !Sync || !Auth || !Graph || !Files) {
    bootFailed(new Error("Required scripts did not load."));
    return;
  }

  const state = {
    view: "dashboard",
    data: Store.emptyData(),
    settings: Store.DEFAULT_SETTINGS,
    query: "",
    centerFilter: "",
    statusFilter: "",
    employeeId: "",
    modal: null,
    toasts: [],
    busy: false,
    error: "",
    repo: null,
    syncState: "off",
    syncError: "",
    pushTimer: 0,
    pollTimer: 0,
    filePoll: 0,
    filePushTimer: 0,
    listPoll: 0,
    signIn: null
  };

  const VIEWS = [
    ["dashboard", "Dashboard"],
    ["centers", "Work centers"],
    ["people", "Employees"],
    ["orders", "Work orders"],
    ["planning", "Planning"],
    ["settings", "Settings"]
  ];

  const STATUS_LABEL = {
    queued: "Queued",
    "in-progress": "In progress",
    "on-hold": "On hold",
    complete: "Complete"
  };

  const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function toast(message, kind) {
    const item = { id: Store.uid("t"), message, kind: kind || "ok" };
    state.toasts.push(item);
    renderToasts();
    setTimeout(() => {
      state.toasts = state.toasts.filter((t) => t.id !== item.id);
      renderToasts();
    }, 3800);
  }

  function renderToasts() {
    const host = $("#toasts");
    if (!host) return;
    host.innerHTML = state.toasts
      .map((t) => `<div class="toast ${t.kind === "error" ? "error" : ""}">${esc(t.message)}</div>`)
      .join("");
  }

  function summary() {
    return Calc.summarize(state.data, {
      planningWeeks: state.settings.planningWeeks,
      weekStartsOn: state.settings.weekStartsOn,
      loadMode: state.settings.loadMode
    });
  }

  function centerById(id) {
    return state.data.workCenters.find((c) => String(c.id) === String(id));
  }

  function centerName(id) {
    const wc = centerById(id);
    return wc ? wc.name : "Unassigned";
  }

  function centerOptions(selected, includeBlank) {
    const blank = includeBlank ? `<option value="">${includeBlank}</option>` : "";
    return (
      blank +
      state.data.workCenters
        .map(
          (c) =>
            `<option value="${esc(c.id)}" ${String(c.id) === String(selected) ? "selected" : ""}>${esc(c.name)}</option>`
        )
        .join("")
    );
  }

  function markSvg() {
    return `<svg class="mark" viewBox="0 0 36 36" aria-hidden="true">
      <rect width="36" height="36" rx="10" fill="#0e3d3a"/>
      <path d="M8 24V12h3.2v12H8zm8.4 0v-8.4H20V24h-3.6zM25 24V9h3.2v15H25z" fill="#f4efe4"/>
    </svg>`;
  }

  function storageLabel() {
    if (state.settings.storage === "file" && Files.connected()) {
      return state.syncState === "live" ? "Shared file (live)" : "Shared file";
    }
    if (state.settings.storage === "team" && state.settings.teamBinId) {
      return state.syncState === "live" ? "Live team board" : "Team board";
    }
    if (state.settings.storage === "sharepoint") {
      return Auth.hasToken() ? "SharePoint (signed in)" : "SharePoint (sign in)";
    }
    return "This browser only";
  }

  function fileEnabled() {
    return state.settings.storage === "file" && Files.connected();
  }

  function teamEnabled() {
    return state.settings.storage === "team" && state.settings.teamApiKey && state.settings.teamBinId;
  }

  function renderShell() {
    const app = $("#app");
    app.innerHTML = `
      <header class="top">
        <div class="top-row">
          <div class="brand">
            ${markSvg()}
            <div>
              <h1>Capacity Tracker</h1>
              <p>${esc(state.settings.siteName)} · ${esc(storageLabel())}</p>
            </div>
          </div>
          <div class="top-actions">
            ${
              state.settings.storage === "sharepoint"
                ? Auth.hasToken()
                  ? `<button class="btn ghost" data-action="sp-signout">Sign out</button>`
                  : `<button class="btn" data-action="sp-signin">Sign in to SharePoint</button>`
                : ""
            }
            <button class="btn ghost" data-action="export-json">Export</button>
            <button class="btn ghost" data-action="import">Import</button>
            <button class="btn primary" data-action="quick-add">New work order</button>
          </div>
        </div>
        <nav class="tabs">
          ${VIEWS.map(([id, label]) => {
            const on = state.view === id || (id === "people" && state.view === "employee");
            return `<button class="tab ${on ? "is-on" : ""}" data-action="view" data-view="${id}">${label}</button>`;
          }).join("")}
        </nav>
      </header>
      ${sharePointBanner() ? `<div class="wrap" style="padding-bottom:0">${sharePointBanner()}</div>` : ""}
      <main class="wrap ${state.busy ? "busy" : ""}" id="main"></main>
      <div class="toasts" id="toasts"></div>
      <dialog id="modal"></dialog>
    `;
    renderToasts();
    renderView();
    if (state.modal) openModal(state.modal);
  }

  function renderView() {
    const main = $("#main");
    if (!main) return;
    const view = {
      dashboard: renderDashboard,
      centers: renderCenters,
      people: renderPeople,
      employee: renderEmployee,
      orders: renderOrders,
      planning: renderPlanning,
      settings: renderSettings
    }[state.view];
    main.innerHTML = view();
  }

  function sharePointBanner() {
    if (state.signIn) {
      return `<div class="banner">
        <span>Sign in: open <a href="${esc(state.signIn.verifyUrl)}" target="_blank" rel="noopener">${esc(state.signIn.verifyUrl)}</a> and enter <strong>${esc(state.signIn.userCode)}</strong></span>
      </div>`;
    }
    if (state.settings.storage === "sharepoint" && !Auth.hasToken()) {
      return `<div class="banner warn">
        <span>This HTML page is the app. Data lives in SharePoint lists on Production. Sign in with your work account.</span>
        <button class="btn small" data-action="sp-signin">Sign in</button>
      </div>`;
    }
    if (state.settings.storage === "file" && !Files.connected()) {
      return `<div class="banner warn">
        <span>Connect capacity-data.json (keep it in the synced SharePoint folder) so everyone shares one board.</span>
        <button class="btn small" data-action="file-open">Open team file</button>
      </div>`;
    }
    return "";
  }

  function kpi(label, value, hint, level) {
    return `<article class="kpi ${level || ""}">
      <div class="label"><span>${esc(label)}</span></div>
      <div class="value">${value}</div>
      <div class="hint">${hint || ""}</div>
    </article>`;
  }

  function renderDashboard() {
    const s = summary();
    const t = s.totals;
    const empty = !state.data.workCenters.length;
    if (empty) {
      return `<section class="empty">
          <h3>No work centers yet</h3>
          <p>Create a work center, add employees on the roster, assign them to a center, then load work orders against that capacity.</p>
          <div class="filters" style="justify-content:center">
            <button class="btn primary" data-action="edit-center" data-id="">New work center</button>
            <button class="btn" data-action="demo">Load sample shop</button>
          </div>
        </section>`;
    }

    const upcoming = t.orders
      .filter((wo) => Calc.isOpen(wo) && wo.dueDate)
      .slice()
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .slice(0, 8);

    return `<div class="page-head">
        <div>
          <h2>This week's capacity</h2>
          <p class="lede">${esc(s.weeks[0].label)} · hours land in the ${state.settings.loadMode === "spread" ? "weeks leading up to the due date" : "week of the due date"}.</p>
        </div>
      </div>
      <section class="kpis">
        ${kpi("This week capacity", `${Calc.formatHours(t.thisWeekCapacity)}h`, t.thisWeekTimeOff ? `${Calc.formatHours(t.weeklyCapacity)}h roster · −${Calc.formatHours(t.thisWeekTimeOff)}h out` : `${t.headcount} people across ${s.centers.length} centers`)}
        ${kpi("This week load", `${Calc.formatHours(t.thisWeekLoad)}h`, `${Calc.formatHours(t.availableThisWeek)}h remaining`, t.thisWeekLevel === "over" ? "over" : "")}
        ${kpi("Utilization", esc(Calc.formatUtil(t.thisWeekUtil)), levelWords(t.thisWeekLevel), t.thisWeekLevel === "over" || t.thisWeekLevel === "tight" ? t.thisWeekLevel : "")}
        ${kpi("Overdue", `${Calc.formatHours(t.overdueHours)}h`, `${t.overdueOrders.length} open ${t.overdueOrders.length === 1 ? "order" : "orders"}`, t.overdueHours > 0 ? "over" : "")}
      </section>
      <div class="grid-2">
        <section class="card">
          <h3>Work centers</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Center</th>
                  <th class="num">People</th>
                  <th class="num">Capacity</th>
                  <th>This week</th>
                  <th class="num">Open WO</th>
                </tr>
              </thead>
              <tbody>
                ${s.centers
                  .map(
                    (c) => `<tr>
                      <td><span class="center-dot" style="background:${esc(c.color)}"></span><button class="linkish" data-action="view" data-view="planning" data-center="${esc(c.id)}">${esc(c.name)}</button></td>
                      <td class="num">${c.headcount}</td>
                      <td class="num">${Calc.formatHours(c.weeklyCapacity)}h</td>
                      <td>${utilCell(c.thisWeekLoad, c.thisWeekCapacity, c.thisWeekUtil, c.thisWeekLevel)}</td>
                      <td class="num">${c.openCount}</td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
        <section class="card stack">
          ${renderOutThisWeek(s)}
          <h3>${s.atRisk.length ? "At risk & overdue" : "Upcoming due dates"}</h3>
          ${
            s.atRisk.length
              ? s.atRisk
                  .slice(0, 8)
                  .map(
                    (row) => `<div class="list-item">
                      <div>
                        <strong>${esc(row.wo.number)}</strong>
                        <div class="tiny muted">${esc(row.wo.title || "—")} · ${esc(row.workCenter.name)}</div>
                      </div>
                      <div class="tiny" style="text-align:right">
                        <span class="pill ${row.overdue ? "over" : "tight"}">${row.overdue ? "Overdue" : "Overloaded week"}</span>
                        <div class="muted">${esc(row.wo.dueDate || "No date")} · ${Calc.formatHours(Calc.remainingHours(row.wo))}h</div>
                      </div>
                    </div>`
                  )
                  .join("")
              : upcoming
                  .map(
                    (wo) => `<div class="list-item">
                      <div>
                        <strong>${esc(wo.number)}</strong>
                        <div class="tiny muted">${esc(wo.title || "—")} · ${esc(centerName(wo.workCenterId))}</div>
                      </div>
                      <div class="tiny muted">${esc(wo.dueDate)} · ${Calc.formatHours(Calc.remainingHours(wo))}h</div>
                    </div>`
                  )
                  .join("") || `<p class="muted">No open work orders.</p>`
          }
        </section>
      </div>`;
  }

  const ABSENCE_LABEL = { pto: "PTO", sick: "Sick", other: "Other" };

  function personById(id) {
    return state.data.people.find((p) => String(p.id) === String(id));
  }

  function absencesFor(personId) {
    return (state.data.absences || [])
      .filter((a) => String(a.personId) === String(personId))
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  }

  function renderOutThisWeek(s) {
    const week = s.weeks[0];
    if (!week) return "";
    const rows = state.data.people
      .map((p) => {
        const br = Calc.personWeekBreakdown(p, state.data.absences, week);
        return br.off > 0 ? { person: p, br } : null;
      })
      .filter(Boolean);
    if (!rows.length) return "";
    return `<div class="out-block">
      <h3>Out this week</h3>
      ${rows
        .map(
          (row) => `<div class="list-item">
            <div>
              <button class="linkish" data-action="open-employee" data-id="${esc(row.person.id)}">${esc(row.person.name)}</button>
              <div class="tiny muted">${esc(centerName(row.person.workCenterId))}</div>
            </div>
            <div class="tiny" style="text-align:right">
              <span class="pill tight">−${Calc.formatHours(row.br.off)}h</span>
              <div class="muted">${Calc.formatHours(row.br.available)}h left</div>
            </div>
          </div>`
        )
        .join("")}
    </div>`;
  }

  function levelWords(level) {
    return {
      over: "Over capacity",
      tight: "Tight — over 85%",
      healthy: "Healthy",
      light: "Light load",
      none: "No load this week"
    }[level] || "";
  }

  function utilCell(load, cap, util, level) {
    const pct = Number.isFinite(util) ? Math.min(util * 100, 100) : load > 0 ? 100 : 0;
    return `<div class="util">
      <div class="bar ${level}"><span style="width:${pct}%"></span></div>
      <span class="pill ${level}">${esc(Calc.formatUtil(util))}</span>
    </div>
    <div class="tiny muted">${Calc.formatHours(load)} / ${Calc.formatHours(cap)}h</div>`;
  }

  function renderCenters() {
    const s = summary();
    if (!s.centers.length) {
      return `<section class="empty">
        <h3>Create a work center</h3>
        <p>A work center is a crew or machine group. Assign employees from the roster; capacity is their hours minus PTO and sick time.</p>
        <button class="btn primary" data-action="edit-center" data-id="">New work center</button>
      </section>`;
    }
    return `<div class="page-head">
        <div>
          <h2>Work centers</h2>
          <p class="lede">${s.centers.length} centers · ${Calc.formatHours(s.totals.thisWeekCapacity)}h available this week</p>
        </div>
        <button class="btn primary" data-action="edit-center" data-id="">New work center</button>
      </div>
      <div class="cards">
        ${s.centers
          .map((c) => {
            const people = state.data.people.filter((p) => String(p.workCenterId) === c.id);
            return `<article class="card wc-card">
              <header>
                <div>
                  <h3><span class="center-dot" style="background:${esc(c.color)}"></span>${esc(c.name)}</h3>
                  <div class="tiny muted">${esc(c.notes || "No notes")}</div>
                </div>
                <span class="pill ${c.thisWeekLevel}">${esc(Calc.formatUtil(c.thisWeekUtil))}</span>
              </header>
              <div class="meta">
                <div><span class="k">People</span><span class="v">${c.headcount}</span></div>
                <div><span class="k">This week cap.</span><span class="v">${Calc.formatHours(c.thisWeekCapacity)}h</span></div>
                <div><span class="k">This week load</span><span class="v">${Calc.formatHours(c.thisWeekLoad)}h</span></div>
                <div><span class="k">Open orders</span><span class="v">${c.openCount}</span></div>
              </div>
              <div class="tiny muted">${
                people.length
                  ? people
                      .map(
                        (p) =>
                          `<button class="linkish" data-action="open-employee" data-id="${esc(p.id)}">${esc(p.name)}</button>`
                      )
                      .join(", ")
                  : "No employees assigned — set a work center on the roster"
              }</div>
              <div class="row-actions">
                <button class="btn small" data-action="edit-center" data-id="${esc(c.id)}">Edit</button>
                <button class="btn small" data-action="view" data-view="people" data-center="${esc(c.id)}">Roster</button>
                <button class="btn small" data-action="edit-order" data-id="" data-center="${esc(c.id)}">Add WO</button>
                <button class="btn small danger" data-action="delete-center" data-id="${esc(c.id)}">Delete</button>
              </div>
            </article>`;
          })
          .join("")}
      </div>`;
  }

  function renderPeople() {
    const week = summary().weeks[0];
    const rows = state.data.people
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((p) => {
        if (state.centerFilter === "__none") return !p.workCenterId;
        if (state.centerFilter && String(p.workCenterId) !== state.centerFilter) return false;
        return true;
      })
      .filter((p) => !state.query || p.name.toLowerCase().includes(state.query.toLowerCase()));

    return `<div class="page-head">
        <div>
          <h2>Employees</h2>
          <p class="lede">Keep the roster here. Assign a work center from the dropdown, then open a file for PTO and sick time.</p>
        </div>
        <div class="filters">
          <input class="search" data-bind="query" placeholder="Search employees" value="${esc(state.query)}">
          <select class="field" data-bind="centerFilter">
            ${centerOptions(state.centerFilter, "All employees")}
            <option value="__none" ${state.centerFilter === "__none" ? "selected" : ""}>Unassigned</option>
          </select>
          <button class="btn primary" data-action="edit-person" data-id="">Add employee</button>
        </div>
      </div>
      ${
        rows.length
          ? `<section class="card table-wrap"><table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Work center</th>
                  <th class="num">Hours / week</th>
                  <th>This week</th>
                  <th>Time off</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((p) => {
                    const br = week ? Calc.personWeekBreakdown(p, state.data.absences, week) : null;
                    const next = Calc.upcomingAbsence(p, state.data.absences);
                    return `<tr>
                      <td>
                        <button class="linkish" data-action="open-employee" data-id="${esc(p.id)}"><strong>${esc(p.name)}</strong></button>
                        ${p.notes ? `<div class="tiny muted">${esc(p.notes)}</div>` : ""}
                      </td>
                      <td>
                        <select class="field compact" data-assign="center" data-id="${esc(p.id)}">
                          ${centerOptions(p.workCenterId, "Unassigned")}
                        </select>
                      </td>
                      <td class="num">${Calc.formatHours(p.hoursPerWeek)}h<div class="tiny muted">${Calc.formatHours(p.efficiency)}% · ${p.workDays || 5} days${p.worksWeekends ? " · weekends" : ""}</div></td>
                      <td>${
                        br
                          ? `${Calc.formatHours(br.available)}h avail.${
                              br.off ? `<div class="tiny"><span class="pill tight">−${Calc.formatHours(br.off)}h out</span></div>` : ""
                            }`
                          : "—"
                      }</td>
                      <td>${
                        next
                          ? `<span class="pill ${esc(next.type)}">${ABSENCE_LABEL[next.type] || next.type}</span>
                             <div class="tiny muted">${esc(next.startDate)}${next.endDate !== next.startDate ? ` – ${esc(next.endDate)}` : ""}</div>`
                          : `<span class="muted tiny">None upcoming</span>`
                      }</td>
                      <td class="row-actions">
                        <button class="btn small" data-action="open-employee" data-id="${esc(p.id)}">Open file</button>
                        <button class="btn small danger" data-action="delete-person" data-id="${esc(p.id)}">Remove</button>
                      </td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table></section>`
          : `<section class="empty"><h3>No employees yet</h3><p>Add people to the roster first, then assign each one to a work center.</p><button class="btn primary" data-action="edit-person" data-id="">Add employee</button></section>`
      }`;
  }

  function renderEmployee() {
    const person = personById(state.employeeId);
    if (!person) {
      return `<section class="empty"><h3>Employee not found</h3><button class="btn" data-action="view" data-view="people">Back to roster</button></section>`;
    }
    const s = summary();
    const absences = absencesFor(person.id);
    const today = Calc.formatISO(new Date());
    return `<div class="page-head">
        <div>
          <button class="linkish" data-action="view" data-view="people">← Employees</button>
          <h2>${esc(person.name)}</h2>
          <p class="lede">Hours, work center, and time off for this person. PTO and sick days reduce that week’s capacity going forward.</p>
        </div>
        <button class="btn primary" data-action="edit-absence" data-id="" data-person="${esc(person.id)}">Add time off</button>
      </div>
      <div class="grid-2">
        <section class="card">
          <h3>Employee file</h3>
          <form class="form-grid" data-form="employee-profile" data-id="${esc(person.id)}">
            ${formField("Name", "name", person.name, "required")}
            <label>Work center
              <select class="field" name="workCenterId">${centerOptions(person.workCenterId, "Unassigned")}</select>
            </label>
            ${formField("Hours per week", "hoursPerWeek", person.hoursPerWeek, 'type="number" min="0" step="0.5" required')}
            ${formField("Work days / week", "workDays", person.workDays || 5, 'type="number" min="1" max="7" step="1"')}
            ${formField("Efficiency %", "efficiency", person.efficiency, 'type="number" min="0" max="150" step="1"')}
            <label class="span-2 check">
              <input type="checkbox" name="worksWeekends" ${person.worksWeekends ? "checked" : ""}>
              <span>Works weekends <span class="tiny muted">Saturday and Sunday count as work days for time off. Set work days to 6 or 7 so a PTO day is the right length.</span></span>
            </label>
            <label class="span-2">Notes
              <textarea class="field" name="notes">${esc(person.notes || "")}</textarea>
            </label>
            <div class="span-2"><button class="btn primary" type="submit">Save file</button></div>
          </form>
        </section>
        <section class="card">
          <h3>Available hours ahead</h3>
          <p class="tiny muted">Roster hours minus PTO / sick, then × efficiency.</p>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Week</th><th class="num">Out</th><th class="num">Available</th></tr></thead>
              <tbody>
                ${s.weeks
                  .map((w) => {
                    const br = Calc.personWeekBreakdown(person, state.data.absences, w);
                    return `<tr>
                      <td>${esc(w.label)}${w.isCurrent ? ` <span class="tiny muted">now</span>` : ""}</td>
                      <td class="num">${br.off ? `−${Calc.formatHours(br.off)}h` : "—"}</td>
                      <td class="num">${Calc.formatHours(br.available)}h</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <section class="card" style="margin-top:0.75rem">
        <h3>PTO & sick time</h3>
        ${
          absences.length
            ? `<div class="table-wrap"><table>
                <thead><tr><th>Type</th><th>Dates</th><th class="num">Hours</th><th>Notes</th><th></th></tr></thead>
                <tbody>
                  ${absences
                    .map((a) => {
                      const past = a.endDate && a.endDate < today;
                      const weekends = Calc.countsWeekends(person, a);
                      const hours =
                        a.hours === "" || a.hours == null
                          ? `${Calc.formatHours(Calc.hoursPerWorkDay(person) * Calc.weekdayCount(a.startDate, a.endDate, weekends))}h (days)`
                          : `${Calc.formatHours(a.hours)}h`;
                      return `<tr class="${past ? "muted" : ""}">
                        <td><span class="pill ${esc(a.type)}">${ABSENCE_LABEL[a.type] || a.type}</span>${weekends ? ` <span class="pill other">Weekends</span>` : ""}</td>
                        <td>${esc(a.startDate)}${a.endDate !== a.startDate ? ` – ${esc(a.endDate)}` : ""}</td>
                        <td class="num">${hours}</td>
                        <td>${esc(a.notes || "—")}</td>
                        <td class="row-actions">
                          <button class="btn small" data-action="edit-absence" data-id="${esc(a.id)}" data-person="${esc(person.id)}">Edit</button>
                          <button class="btn small danger" data-action="delete-absence" data-id="${esc(a.id)}">Delete</button>
                        </td>
                      </tr>`;
                    })
                    .join("")}
                </tbody>
              </table></div>`
            : `<p class="muted">No time off on file. Add PTO or sick days so those weeks drop off the planning board.</p>`
        }
      </section>`;
  }

  function matchesOrder(wo) {
    if (state.centerFilter && String(wo.workCenterId) !== state.centerFilter) return false;
    if (state.statusFilter === "open" && !Calc.isOpen(wo)) return false;
    if (state.statusFilter === "overdue" && !Calc.isOverdue(wo)) return false;
    if (state.statusFilter && state.statusFilter !== "open" && state.statusFilter !== "overdue" && wo.status !== state.statusFilter) {
      return false;
    }
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return [wo.number, wo.title, wo.notes, centerName(wo.workCenterId)].join(" ").toLowerCase().includes(q);
  }

  function renderOrders() {
    const rows = state.data.workOrders.filter(matchesOrder).slice().sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return String(a.dueDate).localeCompare(String(b.dueDate));
    });

    return `<div class="page-head">
        <div>
          <h2>Work orders</h2>
          <p class="lede">Projected due date + hours to complete. Complete orders drop out of load.</p>
        </div>
        <div class="filters">
          <input class="search" data-bind="query" placeholder="Search orders" value="${esc(state.query)}">
          <select class="field" data-bind="centerFilter">${centerOptions(state.centerFilter, "All centers")}</select>
          <select class="field" data-bind="statusFilter">
            <option value="">All statuses</option>
            <option value="open" ${state.statusFilter === "open" ? "selected" : ""}>Open</option>
            <option value="overdue" ${state.statusFilter === "overdue" ? "selected" : ""}>Overdue</option>
            <option value="queued" ${state.statusFilter === "queued" ? "selected" : ""}>Queued</option>
            <option value="in-progress" ${state.statusFilter === "in-progress" ? "selected" : ""}>In progress</option>
            <option value="on-hold" ${state.statusFilter === "on-hold" ? "selected" : ""}>On hold</option>
            <option value="complete" ${state.statusFilter === "complete" ? "selected" : ""}>Complete</option>
          </select>
          <button class="btn primary" data-action="edit-order" data-id="">New work order</button>
        </div>
      </div>
      ${
        rows.length
          ? `<section class="card table-wrap"><table>
              <thead>
                <tr>
                  <th>WO</th>
                  <th>Work center</th>
                  <th>Due</th>
                  <th class="num">Est.</th>
                  <th class="num">Remaining</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map((wo) => {
                    const overdue = Calc.isOverdue(wo);
                    return `<tr>
                      <td>
                        <strong>${esc(wo.number)}</strong>
                        <div class="tiny muted">${esc(wo.title || "—")}</div>
                      </td>
                      <td>${esc(centerName(wo.workCenterId))}</td>
                      <td>${esc(wo.dueDate || "—")}${overdue ? ` <span class="pill over">Overdue</span>` : ""}</td>
                      <td class="num">${Calc.formatHours(wo.hours)}h</td>
                      <td class="num">${Calc.isOpen(wo) ? `${Calc.formatHours(Calc.remainingHours(wo))}h` : "—"}</td>
                      <td><span class="pill ${esc(wo.status)}">${STATUS_LABEL[wo.status] || wo.status}</span> <span class="pill ${esc(wo.priority)}">${PRIORITY_LABEL[wo.priority]}</span></td>
                      <td class="row-actions">
                        <button class="btn small" data-action="edit-order" data-id="${esc(wo.id)}">Edit</button>
                        ${
                          Calc.isOpen(wo)
                            ? `<button class="btn small" data-action="complete-order" data-id="${esc(wo.id)}">Done</button>`
                            : ""
                        }
                        <button class="btn small danger" data-action="delete-order" data-id="${esc(wo.id)}">Delete</button>
                      </td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table></section>`
          : `<section class="empty"><h3>No work orders match</h3><p>Add a job with a due date and the hours it will take.</p><button class="btn primary" data-action="edit-order" data-id="">New work order</button></section>`
      }`;
  }

  function renderPlanning() {
    const s = summary();
    const centers = state.centerFilter ? s.centers.filter((c) => c.id === state.centerFilter) : s.centers;
    if (!s.centers.length) {
      return `<section class="empty"><h3>Nothing to plan yet</h3><p>Add a work center first.</p></section>`;
    }
    return `<div class="page-head">
        <div>
          <h2>Planning board</h2>
          <p class="lede">${state.settings.planningWeeks} weeks · ${state.settings.loadMode === "spread" ? "Hours spread from now through the due week" : "Hours booked in the due week"}. Capacity each week is after PTO and sick time.</p>
        </div>
        <div class="filters">
          <select class="field" data-bind="centerFilter">${centerOptions(state.centerFilter, "All centers")}</select>
          <button class="btn" data-action="export-plan">Export CSV</button>
        </div>
      </div>
      ${s.totals.overdueHours ? `<div class="banner warn"><span>${Calc.formatHours(s.totals.overdueHours)}h overdue is not in the week grid — finish or redate those jobs first.</span></div>` : ""}
      <section class="card week-grid">
        <table>
          <thead>
            <tr>
              <th>Work center</th>
              <th class="num">Roster / wk</th>
              ${s.weeks
                .map(
                  (w) =>
                    `<th class="week-head ${w.isCurrent ? "current" : ""}">${esc(w.label)}${w.isCurrent ? "<div class='tiny'>This week</div>" : ""}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${centers
              .map((c) => {
                return `<tr>
                  <td><span class="center-dot" style="background:${esc(c.color)}"></span><strong>${esc(c.name)}</strong><div class="tiny muted">${c.headcount} people · ${c.openCount} open</div></td>
                  <td class="num">${Calc.formatHours(c.weeklyCapacity)}h</td>
                  ${s.weeks
                    .map((w) => {
                      const load = c.loadByWeek[w.key] || 0;
                      const cap = c.capacityByWeek[w.key] || 0;
                      const off = c.timeOffByWeek[w.key] || 0;
                      const util = Calc.utilization(load, cap);
                      const level = Calc.utilLevel(util);
                      return `<td class="week-cell ${level}">
                        <span class="pct">${esc(Calc.formatUtil(util))}</span>
                        <span class="hrs">${Calc.formatHours(load)} / ${Calc.formatHours(cap)}h</span>
                        ${off ? `<span class="hrs">−${Calc.formatHours(off)}h out</span>` : ""}
                      </td>`;
                    })
                    .join("")}
                </tr>`;
              })
              .join("")}
            ${
              !state.centerFilter
                ? `<tr>
                    <td><strong>All centers</strong></td>
                    <td class="num">${Calc.formatHours(s.totals.weeklyCapacity)}h</td>
                    ${s.weeks
                      .map((w) => {
                        const load = s.totals.loadByWeek[w.key] || 0;
                        const cap = s.totals.capacityByWeek[w.key] || 0;
                        const util = Calc.utilization(load, cap);
                        const level = Calc.utilLevel(util);
                        return `<td class="week-cell ${level}">
                          <span class="pct">${esc(Calc.formatUtil(util))}</span>
                          <span class="hrs">${Calc.formatHours(load)} / ${Calc.formatHours(cap)}h</span>
                        </td>`;
                      })
                      .join("")}
                  </tr>`
                : ""
            }
          </tbody>
        </table>
      </section>
      ${renderWeekOrders(s, centers)}`;
  }

  function renderWeekOrders(s, centers) {
    const ids = new Set(centers.map((c) => c.id));
    const open = state.data.workOrders
      .filter((wo) => Calc.isOpen(wo) && (!ids.size || ids.has(String(wo.workCenterId))))
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    if (!open.length) return "";
    return `<section class="card" style="margin-top:0.75rem">
      <h3>Open work in this view</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>WO</th><th>Center</th><th>Due week</th><th class="num">Hours</th><th>Fits alone?</th></tr></thead>
        <tbody>
          ${open
            .map((wo) => {
              const center = s.centers.find((c) => c.id === String(wo.workCenterId));
              const cap = center ? center.weeklyCapacity : 0;
              const dueWeek = wo.dueDate ? Calc.weekLabel(Calc.startOfWeek(wo.dueDate, state.settings.weekStartsOn), Calc.addDays(Calc.startOfWeek(wo.dueDate, state.settings.weekStartsOn), 6)) : "Unscheduled";
              const fits = Calc.fitsAlone(wo, cap, state.settings.weekStartsOn, new Date(), center && center.capacityByWeek);
              const overdue = Calc.isOverdue(wo);
              return `<tr>
                <td><button class="linkish" data-action="edit-order" data-id="${esc(wo.id)}">${esc(wo.number)}</button><div class="tiny muted">${esc(wo.title || "")}</div></td>
                <td>${esc(centerName(wo.workCenterId))}</td>
                <td>${esc(dueWeek)}${overdue ? ` <span class="pill over">Overdue</span>` : ""}</td>
                <td class="num">${Calc.formatHours(Calc.remainingHours(wo))}h</td>
                <td>${fits ? `<span class="pill healthy">Yes</span>` : `<span class="pill over">No</span>`}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table></div>
    </section>`;
  }

  function renderSettings() {
    const s = state.settings;
    return `<div class="page-head">
        <div>
          <h2>Settings</h2>
          <p class="lede">How capacity is calculated, and where the data lives.</p>
        </div>
      </div>
      <div class="settings-grid">
        <section class="card">
          <h3>Planning</h3>
          <form class="form-grid" data-form="settings-plan">
            <label>Site / shop name
              <input class="field" name="siteName" value="${esc(s.siteName)}">
            </label>
            <label>Planning horizon
              <select class="field" name="planningWeeks">
                ${[4, 6, 8, 12, 16]
                  .map((n) => `<option value="${n}" ${Number(s.planningWeeks) === n ? "selected" : ""}>${n} weeks</option>`)
                  .join("")}
              </select>
            </label>
            <label>Week starts
              <select class="field" name="weekStartsOn">
                <option value="1" ${s.weekStartsOn === 1 ? "selected" : ""}>Monday</option>
                <option value="0" ${s.weekStartsOn === 0 ? "selected" : ""}>Sunday</option>
              </select>
            </label>
            <label>Load method
              <select class="field" name="loadMode">
                <option value="due-week" ${s.loadMode === "due-week" ? "selected" : ""}>All hours in the due week</option>
                <option value="spread" ${s.loadMode === "spread" ? "selected" : ""}>Spread hours through the due date</option>
              </select>
            </label>
            <div class="span-2 help">
              <strong>Due week</strong> is how most shops ask “can we ship Friday?”
              <strong>Spread</strong> assumes the crew works the job steadily from this week until it is due.
            </div>
            <div class="span-2"><button class="btn primary" type="submit">Save planning</button></div>
          </form>
        </section>
        <section class="card">
          <h3>Shared data file</h3>
          <p class="help">The app cannot run as a live page inside SharePoint. Put <code>capacity-data.json</code> in the same SharePoint folder, sync that folder with OneDrive, then connect the file here. Everyone uses the HTML. The JSON file is the database. It stays in your tenant.</p>
          <div class="row-actions">
            <button class="btn primary" type="button" data-action="file-create">Create team file</button>
            <button class="btn" type="button" data-action="file-open">Open existing team file</button>
          </div>
          <p class="tiny muted" style="margin-top:0.6rem">${Files.connected() ? "Connected to capacity-data.json · " + esc(state.syncState) : Files.supported() ? "Not connected yet" : "Open with Start-CapacityTracker.bat in Edge or Chrome"}</p>
        </section>
        <section class="card">
          <h3>Live team board (outside tenant)</h3>
          <p class="help">Everyone who opens this HTML file shares one board. New work orders show up on other computers in a few seconds. Keep the file on SharePoint and open the downloaded copy.</p>
          <form class="form-grid" data-form="settings-team">
            <label class="span-2">JSONBin master key
              <input class="field" name="teamApiKey" type="password" autocomplete="off" value="${esc(s.teamApiKey)}" placeholder="Paste key from jsonbin.io">
            </label>
            <label class="span-2">Board ID
              <input class="field" name="teamBinId" value="${esc(s.teamBinId)}" placeholder="Created for you when you start a board">
            </label>
            <div class="span-2 help">
              1. Open jsonbin.io and create a free account.<br>
              2. Copy API Keys → Master Key.<br>
              3. Click <strong>Start shared board</strong>.<br>
              4. Click <strong>Download team HTML</strong> and replace the file on SharePoint so everyone gets the same board.
            </div>
            <div class="span-2 row-actions">
              <button class="btn primary" type="submit">Save &amp; connect</button>
              <button class="btn" type="button" data-action="team-create">Start shared board</button>
              <button class="btn" type="button" data-action="team-download">Download team HTML</button>
            </div>
            <div class="span-2 tiny muted">${s.teamBinId ? `Board ${esc(s.teamBinId)} · ${esc(state.syncState)}${state.syncError ? " · " + esc(state.syncError) : ""}` : "Not connected"}</div>
          </form>
        </section>
        <section class="card">
          <h3>Data storage</h3>
          <form class="form-grid" data-form="settings-storage">
            <label class="span-2">Store data in
              <select class="field" name="storage">
                <option value="file" ${s.storage === "file" ? "selected" : ""}>Shared data file (this folder)</option>
                <option value="team" ${s.storage === "team" ? "selected" : ""}>JSONBin (leaves tenant)</option>
                <option value="local" ${s.storage === "local" ? "selected" : ""}>This browser only</option>
                <option value="sharepoint" ${s.storage === "sharepoint" ? "selected" : ""}>SharePoint lists</option>
              </select>
            </label>
            <label class="span-2">SharePoint site URL
              <input class="field" name="sharepointSiteUrl" placeholder="https://fuseintegration.sharepoint.us/sites/Production" value="${esc(s.sharepointSiteUrl)}">
            </label>
            <label>Application (client) ID
              <input class="field" name="clientId" value="${esc(s.clientId)}" placeholder="From IT app registration">
            </label>
            <label>Directory (tenant) ID
              <input class="field" name="tenantId" value="${esc(s.tenantId)}" placeholder="From IT, or leave blank">
            </label>
            <label>Work centers list
              <input class="field" name="listWorkCenters" value="${esc(s.listWorkCenters)}">
            </label>
            <label>Employees list
              <input class="field" name="listPeople" value="${esc(s.listPeople)}">
            </label>
            <label>Work orders list
              <input class="field" name="listWorkOrders" value="${esc(s.listWorkOrders)}">
            </label>
            <label class="span-2">Time off list
              <input class="field" name="listAbsences" value="${esc(s.listAbsences)}">
            </label>
            <div class="span-2 help">
              Lists stay in your tenant. This HTML page is only the screen. Create the four CT lists on Production, get a client ID from IT (see sharepoint/IT-APP-REGISTRATION.txt), then Sign in.
              Open the app with Start-CapacityTracker.bat so sign-in works (do not rely on double-click after you turn on SharePoint).
            </div>
            <div class="span-2 row-actions">
              <button class="btn primary" type="submit">Save storage</button>
              <button class="btn" type="button" data-action="sp-test">Test connection</button>
              <button class="btn" type="button" data-action="sp-push">Push browser data to lists</button>
            </div>
          </form>
        </section>
        <section class="card">
          <h3>Backup & sample</h3>
          <p class="help">Export a JSON backup before switching storage. Import replaces the current dataset.</p>
          <div class="row-actions">
            <button class="btn" data-action="export-json">Export JSON</button>
            <button class="btn" data-action="export-orders">Export work orders CSV</button>
            <button class="btn" data-action="import">Import JSON</button>
            <button class="btn" data-action="demo">Load sample shop</button>
            <button class="btn danger" data-action="reset">Clear all data</button>
          </div>
        </section>
        <section class="card">
          <h3>How the math works</h3>
          <p class="help">
            Roster employees, then assign each one to a work center.<br>
            A person’s available hours in a week = (hours per week − PTO/sick hours) × efficiency.<br>
            Weekends are skipped unless the employee works weekends or the time-off row includes Saturday and Sunday.<br>
            Load = remaining hours on work orders that are not complete. On-hold still reserves time.
          </p>
        </section>
      </div>`;
  }

  function formField(label, name, value, extra) {
    return `<label>${label}<input class="field" name="${name}" value="${esc(value || "")}" ${extra || ""}></label>`;
  }

  function modalShell(title, body, footer) {
    return `<form class="modal-card" data-form="modal" method="dialog">
      <h3>${esc(title)}</h3>
      ${body}
      <div class="modal-actions">${footer}</div>
    </form>`;
  }

  function centerForm(id) {
    const existing = id ? centerById(id) : null;
    const c = existing || { name: "", notes: "", color: Store.nextColor(state.data.workCenters) };
    return modalShell(existing ? "Edit work center" : "New work center", `
      <div class="form-grid">
        ${formField("Name", "name", c.name, "required")}
        <label>Color
          <input class="field" type="color" name="color" value="${esc(c.color || "#1f6f6a")}">
        </label>
        <label class="span-2">Notes
          <textarea class="field" name="notes">${esc(c.notes || "")}</textarea>
        </label>
      </div>
    `, `
      <span></span>
      <span class="row-actions">
        <button class="btn" type="button" data-action="close-modal">Cancel</button>
        <button class="btn primary" type="submit">Save</button>
      </span>
    `);
  }

  function personForm(id, centerId) {
    const existing = id ? state.data.people.find((p) => p.id === id) : null;
    const p = existing || {
      name: "",
      workCenterId: centerId || "",
      hoursPerWeek: 40,
      workDays: 5,
      efficiency: 100,
      notes: ""
    };
    return modalShell(existing ? "Edit employee" : "Add employee", `
      <div class="form-grid">
        ${formField("Name", "name", p.name, "required")}
        <label>Work center
          <select class="field" name="workCenterId">${centerOptions(p.workCenterId, "Unassigned")}</select>
        </label>
        ${formField("Hours per week", "hoursPerWeek", p.hoursPerWeek, 'type="number" min="0" step="0.5" required')}
        ${formField("Work days / week", "workDays", p.workDays || 5, 'type="number" min="1" max="7" step="1"')}
        ${formField("Efficiency %", "efficiency", p.efficiency, 'type="number" min="0" max="150" step="1"')}
        <label class="span-2 check">
          <input type="checkbox" name="worksWeekends" ${p.worksWeekends ? "checked" : ""}>
          <span>Works weekends</span>
        </label>
        <label class="span-2">Notes
          <textarea class="field" name="notes">${esc(p.notes || "")}</textarea>
        </label>
      </div>
    `, `
      <span></span>
      <span class="row-actions">
        <button class="btn" type="button" data-action="close-modal">Cancel</button>
        <button class="btn primary" type="submit">Save</button>
      </span>
    `);
  }

  function absenceForm(id, personId) {
    const existing = id ? (state.data.absences || []).find((a) => a.id === id) : null;
    const person = personById((existing && existing.personId) || personId);
    const a = existing || {
      personId,
      type: "pto",
      startDate: Calc.formatISO(new Date()),
      endDate: Calc.formatISO(new Date()),
      hours: "",
      includeWeekends: Boolean(person && person.worksWeekends),
      notes: ""
    };
    const includeWeekends = existing ? Boolean(a.includeWeekends) : Boolean(person && person.worksWeekends);
    return modalShell(existing ? "Edit time off" : `Time off${person ? ` · ${person.name}` : ""}`, `
      <div class="form-grid">
        <label>Type
          <select class="field" name="type">
            ${Object.entries(ABSENCE_LABEL)
              .map(([k, v]) => `<option value="${k}" ${a.type === k ? "selected" : ""}>${v}</option>`)
              .join("")}
          </select>
        </label>
        <label class="span-2 tiny muted" style="font-weight:400">Leave hours blank to use full work days (${person ? Calc.formatHours(Calc.hoursPerWorkDay(person)) + "h/day" : "hours ÷ work days"}). Enter a number for a half day or partial leave.</label>
        ${formField("Start", "startDate", a.startDate, 'type="date" required')}
        ${formField("End", "endDate", a.endDate || a.startDate, 'type="date" required')}
        ${formField("Hours (optional)", "hours", a.hours, 'type="number" min="0" step="0.5" placeholder="Auto from days"')}
        <label class="span-2 check">
          <input type="checkbox" name="includeWeekends" ${includeWeekends ? "checked" : ""}>
          <span>Include Saturday and Sunday</span>
        </label>
        <label class="span-2">Notes
          <textarea class="field" name="notes">${esc(a.notes || "")}</textarea>
        </label>
      </div>
    `, `
      <span></span>
      <span class="row-actions">
        <button class="btn" type="button" data-action="close-modal">Cancel</button>
        <button class="btn primary" type="submit">Save</button>
      </span>
    `);
  }

  function orderForm(id, centerId) {
    const existing = id ? state.data.workOrders.find((o) => o.id === id) : null;
    const o = existing || {
      number: Store.nextWorkOrderNumber(state.data.workOrders),
      title: "",
      workCenterId: centerId || state.data.workCenters[0]?.id || "",
      hours: "",
      remainingHours: "",
      dueDate: Calc.formatISO(Calc.addDays(new Date(), 7)),
      status: "queued",
      priority: "medium",
      notes: ""
    };
    return modalShell(existing ? `Edit ${o.number}` : "New work order", `
      <div class="form-grid">
        ${formField("Work order #", "number", o.number, "required")}
        ${formField("Title / customer", "title", o.title)}
        <label>Work center
          <select class="field" name="workCenterId" required>${centerOptions(o.workCenterId, "Select a center")}</select>
        </label>
        ${formField("Projected due date", "dueDate", o.dueDate, 'type="date" required')}
        ${formField("Hours to complete", "hours", o.hours, 'type="number" min="0" step="0.5" required')}
        ${formField("Hours remaining", "remainingHours", o.remainingHours === "" ? o.hours : o.remainingHours, 'type="number" min="0" step="0.5"')}
        <label>Status
          <select class="field" name="status">
            ${Object.entries(STATUS_LABEL)
              .map(([k, v]) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${v}</option>`)
              .join("")}
          </select>
        </label>
        <label>Priority
          <select class="field" name="priority">
            ${Object.entries(PRIORITY_LABEL)
              .map(([k, v]) => `<option value="${k}" ${o.priority === k ? "selected" : ""}>${v}</option>`)
              .join("")}
          </select>
        </label>
        <label class="span-2">Notes
          <textarea class="field" name="notes">${esc(o.notes || "")}</textarea>
        </label>
      </div>
    `, `
      <span></span>
      <span class="row-actions">
        <button class="btn" type="button" data-action="close-modal">Cancel</button>
        <button class="btn primary" type="submit">Save</button>
      </span>
    `);
  }

  function confirmForm(message) {
    return modalShell("Please confirm", `<p>${esc(message)}</p>`, `
      <span></span>
      <span class="row-actions">
        <button class="btn" type="button" data-action="close-modal">Cancel</button>
        <button class="btn danger" type="submit">Confirm</button>
      </span>
    `);
  }

  function openModal(modal) {
    state.modal = modal;
    const el = $("#modal");
    if (!el) return;
    if (modal.kind === "center") el.innerHTML = centerForm(modal.id);
    if (modal.kind === "person") el.innerHTML = personForm(modal.id, modal.centerId);
    if (modal.kind === "absence") el.innerHTML = absenceForm(modal.id, modal.personId);
    if (modal.kind === "order") el.innerHTML = orderForm(modal.id, modal.centerId);
    if (modal.kind === "confirm") el.innerHTML = confirmForm(modal.message);
    if (typeof el.showModal === "function" && !el.open) el.showModal();
  }

  function closeModal() {
    state.modal = null;
    const el = $("#modal");
    if (el && el.open) el.close();
    el && (el.innerHTML = "");
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function withBusy(fn) {
    state.busy = true;
    renderView();
    try {
      await fn();
    } catch (err) {
      console.error(err);
      state.error = err.message || String(err);
      toast(state.error, "error");
    } finally {
      state.busy = false;
      renderShell();
    }
  }

  function persistLocal() {
    state.data.updatedAt = Date.now();
    Store.LocalStore.save(state.data);
    if (fileEnabled()) queueFilePush();
    if (teamEnabled()) queueTeamPush();
  }

  function persistSettings() {
    Store.LocalStore.saveSettings(state.settings);
    connectRepo();
    startTeamPoll();
    startFilePoll();
  }

  function queueFilePush() {
    if (!fileEnabled()) return;
    window.clearTimeout(state.filePushTimer);
    state.filePushTimer = window.setTimeout(function () {
      Files.write(state.data)
        .then(function () {
          state.syncState = "live";
          state.syncError = "";
        })
        .catch(function (err) {
          state.syncState = "error";
          state.syncError = err.message || String(err);
          toast(state.syncError, "error");
        });
    }, 300);
  }

  function startFilePoll() {
    window.clearInterval(state.filePoll);
    if (!fileEnabled()) return;
    state.filePoll = window.setInterval(function () {
      if (state.modal || state.busy) return;
      Files.changedOnDisk()
        .then(function (changed) {
          if (!changed) return;
          return Files.read().then(function (remote) {
            if (state.modal || state.busy) return;
            state.data = remote;
            Store.LocalStore.save(state.data);
            state.syncState = "live";
            renderShell();
          });
        })
        .catch(function () {
          /* keep last good copy */
        });
    }, 2500);
  }

  async function connectTeamFile(create) {
    if (create) await Files.createNew();
    else await Files.pickExisting();
    state.settings.storage = "file";
    persistSettings();
    let data = Store.emptyData();
    try {
      data = await Files.read();
    } catch (err) {
      data = Store.emptyData();
    }
    if (!data.workCenters.length && !data.workOrders.length && state.data.workCenters.length) {
      data = state.data;
    }
    data.updatedAt = Date.now();
    state.data = data;
    await Files.write(state.data);
    Store.LocalStore.save(state.data);
    state.syncState = "live";
    startFilePoll();
    toast("Using the shared data file. Keep it in the OneDrive-synced SharePoint folder.");
  }

  function queueTeamPush() {
    if (!teamEnabled()) return;
    window.clearTimeout(state.pushTimer);
    state.pushTimer = window.setTimeout(function () {
      pushTeam().catch(function (err) {
        state.syncState = "error";
        state.syncError = err.message || String(err);
        toast(state.syncError, "error");
      });
    }, 400);
  }

  async function pushTeam() {
    if (!teamEnabled()) return;
    state.syncState = "saving";
    await Sync.push(state.settings.teamApiKey, state.settings.teamBinId, state.data);
    state.syncState = "live";
    state.syncError = "";
  }

  async function pullTeam() {
    if (!teamEnabled()) return null;
    const remote = Store.normalizeData(await Sync.pull(state.settings.teamApiKey, state.settings.teamBinId));
    state.syncState = "live";
    state.syncError = "";
    return remote;
  }

  function startTeamPoll() {
    window.clearInterval(state.pollTimer);
    if (!teamEnabled()) {
      state.syncState = "off";
      return;
    }
    state.pollTimer = window.setInterval(function () {
      if (state.modal || state.busy) return;
      pullTeam()
        .then(function (remote) {
          if (!remote) return;
          if ((remote.updatedAt || 0) > (state.data.updatedAt || 0)) {
            state.data = remote;
            Store.LocalStore.save(state.data);
            renderShell();
          }
        })
        .catch(function (err) {
          state.syncState = "error";
          state.syncError = err.message || String(err);
        });
    }, 3000);
  }

  async function startSharedBoard() {
    const key = state.settings.teamApiKey || ($("[name=teamApiKey]") && $("[name=teamApiKey]").value) || "";
    if (!key) throw new Error("Paste your JSONBin master key first.");
    state.settings.teamApiKey = key.trim();
    state.data.updatedAt = Date.now();
    const created = await Sync.create(state.settings.teamApiKey, state.data);
    state.settings.teamBinId = created.id;
    state.settings.storage = "team";
    persistSettings();
    Store.LocalStore.save(state.data);
    state.syncState = "live";
    toast("Shared board started. Download the team HTML and put it on SharePoint.");
  }

  function downloadTeamHtml() {
    if (!state.settings.teamApiKey || !state.settings.teamBinId) {
      throw new Error("Start a shared board first.");
    }
    const html = Sync.injectIntoHtml(document.documentElement.outerHTML, {
      apiKey: state.settings.teamApiKey,
      binId: state.settings.teamBinId
    });
    Store.download("CapacityTracker.html", "<!DOCTYPE html>\n" + html, "text/html;charset=utf-8");
    toast("Upload this file to SharePoint. Everyone who opens it joins the same board.");
  }

  function connectRepo() {
    if (state.settings.storage === "sharepoint") {
      state.repo = Auth.hasToken()
        ? new Graph.GraphStore(state.settings, Auth)
        : new SP.SharePointStore(state.settings);
    } else {
      state.repo = null;
    }
    startListPoll();
  }

  function snapshotData(data) {
    return JSON.stringify({
      workCenters: data.workCenters,
      people: data.people,
      workOrders: data.workOrders,
      absences: data.absences
    });
  }

  function startListPoll() {
    window.clearInterval(state.listPoll);
    if (state.settings.storage !== "sharepoint" || !Auth.hasToken() || !state.repo || !state.repo.load) return;
    state.listPoll = window.setInterval(function () {
      if (state.modal || state.busy || state.signIn) return;
      const before = snapshotData(state.data);
      state.repo
        .load()
        .then(function (remote) {
          if (state.modal || state.busy) return;
          if (snapshotData(remote) !== before) {
            state.data = remote;
            Store.LocalStore.save(state.data);
            renderShell();
          }
        })
        .catch(function () {
          /* keep last good copy */
        });
    }, 8000);
  }

  async function signInSharePoint() {
    if (!state.settings.sharepointSiteUrl) {
      state.settings.sharepointSiteUrl = "https://fuseintegration.sharepoint.us/sites/Production";
    }
    if (!state.settings.clientId) throw new Error("Paste the Application (client) ID in Settings first.");
    const challenge = await Auth.requestDeviceCode(state.settings);
    state.signIn = challenge;
    renderShell();
    try {
      await Auth.waitForToken(challenge);
      state.signIn = null;
      state.settings.storage = "sharepoint";
      persistSettings();
      connectRepo();
      state.data = await state.repo.load();
      Store.LocalStore.save(state.data);
      toast("Signed in. Using SharePoint lists on Production.");
    } finally {
      state.signIn = null;
    }
  }

  function signOutSharePoint() {
    Auth.signOut();
    connectRepo();
    toast("Signed out");
  }

  async function upsertList(list, item, saved) {
    const idx = list.findIndex((x) => String(x.id) === String(item.id));
    if (idx >= 0) list[idx] = saved;
    else list.push(saved);
  }

  async function saveCenter(fields) {
    const existing = state.modal.id ? centerById(state.modal.id) : null;
    let record = Store.normalizeCenter(
      Object.assign({}, existing || { id: Store.uid("wc") }, fields)
    );
    if (state.repo) record = await state.repo.saveCenter(record);
    upsertList(state.data.workCenters, existing || record, record);
    persistLocal();
    toast(existing ? "Work center updated" : "Work center created");
  }

  function checkboxOn(fields, name) {
    return fields[name] === "on" || fields[name] === "true" || fields[name] === true;
  }

  async function savePerson(fields, existingId) {
    const id = existingId || (state.modal && state.modal.id) || "";
    const existing = id ? state.data.people.find((p) => p.id === id) : null;
    if (Object.prototype.hasOwnProperty.call(fields, "name")) {
      fields.worksWeekends = checkboxOn(fields, "worksWeekends");
    }
    let record = Store.normalizePerson(
      Object.assign({}, existing || { id: Store.uid("p") }, fields)
    );
    if (state.repo) record = await state.repo.savePerson(record, state.data);
    upsertList(state.data.people, existing || record, record);
    persistLocal();
    if (!existing) {
      state.view = "employee";
      state.employeeId = record.id;
    }
    toast(existing ? "Employee updated" : "Employee added");
    return record;
  }

  async function saveAbsence(fields) {
    const existing = state.modal.id ? (state.data.absences || []).find((a) => a.id === state.modal.id) : null;
    if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) {
      throw new Error("End date cannot be before the start date.");
    }
    fields.includeWeekends = checkboxOn(fields, "includeWeekends");
    let record = Store.normalizeAbsence(
      Object.assign({}, existing || { id: Store.uid("abs") }, fields, {
        personId: (state.modal && state.modal.personId) || (existing && existing.personId) || ""
      })
    );
    if (!record.personId) throw new Error("Time off must belong to an employee.");
    if (!state.data.absences) state.data.absences = [];
    if (state.repo) record = await state.repo.saveAbsence(record, state.data);
    upsertList(state.data.absences, existing || record, record);
    persistLocal();
    toast(existing ? "Time off updated" : "Time off added");
  }

  async function saveOrder(fields) {
    const existing = state.modal.id ? state.data.workOrders.find((o) => o.id === state.modal.id) : null;
    if (fields.remainingHours === "" || fields.remainingHours == null) {
      fields.remainingHours = fields.hours;
    }
    if (fields.status === "complete") fields.remainingHours = 0;
    let record = Store.normalizeOrder(
      Object.assign({}, existing || { id: Store.uid("wo") }, fields)
    );
    if (state.repo) record = await state.repo.saveOrder(record, state.data);
    upsertList(state.data.workOrders, existing || record, record);
    persistLocal();
    toast(existing ? "Work order updated" : "Work order added");
  }

  async function removeCenter(id) {
    const people = state.data.people.filter((p) => String(p.workCenterId) === String(id)).length;
    const orders = state.data.workOrders.filter((o) => String(o.workCenterId) === String(id)).length;
    const ok = await ask(
      `Delete this work center? ${people} people and ${orders} work orders will be unassigned.`
    );
    if (!ok) return;
    if (state.repo) await state.repo.deleteCenter(id);
    state.data.workCenters = state.data.workCenters.filter((c) => String(c.id) !== String(id));
    state.data.people.forEach((p) => {
      if (String(p.workCenterId) === String(id)) p.workCenterId = "";
    });
    state.data.workOrders.forEach((o) => {
      if (String(o.workCenterId) === String(id)) o.workCenterId = "";
    });
    persistLocal();
    toast("Work center deleted");
  }

  async function removePerson(id) {
    const person = state.data.people.find((p) => p.id === id);
    const ok = await ask(`Remove ${person ? person.name : "this employee"} and their time-off records?`);
    if (!ok) return;
    const related = (state.data.absences || []).filter((a) => String(a.personId) === String(id));
    if (state.repo) {
      for (const absence of related) await state.repo.deleteAbsence(absence.id);
      await state.repo.deletePerson(id);
    }
    state.data.absences = (state.data.absences || []).filter((a) => String(a.personId) !== String(id));
    state.data.people = state.data.people.filter((p) => p.id !== id);
    if (state.employeeId === id) {
      state.employeeId = "";
      state.view = "people";
    }
    persistLocal();
    toast("Employee removed");
  }

  async function removeAbsence(id) {
    const absence = (state.data.absences || []).find((a) => a.id === id);
    const ok = await ask("Delete this time-off entry?");
    if (!ok) return;
    if (state.repo) await state.repo.deleteAbsence(id);
    state.data.absences = (state.data.absences || []).filter((a) => a.id !== id);
    persistLocal();
    toast("Time off removed");
    return absence;
  }

  async function assignCenter(personId, workCenterId) {
    const existing = personById(personId);
    if (!existing) return;
    await savePerson({ workCenterId }, personId);
  }

  async function removeOrder(id) {
    const wo = state.data.workOrders.find((o) => o.id === id);
    const ok = await ask(`Delete ${wo ? wo.number : "this work order"}?`);
    if (!ok) return;
    if (state.repo) await state.repo.deleteOrder(id);
    state.data.workOrders = state.data.workOrders.filter((o) => o.id !== id);
    persistLocal();
    toast("Work order deleted");
  }

  function ask(message) {
    return new Promise((resolve) => {
      state.modal = { kind: "confirm", message, resolve };
      openModal(state.modal);
    });
  }

  async function completeOrder(id) {
    const wo = state.data.workOrders.find((o) => o.id === id);
    if (!wo) return;
    wo.status = "complete";
    wo.remainingHours = 0;
    if (state.repo) await state.repo.saveOrder(wo, state.data);
    persistLocal();
    toast(`${wo.number} marked complete`);
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      data: state.data
    };
    Store.download(`capacity-${Store.stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportOrdersCsv() {
    const rows = [
      ["Number", "Title", "WorkCenter", "Hours", "RemainingHours", "DueDate", "Status", "Priority", "Notes"]
    ];
    for (const wo of state.data.workOrders) {
      rows.push([
        wo.number,
        wo.title,
        centerName(wo.workCenterId),
        wo.hours,
        wo.remainingHours,
        wo.dueDate,
        wo.status,
        wo.priority,
        wo.notes
      ]);
    }
    Store.download(`work-orders-${Store.stamp()}.csv`, Store.toCsv(rows), "text/csv");
  }

  function exportPlanCsv() {
    const s = summary();
    const header = ["Work center", "Weekly capacity"].concat(s.weeks.map((w) => w.label));
    const rows = [header];
    for (const c of s.centers) {
      rows.push(
        [c.name, c.weeklyCapacity].concat(s.weeks.map((w) => Math.round((c.loadByWeek[w.key] || 0) * 10) / 10))
      );
    }
    Store.download(`planning-${Store.stamp()}.csv`, Store.toCsv(rows), "text/csv");
  }

  function importJsonFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const incoming = parsed.data || parsed;
        const next = Store.normalizeData(incoming);
        const ok = await ask("Replace the current work centers, people, and work orders with this file?");
        if (!ok) return;
        await withBusy(async () => {
          if (state.repo) {
            state.data = await state.repo.replaceAll(next);
          } else {
            state.data = next;
            persistLocal();
          }
          if (parsed.settings) {
            state.settings = Store.normalizeSettings(Object.assign({}, state.settings, parsed.settings, { storage: state.settings.storage }));
            persistSettings();
          }
          toast("Import complete");
        });
      } catch (err) {
        toast(err.message || "Could not read that file", "error");
      }
    });
    input.click();
  }

  async function loadDemo() {
    const ok = await ask("Replace current data with a sample fabrication shop?");
    if (!ok) return;
    const demo = Store.demoData();
    await withBusy(async () => {
      if (state.repo) state.data = await state.repo.replaceAll(demo);
      else {
        state.data = demo;
        persistLocal();
      }
      toast("Sample shop loaded");
    });
  }

  async function resetAll() {
    const ok = await ask("Clear every work center, person, and work order?");
    if (!ok) return;
    const empty = Store.emptyData();
    await withBusy(async () => {
      if (state.repo) state.data = await state.repo.replaceAll(empty);
      else {
        state.data = empty;
        persistLocal();
      }
      toast("Data cleared");
    });
  }

  async function testSharePoint() {
    const repo = new SP.SharePointStore(state.settings);
    await repo.test();
    toast("SharePoint lists are reachable");
  }

  async function pushToSharePoint() {
    const ok = await ask("Overwrite the SharePoint lists with the data currently in this browser?");
    if (!ok) return;
    const repo = new SP.SharePointStore(state.settings);
    await repo.test();
    state.data = await repo.replaceAll(state.data);
    state.settings.storage = "sharepoint";
    persistSettings();
    toast("Browser data pushed to SharePoint lists");
  }

  function bindFilters(target) {
    const bind = target.getAttribute("data-bind");
    if (bind === "query") state.query = target.value;
    if (bind === "centerFilter") state.centerFilter = target.value;
    if (bind === "statusFilter") state.statusFilter = target.value;
    renderView();
  }

  async function onAction(btn) {
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id") || "";
    const centerId = btn.getAttribute("data-center") || "";
    if (action === "view") {
      state.view = btn.getAttribute("data-view");
      if (centerId) state.centerFilter = centerId;
      if (state.view !== "people" && state.centerFilter === "__none") state.centerFilter = "";
      if (state.view !== "employee") state.employeeId = "";
      renderShell();
      return;
    }
    if (action === "open-employee") {
      state.view = "employee";
      state.employeeId = id;
      renderShell();
      return;
    }
    if (action === "quick-add") {
      if (!state.data.workCenters.length) {
        toast("Create a work center first", "error");
        state.view = "centers";
        renderShell();
        openModal({ kind: "center", id: "" });
        return;
      }
      state.view = "orders";
      renderShell();
      openModal({ kind: "order", id: "" });
      return;
    }
    if (action === "edit-center") return openModal({ kind: "center", id });
    if (action === "edit-person") return openModal({ kind: "person", id, centerId });
    if (action === "edit-absence") {
      return openModal({
        kind: "absence",
        id,
        personId: btn.getAttribute("data-person") || state.employeeId
      });
    }
    if (action === "edit-order") return openModal({ kind: "order", id, centerId });
    if (action === "close-modal") {
      if (state.modal && state.modal.resolve) state.modal.resolve(false);
      return closeModal();
    }
    if (action === "export-json") return exportJson();
    if (action === "export-orders") return exportOrdersCsv();
    if (action === "export-plan") return exportPlanCsv();
    if (action === "import") return importJsonFile();
    if (action === "demo") return loadDemo();
    if (action === "reset") return resetAll();
    if (action === "file-create") return withBusy(function () { return connectTeamFile(true); });
    if (action === "file-open") return withBusy(function () { return connectTeamFile(false); });
    if (action === "team-create") return withBusy(startSharedBoard);
    if (action === "team-download") {
      try {
        downloadTeamHtml();
      } catch (err) {
        toast(err.message || String(err), "error");
      }
      return;
    }
    if (action === "sp-signin") return withBusy(signInSharePoint);
    if (action === "sp-signout") {
      signOutSharePoint();
      renderShell();
      return;
    }
    if (action === "sp-test") return withBusy(testSharePoint);
    if (action === "sp-push") return withBusy(pushToSharePoint);
    if (action === "delete-center") return withBusy(() => removeCenter(id));
    if (action === "delete-person") return withBusy(() => removePerson(id));
    if (action === "delete-absence") return withBusy(() => removeAbsence(id));
    if (action === "delete-order") return withBusy(() => removeOrder(id));
    if (action === "complete-order") return withBusy(() => completeOrder(id));
  }

  async function onSubmit(form) {
    const kind = form.getAttribute("data-form");
    const fields = formData(form);
    if (kind === "settings-plan") {
      Object.assign(state.settings, {
        siteName: fields.siteName,
        planningWeeks: Number(fields.planningWeeks),
        weekStartsOn: Number(fields.weekStartsOn),
        loadMode: fields.loadMode
      });
      persistSettings();
      toast("Planning settings saved");
      renderShell();
      return;
    }
    if (kind === "settings-team") {
      Object.assign(state.settings, {
        teamApiKey: String(fields.teamApiKey || "").trim(),
        teamBinId: String(fields.teamBinId || "").trim(),
        storage: fields.teamBinId && fields.teamApiKey ? "team" : state.settings.storage
      });
      persistSettings();
      await withBusy(async () => {
        if (!teamEnabled()) throw new Error("Need both the master key and a board ID.");
        const remote = await pullTeam();
        if (remote && (remote.workCenters.length || remote.people.length || remote.workOrders.length)) {
          state.data = remote;
        } else {
          state.data.updatedAt = Date.now();
          await pushTeam();
        }
        Store.LocalStore.save(state.data);
        toast("Connected to the live team board");
      });
      return;
    }
    if (kind === "settings-storage") {
      Object.assign(state.settings, {
        storage: fields.storage,
        sharepointSiteUrl: fields.sharepointSiteUrl,
        clientId: String(fields.clientId || "").trim(),
        tenantId: String(fields.tenantId || "").trim(),
        listWorkCenters: fields.listWorkCenters,
        listPeople: fields.listPeople,
        listWorkOrders: fields.listWorkOrders,
        listAbsences: fields.listAbsences
      });
      persistSettings();
      if (state.settings.storage === "sharepoint") {
        await withBusy(async () => {
          await state.repo.test();
          state.data = await state.repo.load();
          toast("Connected to SharePoint lists");
        });
      } else {
        state.data = Store.LocalStore.load();
        toast("Using this browser’s saved data");
        renderShell();
      }
      return;
    }
    if (kind === "employee-profile") {
      await withBusy(() => savePerson(fields, form.getAttribute("data-id")));
      return;
    }
    if (kind === "modal") {
      const modal = state.modal;
      if (!modal) return;
      if (modal.kind === "confirm") {
        const resolve = modal.resolve;
        closeModal();
        if (resolve) resolve(true);
        return;
      }
      await withBusy(async () => {
        if (modal.kind === "center") await saveCenter(fields);
        if (modal.kind === "person") await savePerson(fields);
        if (modal.kind === "absence") await saveAbsence(fields);
        if (modal.kind === "order") await saveOrder(fields);
        closeModal();
      });
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn || !document.getElementById("app").contains(btn)) return;
      event.preventDefault();
      onAction(btn);
    });
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-form]");
      if (!form) return;
      event.preventDefault();
      onSubmit(form);
    });
    document.addEventListener("input", (event) => {
      if (event.target.matches("[data-bind]")) bindFilters(event.target);
    });
    document.addEventListener("change", (event) => {
      if (event.target.matches("[data-bind]")) bindFilters(event.target);
      if (event.target.matches("[data-assign='center']")) {
        withBusy(() => assignCenter(event.target.getAttribute("data-id"), event.target.value));
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.modal) {
        if (state.modal.resolve) state.modal.resolve(false);
        closeModal();
      }
    });
  }

  async function boot() {
    state.settings = Store.LocalStore.loadSettings();
    const baked = Sync.bakedConfig();
    if (baked) {
      state.settings.storage = "team";
      state.settings.teamApiKey = baked.apiKey;
      state.settings.teamBinId = baked.binId;
      Store.LocalStore.saveSettings(state.settings);
    }
    if (!state.settings.sharepointSiteUrl) {
      const detected = SP.detectSiteUrl();
      if (detected) state.settings.sharepointSiteUrl = detected;
    }
    connectRepo();
    try {
      if (await Files.restore()) {
        state.settings.storage = "file";
        Store.LocalStore.saveSettings(state.settings);
        state.data = await Files.read();
        state.syncState = "live";
        startFilePoll();
      } else if (state.settings.storage === "sharepoint" && Auth.hasToken()) {
        connectRepo();
        state.data = await state.repo.load();
      } else if (teamEnabled()) {
        const remote = await pullTeam();
        state.data = remote && (remote.updatedAt || remote.workCenters.length || remote.workOrders.length)
          ? remote
          : Store.LocalStore.load();
        if (!remote || !remote.updatedAt) {
          state.data.updatedAt = Date.now();
          await pushTeam();
        }
      } else {
        state.data = Store.LocalStore.load();
      }
    } catch (err) {
      console.error(err);
      state.data = Store.LocalStore.load();
      toast(`Could not load team data — using local copy. ${err.message}`, "error");
    }
    bindEvents();
    startTeamPoll();
    renderShell();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      Promise.resolve(boot()).catch(bootFailed);
    });
  } else {
    Promise.resolve(boot()).catch(bootFailed);
  }
})();
