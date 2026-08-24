/**
 * Shared board stored as capacity-data.json next to the HTML file.
 * Put that file in a OneDrive-synced SharePoint folder so everyone
 * writes the same document. No IT, no extra cloud.
 */
(function (root) {
  const DB_NAME = "capacity-tracker-file";
  const STORE = "handles";

  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  async function idbGet(key) {
    try {
      const db = await openDb();
      return await new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, "readonly");
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = function () {
          resolve(r.result || null);
        };
        r.onerror = function () {
          reject(r.error);
        };
      });
    } catch (err) {
      return null;
    }
  }

  async function idbSet(key, value) {
    try {
      const db = await openDb();
      await new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    } catch (err) {
      /* ignore */
    }
  }

  const FileStore = {
    handle: null,
    lastModified: 0,

    supported() {
      return typeof window.showOpenFilePicker === "function" && typeof window.showSaveFilePicker === "function";
    },

    connected() {
      return Boolean(this.handle);
    },

    async remember(handle) {
      this.handle = handle;
      await idbSet("team", handle);
      try {
        const file = await handle.getFile();
        this.lastModified = file.lastModified;
      } catch (err) {
        this.lastModified = 0;
      }
    },

    async restore() {
      if (!this.supported()) return false;
      const handle = await idbGet("team");
      if (!handle) return false;
      if (handle.queryPermission) {
        let perm = await handle.queryPermission({ mode: "readwrite" });
        if (perm !== "granted" && handle.requestPermission) {
          perm = await handle.requestPermission({ mode: "readwrite" });
        }
        if (perm !== "granted") return false;
      }
      await this.remember(handle);
      return true;
    },

    async pickExisting() {
      if (!this.supported()) {
        throw new Error("Use Edge or Chrome and start the app with Start-CapacityTracker.bat.");
      }
      const picked = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "Capacity data", accept: { "application/json": [".json"] } }]
      });
      await this.remember(picked[0]);
    },

    async createNew() {
      if (!this.supported()) {
        throw new Error("Use Edge or Chrome and start the app with Start-CapacityTracker.bat.");
      }
      const handle = await window.showSaveFilePicker({
        suggestedName: "capacity-data.json",
        types: [{ description: "Capacity data", accept: { "application/json": [".json"] } }]
      });
      await this.remember(handle);
    },

    async read() {
      if (!this.handle) throw new Error("No team file connected.");
      const file = await this.handle.getFile();
      this.lastModified = file.lastModified;
      const text = await file.text();
      if (!text.trim()) return CapacityStore.emptyData();
      return CapacityStore.normalizeData(JSON.parse(text));
    },

    async write(data) {
      if (!this.handle) throw new Error("No team file connected.");
      const writable = await this.handle.createWritable();
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();
      const file = await this.handle.getFile();
      this.lastModified = file.lastModified;
    },

    async changedOnDisk() {
      if (!this.handle) return false;
      const file = await this.handle.getFile();
      return file.lastModified > this.lastModified;
    }
  };

  root.CapacityFileStore = FileStore;
})(typeof globalThis !== "undefined" ? globalThis : this);
