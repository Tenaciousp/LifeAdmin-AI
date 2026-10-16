// Device-local repository. No account, server, analytics or automatic upload.
const FORMAT = "lifeadmin-backup";
const VERSION = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);

export function serialise(snapshot) {
  return JSON.stringify({ format: FORMAT, version: VERSION, exported_at: new Date().toISOString(), ...snapshot });
}

function verifySize(tx, run) {
  const tasks = tx.objectStore("tasks").getAll();
  const plans = tx.objectStore("plans").getAll();
  plans.onsuccess = () => run(() => {
    if (tasks.result.length > 10000 || plans.result.length > 10000) throw new Error("Too many saved records. Export a backup before removing older records.");
    if (new TextEncoder().encode(serialise({ tasks: tasks.result, plans: plans.result })).length > MAX_BYTES) {
      throw new Error("Device records exceed the 5 MB limit. Export a backup before removing older records.");
    }
  });
}

export function jsonValue(value, depth = 0, seen = new Set()) {
  if (depth > 12) throw new Error("Backup nesting is too deep.");
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string" && value.length <= 100000) return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (!value || typeof value !== "object" || seen.has(value)) throw new Error("Invalid backup value.");
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 10000) throw new Error("Too many backup entries.");
    for (const item of value) jsonValue(item, depth + 1, seen);
  } else {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("Invalid backup object.");
    const entries = Object.entries(value);
    if (entries.length > 1000) throw new Error("Too many record fields.");
    for (const [key, item] of entries) {
      if (FORBIDDEN.has(key) || key.length > 100) throw new Error("Invalid backup field.");
      jsonValue(item, depth + 1, seen);
    }
  }
  seen.delete(value);
}

export function record(value, kind) {
  jsonValue(value);
  if (!value || Array.isArray(value) || typeof value !== "object" ||
      typeof value.id !== "string" || !value.id.trim() || value.id.length > 100 ||
      typeof value.title !== "string" || value.title.length > 160) throw new Error("Invalid " + kind + " record.");
  if (kind === "plan" && (typeof value.task_id !== "string" || !value.task_id ||
      typeof value.content !== "string")) throw new Error("Invalid saved plan.");
  if (kind === "plan") {
    if (value.sections != null && (typeof value.sections !== "object" || Array.isArray(value.sections) ||
        Object.values(value.sections).some(text => typeof text !== "string"))) throw new Error("Invalid saved plan sections.");
    if (value.missing_details != null && (!Array.isArray(value.missing_details) ||
        value.missing_details.some(text => typeof text !== "string"))) throw new Error("Invalid saved plan missing details.");
    const draft = value.provider_email;
    if (draft != null && (typeof draft !== "object" || Array.isArray(draft) ||
        typeof draft.subject !== "string" || typeof draft.body !== "string" ||
        (draft.kind != null && typeof draft.kind !== "string"))) throw new Error("Invalid saved plan message.");
  }
  return structuredClone(value);
}

export function parseBackup(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("Backup exceeds the 5 MB limit.");
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error("Backup is not valid JSON."); }
  jsonValue(backup);
  if (backup?.format !== FORMAT || backup?.version !== VERSION ||
      !Array.isArray(backup.tasks) || !Array.isArray(backup.plans)) throw new Error("Unsupported LifeAdmin backup.");
  const tasks = backup.tasks.map(x => record(x, "task"));
  const plans = backup.plans.map(x => record(x, "plan"));
  const taskIds = new Set(tasks.map(x => x.id));
  if (taskIds.size !== tasks.length || new Set(plans.map(x => x.id)).size !== plans.length) throw new Error("Backup contains duplicate records.");
  if (plans.some(x => !taskIds.has(x.task_id))) throw new Error("A saved plan has no matching bill.");
  return { tasks, plans };
}

export async function openLocalStore({ indexedDB = globalThis.indexedDB, name = "lifeadmin-device-v1" } = {}) {
  if (!indexedDB) throw new Error("Device storage is unavailable. No records were saved.");
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, VERSION);
    let abandoned = false;
    request.onupgradeneeded = () => {
      for (const store of ["tasks", "plans"]) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "id" });
      }
      request.transaction.objectStore("plans").createIndex("task_id", "task_id");
    };
    request.onerror = () => reject(new Error("Device storage did not open."));
    request.onblocked = () => {
      abandoned = true;
      reject(new Error("Close other LifeAdmin windows and reopen the app to update storage."));
    };
    request.onsuccess = () => {
      if (abandoned) { request.result.close(); return; }
      resolve(request.result);
    };
  });
  db.onversionchange = () => db.close();

  // Resolve after commit, never on request success: a later write might abort.
  function transaction(mode, work) {
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(["tasks", "plans"], mode); }
      catch { reject(new Error("Device storage is closed or unavailable.")); return; }
      let result;
      let failure;
      const fail = error => { failure = error; tx.abort(); };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || new Error("The save failed. Existing records were preserved."));
      tx.onerror = () => {}; // Request failures abort the transaction by default.
      const run = callback => {
        try { callback(); } catch (error) { fail(error); }
      };
      run(() => work(tx, value => { result = value; }, run));
    });
  }
  return {
    close: () => db.close(),
    async read() {
      return transaction("readonly", (tx, done) => {
        const tasks = tx.objectStore("tasks").getAll();
        const plans = tx.objectStore("plans").getAll();
        plans.onsuccess = () => done({ tasks: tasks.result, plans: plans.result });
      });
    },
    async createTask(task) {
      const value = record(task, "task");
      return transaction("readwrite", (tx, done, run) => {
        tx.objectStore("tasks").add(value);
        verifySize(tx, run);
        done(value);
      });
    },
    async updateTask(id, changes) {
      jsonValue(changes);
      if (!changes || Array.isArray(changes) || typeof changes !== "object" ||
          ("id" in changes && changes.id !== id)) throw new Error("Invalid bill changes.");
      return transaction("readwrite", (tx, done, run) => {
        const store = tx.objectStore("tasks");
        const request = store.get(id);
        request.onsuccess = () => run(() => {
          if (!request.result) throw new Error("Bill not found.");
          const value = record({ ...request.result, ...changes, id }, "task");
          store.put(value);
          verifySize(tx, run);
          done(value);
        });
      });
    },
    async savePlan(plan) {
      const value = record(plan, "plan");
      return transaction("readwrite", (tx, done, run) => {
        const task = tx.objectStore("tasks").get(value.task_id);
        task.onsuccess = () => run(() => {
          if (!task.result) throw new Error("Save the bill before saving its plan.");
          tx.objectStore("plans").add(value);
          verifySize(tx, run);
          done(value);
        });
      });
    },
    async deleteTask(id) {
      return transaction("readwrite", (tx) => {
        tx.objectStore("tasks").delete(id);
        const cursor = tx.objectStore("plans").index("task_id").openCursor(id);
        cursor.onsuccess = () => {
          if (cursor.result) { cursor.result.delete(); cursor.result.continue(); }
        };
      });
    },
    async deletePlan(id) {
      return transaction("readwrite", tx => { tx.objectStore("plans").delete(id); });
    },
    async clear() {
      return transaction("readwrite", tx => {
        tx.objectStore("tasks").clear();
        tx.objectStore("plans").clear();
      });
    },
    async exportBackup() {
      const snapshot = await this.read();
      const text = serialise(snapshot);
      parseBackup(text);
      return text;
    },
    async importBackup(text, { replace = false } = {}) {
      // Full validation precedes opening any write transaction.
      const snapshot = parseBackup(text);
      if (replace !== true) throw new Error("Confirm replacement before restoring a backup.");
      return transaction("readwrite", (tx, done, run) => {
        tx.objectStore("tasks").clear();
        tx.objectStore("plans").clear();
        for (const task of snapshot.tasks) tx.objectStore("tasks").add(task);
        for (const plan of snapshot.plans) tx.objectStore("plans").add(plan);
        verifySize(tx, run);
        done({ tasks: snapshot.tasks.length, plans: snapshot.plans.length });
      });
    },
  };
}
