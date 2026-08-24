/* Tech scorecard helpers - Output, Quality, Skill (IPC), Soft skills */
(function (root) {
  var STORAGE_KEY = "capacity-tracker.v1";

  var COMPLEXITY_WEIGHT = { easy: 1, medium: 1.25, hard: 1.5 };
  var SOFT_KEYS = [
    { key: "initiative", label: "Initiative" },
    { key: "criticalThinking", label: "Critical thinking" },
    { key: "communication", label: "Communication & accountability" },
    { key: "leadership", label: "Leadership" }
  ];
  var CERT_KEYS = [
    { key: "jstd", label: "J-STD" },
    { key: "ipc610", label: "IPC-A-610" },
    { key: "ipc620", label: "IPC-A-620" }
  ];
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

  function num(v, f) {
    var n = Number(v);
    return Number.isFinite(n) ? n : f || 0;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function isManager(session) {
    if (!session) return false;
    var r = String(session.role || "").toLowerCase().replace(/\s+/g, "");
    return r === "manager" || r === "admin" || r === "mgr";
  }

  /** Quality 0-100 from qaRecords where person was the builder (techId) */
  function qualityScore(personId, qaRecords) {
    var pass = 0;
    var fail = 0;
    (qaRecords || []).forEach(function (q) {
      if (String(q.techId) !== String(personId)) return;
      if (q.result === "pass") pass++;
      else if (q.result === "fail") fail++;
    });
    var total = pass + fail;
    if (!total) return { score: null, pass: 0, fail: 0, total: 0 };
    return {
      score: Math.round((pass / total) * 100),
      pass: pass,
      fail: fail,
      total: total
    };
  }

  /** Skill 0-100 from three IPC certs on person.certs */
  function skillScore(person) {
    var certs = (person && person.certs) || {};
    var held = 0;
    CERT_KEYS.forEach(function (c) {
      var row = certs[c.key];
      if (row && (row.held === true || row.held === "true" || row === true)) held++;
    });
    return {
      score: Math.round((held / CERT_KEYS.length) * 100),
      held: held,
      total: CERT_KEYS.length,
      certs: certs
    };
  }

  /** Soft 0-100 from latest review or average of all */
  function softScore(personId, reviews) {
    var mine = (reviews || []).filter(function (r) {
      return String(r.personId) === String(personId);
    });
    if (!mine.length) return { score: null, review: null };
    mine.sort(function (a, b) {
      return String(b.at || "").localeCompare(String(a.at || ""));
    });
    var latest = mine[0];
    var sum = 0;
    var n = 0;
    SOFT_KEYS.forEach(function (s) {
      var v = num(latest[s.key], 0);
      if (v >= 1 && v <= 5) {
        sum += v;
        n++;
      }
    });
    if (!n) return { score: null, review: latest };
    // 1-5 average -> 0-100 (1=20, 5=100)
    return { score: Math.round((sum / n) * 20), review: latest };
  }

  /**
   * Output score from completed work:
   * For each WO the tech checked into with time logged:
   *   pace = expectedHours / actualHours
   *   weighted = pace * complexityWeight
   * Average weighted paces, map to 0-100 (pace 1.0 => 70 baseline, clamp)
   */
  function outputScore(personId, data) {
    var timeEntries = data.timeEntries || [];
    var orders = data.workOrders || [];
    var byWo = {};
    timeEntries.forEach(function (e) {
      if (String(e.personId) !== String(personId)) return;
      var id = String(e.workOrderId || "");
      if (!id) return;
      if (!byWo[id]) byWo[id] = 0;
      byWo[id] += num(e.durationMs, 0);
    });
    var samples = [];
    Object.keys(byWo).forEach(function (woId) {
      var wo = orders.find(function (o) {
        return String(o.id) === woId;
      });
      if (!wo) return;
      var actualH = byWo[woId] / 36e5;
      if (actualH < 0.05) return;
      var expected = num(wo.hours, 0) || num(wo.remainingHours, 0) || num(wo.hoursLogged, 0);
      // prefer planned hours field
      expected = num(wo.hours, 0);
      if (expected <= 0) expected = num(wo.projectedHours, 0);
      if (expected <= 0) return;
      var cx = String(wo.complexity || "medium").toLowerCase();
      var w = COMPLEXITY_WEIGHT[cx] || 1.25;
      var pace = expected / actualH;
      samples.push({ woId: woId, pace: pace, weight: w, weighted: pace * w, expected: expected, actual: actualH });
    });
    if (!samples.length) return { score: null, samples: [] };
    var avg =
      samples.reduce(function (s, x) {
        return s + x.weighted;
      }, 0) / samples.length;
    // Map: weighted pace 0.5 -> ~35, 1.0 -> 70, 1.5 -> 100
    var score = clamp(Math.round(avg * 70), 0, 100);
    return { score: score, samples: samples, avgWeightedPace: avg };
  }

  function overallScore(parts) {
    var weights = { output: 0.3, quality: 0.3, skill: 0.2, soft: 0.2 };
    var sum = 0;
    var wsum = 0;
    ["output", "quality", "skill", "soft"].forEach(function (k) {
      if (parts[k] != null && Number.isFinite(parts[k])) {
        sum += parts[k] * weights[k];
        wsum += weights[k];
      }
    });
    if (!wsum) return null;
    return Math.round(sum / wsum);
  }

  function buildPersonCard(person, data) {
    var q = qualityScore(person.id, data.qaRecords || []);
    var sk = skillScore(person);
    var so = softScore(person.id, data.softSkillReviews || []);
    var out = outputScore(person.id, data);
    var parts = {
      output: out.score,
      quality: q.score,
      skill: sk.score,
      soft: so.score
    };
    return {
      person: person,
      output: out,
      quality: q,
      skill: sk,
      soft: so,
      overall: overallScore(parts),
      parts: parts
    };
  }

  function writeQaRecord(rec) {
    var data = load();
    if (!Array.isArray(data.qaRecords)) data.qaRecords = [];
    data.qaRecords.unshift(rec);
    save(data);
    return rec;
  }

  root.Scorecard = {
    COMPLEXITY_WEIGHT: COMPLEXITY_WEIGHT,
    SOFT_KEYS: SOFT_KEYS,
    CERT_KEYS: CERT_KEYS,
    NC_CATEGORIES: NC_CATEGORIES,
    load: load,
    save: save,
    isManager: isManager,
    qualityScore: qualityScore,
    skillScore: skillScore,
    softScore: softScore,
    outputScore: outputScore,
    overallScore: overallScore,
    buildPersonCard: buildPersonCard,
    writeQaRecord: writeQaRecord
  };
})(typeof window !== "undefined" ? window : globalThis);
