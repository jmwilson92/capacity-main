/**
 * Microsoft Graph adapter for the four Capacity Tracker lists.
 * Used when the HTML app is signed in (data stays in the SharePoint tenant).
 */
(function (root) {
  function compactFields(fields) {
    const out = {};
    Object.keys(fields).forEach(function (key) {
      if (fields[key] !== null && fields[key] !== undefined) out[key] = fields[key];
    });
    return out;
  }

  function GraphStore(settings, auth) {
    this.settings = settings;
    this.auth = auth;
    this.siteId = "";
    this.listIds = Object.create(null);
  }

  GraphStore.prototype.graphRoot = function () {
    return this.auth.cloudFromSite(this.settings.sharepointSiteUrl).graph + "/v1.0";
  };

  GraphStore.prototype.request = async function (method, url, body) {
    const token = this.auth.getAccessToken();
    if (!token) throw new Error("Sign in to Microsoft 365 first.");
    const response = await fetch(url, {
      method: method,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (response.status === 204) return {};
    const payload = await response.json().catch(function () {
      return {};
    });
    if (!response.ok) {
      const msg =
        (payload.error && payload.error.message) ||
        payload.error_description ||
        "Graph request failed (" + response.status + ")";
      throw new Error(msg);
    }
    return payload;
  };

  GraphStore.prototype.ensureSite = async function () {
    if (this.siteId) return this.siteId;
    const raw = String(this.settings.sharepointSiteUrl || "").replace(/\/+$/, "");
    const match = raw.match(/^https?:\/\/([^/]+)(\/sites\/[^/]+|\/teams\/[^/]+)/i);
    if (!match) throw new Error("SharePoint site URL should look like https://contoso.sharepoint.us/sites/Production");
    const host = match[1];
    const path = match[2];
    const site = await this.request("GET", this.graphRoot() + "/sites/" + host + ":" + path);
    if (!site.id) throw new Error("Could not find that SharePoint site.");
    this.siteId = site.id;
    return this.siteId;
  };

  GraphStore.prototype.ensureList = async function (title) {
    if (this.listIds[title]) return this.listIds[title];
    await this.ensureSite();
    let payload;
    try {
      payload = await this.request(
        "GET",
        this.graphRoot() +
          "/sites/" +
          this.siteId +
          "/lists?$filter=displayName eq '" +
          title.replace(/'/g, "''") +
          "'"
      );
    } catch (err) {
      payload = await this.request("GET", this.graphRoot() + "/sites/" + this.siteId + "/lists");
    }
    const list = (payload.value || []).find(function (item) {
      return item.displayName === title || item.name === title;
    });
    if (!list) {
      throw new Error('List "' + title + '" was not found on the site. Create the four CT lists first.');
    }
    this.listIds[title] = list.id;
    return list.id;
  };

  GraphStore.prototype.getItems = async function (listTitle) {
    const listId = await this.ensureList(listTitle);
    const items = [];
    let url =
      this.graphRoot() +
      "/sites/" +
      this.siteId +
      "/lists/" +
      listId +
      "/items?$expand=fields&$top=200";
    while (url) {
      const payload = await this.request("GET", url);
      (payload.value || []).forEach(function (row) {
        const fields = Object.assign({ Id: row.id, ID: row.id }, row.fields || {});
        items.push(fields);
      });
      url = payload["@odata.nextLink"] || "";
    }
    return items;
  };

  GraphStore.prototype.createItem = async function (listTitle, fields) {
    const listId = await this.ensureList(listTitle);
    const created = await this.request(
      "POST",
      this.graphRoot() + "/sites/" + this.siteId + "/lists/" + listId + "/items",
      { fields: compactFields(fields) }
    );
    return created.id || (created.fields && created.fields.id);
  };

  GraphStore.prototype.updateItem = async function (listTitle, id, fields) {
    const listId = await this.ensureList(listTitle);
    await this.request(
      "PATCH",
      this.graphRoot() + "/sites/" + this.siteId + "/lists/" + listId + "/items/" + id + "/fields",
      compactFields(fields)
    );
    return id;
  };

  GraphStore.prototype.deleteItem = async function (listTitle, id) {
    const listId = await this.ensureList(listTitle);
    await this.request(
      "DELETE",
      this.graphRoot() + "/sites/" + this.siteId + "/lists/" + listId + "/items/" + id
    );
  };

  GraphStore.prototype.upsert = async function (listTitle, record, fields) {
    if (record.id && /^\d+$/.test(String(record.id))) {
      await this.updateItem(listTitle, record.id, fields);
      return String(record.id);
    }
    const created = await this.createItem(listTitle, fields);
    return String(created);
  };

  GraphStore.prototype.test = async function () {
    await this.ensureSite();
    await this.ensureList(this.settings.listWorkCenters);
    await this.ensureList(this.settings.listPeople);
    await this.ensureList(this.settings.listWorkOrders);
    await this.ensureList(this.settings.listAbsences);
    return { site: this.settings.sharepointSiteUrl };
  };

  function mapCenter(item) {
    return {
      id: String(item.Id || item.id),
      name: item.Title || "",
      notes: item.Notes || "",
      color: item.Color || "#1f6f6a"
    };
  }

  function mapPerson(item) {
    return {
      id: String(item.Id || item.id),
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
      id: String(item.Id || item.id),
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
      id: String(item.Id || item.id),
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
    const wc = (data.workCenters || []).find(function (c) {
      return String(c.id) === String(id);
    });
    return wc ? wc.name : "";
  }

  function personName(data, id) {
    const person = (data.people || []).find(function (p) {
      return String(p.id) === String(id);
    });
    return person ? person.name : "";
  }

  GraphStore.prototype.load = async function () {
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

  GraphStore.prototype.saveCenter = async function (center) {
    const id = await this.upsert(this.settings.listWorkCenters, center, {
      Title: center.name,
      Notes: center.notes || "",
      Color: center.color || "#1f6f6a"
    });
    return Object.assign({}, center, { id: id });
  };

  GraphStore.prototype.savePerson = async function (person, data) {
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
    return Object.assign({}, person, { id: id });
  };

  GraphStore.prototype.saveAbsence = async function (absence, data) {
    const start = absence.startDate ? absence.startDate + "T00:00:00" : null;
    const end = absence.endDate ? absence.endDate + "T00:00:00" : start;
    const fields = {
      Title: (absence.type || "pto") + " " + (absence.startDate || ""),
      PersonId: absence.personId ? Number(absence.personId) || null : null,
      PersonName: personName(data, absence.personId),
      AbsenceType: absence.type || "pto",
      StartDate: start,
      EndDate: end,
      IncludeWeekends: Boolean(absence.includeWeekends),
      Notes: absence.notes || "",
      Hours: absence.hours === "" || absence.hours == null ? 0 : Number(absence.hours)
    };
    const id = await this.upsert(this.settings.listAbsences, absence, fields);
    return Object.assign({}, absence, { id: id });
  };

  GraphStore.prototype.saveOrder = async function (order, data) {
    const due = order.dueDate ? order.dueDate + "T00:00:00" : null;
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
    return Object.assign({}, order, { id: id });
  };

  GraphStore.prototype.deleteCenter = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listWorkCenters, id);
  };

  GraphStore.prototype.deletePerson = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listPeople, id);
  };

  GraphStore.prototype.deleteOrder = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listWorkOrders, id);
  };

  GraphStore.prototype.deleteAbsence = async function (id) {
    if (!/^\d+$/.test(String(id))) return;
    await this.deleteItem(this.settings.listAbsences, id);
  };

  GraphStore.prototype.replaceAll = async function (data) {
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
        Object.assign({}, person, { id: "", workCenterId: idMap[String(person.workCenterId)] || "" }),
        mapped
      );
      personMap[String(person.id)] = saved.id;
      next.people.push(saved);
      mapped.people = next.people;
    }
    for (const wo of data.workOrders) {
      next.workOrders.push(
        await this.saveOrder(
          Object.assign({}, wo, { id: "", workCenterId: idMap[String(wo.workCenterId)] || "" }),
          mapped
        )
      );
    }
    for (const absence of data.absences || []) {
      next.absences.push(
        await this.saveAbsence(
          Object.assign({}, absence, { id: "", personId: personMap[String(absence.personId)] || "" }),
          mapped
        )
      );
    }
    return next;
  };

  root.CapacityGraph = { GraphStore: GraphStore };
})(typeof globalThis !== "undefined" ? globalThis : this);
