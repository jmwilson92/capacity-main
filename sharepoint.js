/**
 * SharePoint REST adapter. Same-origin only (Site Assets / embedded page
 * on the SharePoint site). Uses the signed-in user's cookies.
 */
(function (root) {
  function detectSiteUrl() {
    const path = location.pathname || "";
    const site = path.match(/^(.*?\/(?:sites|teams)\/[^/]+)/i);
    if (site) return location.origin + site[1];
    if (/sharepoint\./i.test(location.hostname)) return location.origin;
    return "";
  }

  function isSharePointHost() {
    return /sharepoint\./i.test(location.hostname || "");
  }

  function joinUrl(siteUrl, path) {
    return String(siteUrl || "").replace(/\/+$/, "") + path;
  }

  function listUrl(siteUrl, listTitle, suffix) {
    const title = encodeURIComponent(listTitle);
    return joinUrl(siteUrl, `/_api/web/lists/getbytitle('${title}')${suffix || ""}`);
  }

  async function parseBody(response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (err) {
      return { raw: text };
    }
  }

  function errorMessage(payload, status) {
    if (payload && payload.error && payload.error.message) {
      const msg = payload.error.message;
      return typeof msg === "string" ? msg : msg.value || `SharePoint error ${status}`;
    }
    if (payload && payload["odata.error"] && payload["odata.error"].message) {
      return payload["odata.error"].message.value || `SharePoint error ${status}`;
    }
    return `SharePoint request failed (${status})`;
  }

  function SharePointStore(settings) {
    this.settings = settings;
    this.digest = null;
    this.digestAt = 0;
  }

  SharePointStore.prototype.siteUrl = function () {
    return (this.settings.sharepointSiteUrl || detectSiteUrl() || "").replace(/\/+$/, "");
  };

  SharePointStore.prototype.headers = function (digest, extra) {
    const headers = {
      Accept: "application/json;odata=nometadata",
      "Content-Type": "application/json;odata=nometadata",
      "OData-Version": "4.0"
    };
    if (digest) headers["X-RequestDigest"] = digest;
    return Object.assign(headers, extra || {});
  };

  SharePointStore.prototype.request = async function (url, options) {
    const response = await fetch(url, options);
    const payload = await parseBody(response);
    if (!response.ok) {
      throw new Error(errorMessage(payload, response.status));
    }
    return payload;
  };

  SharePointStore.prototype.getDigest = async function () {
    const now = Date.now();
    if (this.digest && now - this.digestAt < 20 * 60 * 1000) return this.digest;
    const payload = await this.request(joinUrl(this.siteUrl(), "/_api/contextinfo"), {
      method: "POST",
      headers: this.headers(),
      credentials: "same-origin"
    });
    this.digest = payload.FormDigestValue || payload.formDigestValue;
    this.digestAt = now;
    if (!this.digest) throw new Error("SharePoint did not return a request digest.");
    return this.digest;
  };

  SharePointStore.prototype.getItems = async function (listTitle) {
    const items = [];
    let url = listUrl(this.siteUrl(), listTitle, "/items?$top=2000");
    while (url) {
      const payload = await this.request(url, {
        method: "GET",
        headers: this.headers(),
        credentials: "same-origin"
      });
      const page = Array.isArray(payload.value) ? payload.value : [];
      items.push.apply(items, page);
      url = payload["@odata.nextLink"] || payload["odata.nextLink"] || "";
    }
    return items;
  };

  function compactFields(fields) {
    const out = {};
    Object.keys(fields).forEach((key) => {
      if (fields[key] !== null && fields[key] !== undefined) out[key] = fields[key];
    });
    return out;
  }

  SharePointStore.prototype.createItem = async function (listTitle, fields) {
    const digest = await this.getDigest();
    return this.request(listUrl(this.siteUrl(), listTitle, "/items"), {
      method: "POST",
      headers: this.headers(digest),
      credentials: "same-origin",
      body: JSON.stringify(compactFields(fields))
    });
  };

  SharePointStore.prototype.updateItem = async function (listTitle, id, fields) {
    const digest = await this.getDigest();
    return this.request(listUrl(this.siteUrl(), listTitle, `/items(${id})`), {
      method: "POST",
      headers: this.headers(digest, {
        "IF-MATCH": "*",
        "X-HTTP-Method": "MERGE"
      }),
      credentials: "same-origin",
      body: JSON.stringify(compactFields(fields))
    });
  };

  SharePointStore.prototype.deleteItem = async function (listTitle, id) {
    const digest = await this.getDigest();
    return this.request(listUrl(this.siteUrl(), listTitle, `/items(${id})`), {
      method: "POST",
      headers: this.headers(digest, {
        "IF-MATCH": "*",
        "X-HTTP-Method": "DELETE"
      }),
      credentials: "same-origin"
    });
  };

  SharePointStore.prototype.upsert = async function (listTitle, record, fields) {
    if (record.id && /^\d+$/.test(String(record.id))) {
      await this.updateItem(listTitle, record.id, fields);
      return String(record.id);
    }
    const created = await this.createItem(listTitle, fields);
    return String(created.Id || created.ID);
  };

  SharePointStore.prototype.test = async function () {
    const site = this.siteUrl();
    if (!site) throw new Error("Enter the SharePoint site URL first (https://tenant.sharepoint.com/sites/yoursite).");
    await this.getDigest();
    const lists = [
      this.settings.listWorkCenters,
      this.settings.listPeople,
      this.settings.listWorkOrders,
      this.settings.listAbsences
    ].filter(Boolean);
    for (const title of lists) {
      await this.request(listUrl(site, title, "?$select=Title,ItemCount"), {
        method: "GET",
        headers: this.headers(),
        credentials: "same-origin"
      });
    }
    return { site, lists };
  };

  function mapCenter(item) {
    return {
      id: String(item.Id),
      name: item.Title || "",
      notes: item.Notes || "",
      color: item.Color || "#1f6f6a"
    };
  }

  function mapPerson(item) {
    return {
      id: String(item.Id),
      name: item.Title || "",
      workCenterId: item.WorkCenterId ? String(item.WorkCenterId) : "",
      hoursPerWeek: Number(item.HoursPerWeek) || 0,
      workDays: item.WorkDays == null ? 5 : Number(item.WorkDays),
      worksWeekends: Boolean(item.WorksWeekends),
      efficiency: item.Efficiency == null ? 100 : Number(item.Efficiency),
      notes: item.Notes || ""
    };
  }

  function mapAbsence(item) {
    return {
      id: String(item.Id),
      personId: item.PersonId ? String(item.PersonId) : "",
      type: item.AbsenceType || item.Type || "pto",
      startDate: item.StartDate ? String(item.StartDate).slice(0, 10) : "",
      endDate: item.EndDate ? String(item.EndDate).slice(0, 10) : "",
      hours: item.Hours == null || Number(item.Hours) === 0 ? "" : Number(item.Hours),
      includeWeekends: Boolean(item.IncludeWeekends),
      notes: item.Notes || ""
    };
  }

  function mapOrder(item) {
    const due = item.DueDate ? String(item.DueDate).slice(0, 10) : "";
    return {
      id: String(item.Id),
      number: item.Title || "",
      title: item.JobName || "",
      workCenterId: item.WorkCenterId ? String(item.WorkCenterId) : "",
      hours: Number(item.Hours) || 0,
      remainingHours: item.RemainingHours == null ? Number(item.Hours) || 0 : Number(item.RemainingHours) || 0,
      dueDate: due,
      status: item.Status || "queued",
      priority: item.Priority || "medium",
      notes: item.Notes || ""
    };
  }

  function centerName(data, id) {
    const wc = (data.workCenters || []).find((c) => String(c.id) === String(id));
    return wc ? wc.name : "";
  }

  SharePointStore.prototype.load = async function () {
    const [centers, people, orders, absences] = await Promise.all([
      this.getItems(this.settings.listWorkCenters),
      this.getItems(this.settings.listPeople),
      this.getItems(this.settings.listWorkOrders),
      this.getItems(this.settings.listAbsences)
    ]);
    return CapacityStore.normalizeData({
      version: 1,
      workCenters: centers.map(mapCenter),
      people: people.map(mapPerson),
      workOrders: orders.map(mapOrder),
      absences: absences.map(mapAbsence)
    });
  };

  SharePointStore.prototype.saveCenter = async function (center) {
    const id = await this.upsert(this.settings.listWorkCenters, center, {
      Title: center.name,
      Notes: center.notes || "",
      Color: center.color || "#1f6f6a"
    });
    return Object.assign({}, center, { id });
  };

  SharePointStore.prototype.savePerson = async function (person, data) {
    const id = await this.upsert(this.settings.listPeople, person, {
      Title: person.name,
      WorkCenterId: person.workCenterId ? Number(person.workCenterId) || null : null,
      WorkCenterName: centerName(data, person.workCenterId),
      HoursPerWeek: Number(person.hoursPerWeek) || 0,
      WorkDays: Number(person.workDays) || 5,
      WorksWeekends: Boolean(person.worksWeekends),
      Efficiency: person.efficiency == null ? 100 : Number(person.efficiency),
      Notes: person.notes || ""
    });
    return Object.assign({}, person, { id });
  }

  function personName(data, id) {
    const person = (data.people || []).find((p) => String(p.id) === String(id));
    return person ? person.name : "";
  }

  SharePointStore.prototype.saveAbsence = async function (absence, data) {
    const start = absence.startDate ? `${absence.startDate}T00:00:00` : null;
    const end = absence.endDate ? `${absence.endDate}T00:00:00` : start;
    const fields = {
      Title: `${absence.type || "pto"} ${absence.startDate || ""}`.trim(),
      PersonId: absence.personId ? Number(absence.personId) || null : null,
      PersonName: personName(data, absence.personId),
      AbsenceType: absence.type || "pto",
      StartDate: start,
      EndDate: end,
      IncludeWeekends: Boolean(absence.includeWeekends),
      Notes: absence.notes || ""
    };
    fields.Hours = absence.hours === "" || absence.hours == null ? 0 : Number(absence.hours);
    const id = await this.upsert(this.settings.listAbsences, absence, fields);
    return Object.assign({}, absence, { id });
  };

  SharePointStore.prototype.saveOrder = async function (order, data) {
    const due = order.dueDate ? `${order.dueDate}T00:00:00` : null;
    const id = await this.upsert(this.settings.listWorkOrders, order, {
      Title: order.number,
      JobName: order.title || "",
      WorkCenterId: order.workCenterId ? Number(order.workCenterId) || null : null,
      WorkCenterName: centerName(data, order.workCenterId),
      Hours: Number(order.hours) || 0,
      RemainingHours: Number(order.remainingHours) || 0,
      DueDate: due,
      Status: order.status || "queued",
      Priority: order.priority || "medium",
      Notes: order.notes || ""
    });
    return Object.assign({}, order, { id });
  };

  SharePointStore.prototype.deleteCenter = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listWorkCenters, id);
  };

  SharePointStore.prototype.deletePerson = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listPeople, id);
  };

  SharePointStore.prototype.deleteOrder = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listWorkOrders, id);
  };

  SharePointStore.prototype.deleteAbsence = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listAbsences, id);
  };

  SharePointStore.prototype.replaceAll = async function (data) {
    const current = await this.load();
    for (const absence of current.absences || []) await this.deleteAbsence(absence.id);
    for (const wo of current.workOrders) await this.deleteOrder(wo.id);
    for (const person of current.people) await this.deletePerson(person.id);
    for (const wc of current.workCenters) await this.deleteCenter(wc.id);

    const idMap = Object.create(null);
    const personMap = Object.create(null);
    const next = CapacityStore.emptyData();
    for (const wc of data.workCenters) {
      const saved = await this.saveCenter(Object.assign({}, wc, { id: "" }));
      idMap[String(wc.id)] = saved.id;
      next.workCenters.push(saved);
    }
    const mapped = { workCenters: next.workCenters, people: [], workOrders: [], absences: [] };
    for (const person of data.people) {
      const saved = await this.savePerson(
        Object.assign({}, person, {
          id: "",
          workCenterId: idMap[String(person.workCenterId)] || ""
        }),
        mapped
      );
      personMap[String(person.id)] = saved.id;
      next.people.push(saved);
      mapped.people = next.people;
    }
    for (const wo of data.workOrders) {
      const saved = await this.saveOrder(
        Object.assign({}, wo, {
          id: "",
          workCenterId: idMap[String(wo.workCenterId)] || ""
        }),
        mapped
      );
      next.workOrders.push(saved);
    }
    for (const absence of data.absences || []) {
      const saved = await this.saveAbsence(
        Object.assign({}, absence, {
          id: "",
          personId: personMap[String(absence.personId)] || ""
        }),
        mapped
      );
      next.absences.push(saved);
    }
    return next;
  };

  root.CapacitySharePoint = {
    detectSiteUrl,
    isSharePointHost,
    SharePointStore
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
