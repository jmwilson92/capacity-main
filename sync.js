/**
 * Shared live board. The downloaded HTML file talks to a JSONBin
 * so everyone opening the same team file sees the same data.
 */
(function (root) {
  const JSONBIN = "https://api.jsonbin.io/v3/b";

  function headers(apiKey, extra) {
    const h = Object.assign({ "Content-Type": "application/json", Accept: "application/json" }, extra || {});
    if (apiKey) h["X-Master-Key"] = apiKey;
    return h;
  }

  async function parse(response) {
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch (err) {
      body = { raw: text };
    }
    if (!response.ok) {
      const msg =
        (body && (body.message || body.error)) ||
        `Team board request failed (${response.status})`;
      throw new Error(msg);
    }
    return body;
  }

  const TeamSync = {
    async create(apiKey, data) {
      if (!apiKey) throw new Error("Paste a JSONBin master key first.");
      const body = await parse(
        await fetch(JSONBIN, {
          method: "POST",
          headers: headers(apiKey, { "X-Bin-Name": "capacity-tracker" }),
          body: JSON.stringify(data)
        })
      );
      const id = body.metadata && (body.metadata.id || body.metadata.parentId);
      if (!id) throw new Error("JSONBin did not return a board id.");
      return { id: String(id), record: body.record || data };
    },

    async pull(apiKey, binId) {
      if (!apiKey || !binId) throw new Error("Team board is not configured.");
      const body = await parse(
        await fetch(`${JSONBIN}/${encodeURIComponent(binId)}/latest`, {
          method: "GET",
          headers: headers(apiKey, { "X-Bin-Meta": "false" })
        })
      );
      return body.record || body;
    },

    async push(apiKey, binId, data) {
      if (!apiKey || !binId) throw new Error("Team board is not configured.");
      const body = await parse(
        await fetch(`${JSONBIN}/${encodeURIComponent(binId)}`, {
          method: "PUT",
          headers: headers(apiKey),
          body: JSON.stringify(data)
        })
      );
      return body.record || data;
    },

    bakedConfig() {
      const baked = root.CAPACITY_SYNC;
      if (!baked || typeof baked !== "object") return null;
      if (!baked.apiKey || !baked.binId) return null;
      return {
        provider: "jsonbin",
        apiKey: String(baked.apiKey),
        binId: String(baked.binId)
      };
    },

    injectIntoHtml(html, config) {
      const open = "<scr" + "ipt>";
      const close = "</scr" + "ipt>";
      const tag =
        open +
        "window.CAPACITY_SYNC=" +
        JSON.stringify({
          provider: "jsonbin",
          apiKey: config.apiKey,
          binId: config.binId
        }) +
        ";" +
        close;
      if (html.indexOf("window.CAPACITY_SYNC=") >= 0) {
        const re = new RegExp("<script>window\\.CAPACITY_SYNC=[\\s\\S]*?;" + close);
        return html.replace(re, tag);
      }
      if (html.indexOf("<body>") >= 0) return html.replace("<body>", "<body>\n  " + tag);
      return tag + html;
    }
  };

  root.CapacitySync = TeamSync;
})(typeof globalThis !== "undefined" ? globalThis : this);
