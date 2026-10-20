import { test } from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { openLocalStore, parseBackup } from "./storage.mjs";

globalThis.fetch = () => { throw new Error("Storage attempted a network request"); };
const task = (id, title = "Energy renewal") => ({ id, title, details: { provider: "Example Energy" } });
const plan = (id, task_id) => ({ id, task_id, title: "Saved plan", content: "Review the renewal." });
const backup = (tasks, plans = [], version = 1) => JSON.stringify({ format: "lifeadmin-backup", version, tasks, plans });
async function fixture() {
  const indexedDB = new IDBFactory();
  return { indexedDB, store: await openLocalStore({ indexedDB }) };
}

test("message edits persist through reopen and backup without changing other plan fields", async () => {
  const { indexedDB, store } = await fixture();
  await store.createTask(task("a"));
  const saved = { ...plan("p", "a"), sections: { next_steps: "Original guidance" },
    provider_email: { subject: "Original", body: "Original message", kind: "bank_query" } };
  await store.savePlan(saved);
  const draft = { subject: "Reviewed subject", body: "Reviewed message\nSecond line" };
  const updated = await store.updatePlanMessage("p", draft, saved.provider_email);
  assert.deepEqual(updated, { ...saved, provider_email: { ...saved.provider_email, ...draft } });
  const exported = await store.exportBackup();
  store.close();
  const reopened = await openLocalStore({ indexedDB });
  assert.deepEqual((await reopened.read()).plans, [updated]);
  await reopened.clear();
  await reopened.importBackup(exported, { replace: true });
  assert.deepEqual((await reopened.read()).plans, [updated]);
  reopened.close();
});

test("aborted, stale and invalid message edits leave acknowledged records unchanged", async () => {
  const { store } = await fixture();
  await store.createTask(task("a"));
  const saved = { ...plan("p", "a"), provider_email: { subject: "Original", body: "Original message", kind: "provider" } };
  await store.savePlan(saved);
  const before = await store.read(), put = IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort(), { once: true });
      return request;
    };
    await assert.rejects(store.updatePlanMessage("p", { subject: "Fail", body: "Not committed" }, saved.provider_email));
  } finally { IDBObjectStore.prototype.put = put; }
  assert.deepEqual(await store.read(), before);
  const updated = await store.updatePlanMessage("p", { subject: "Newer", body: "Keep newer" }, saved.provider_email);
  await assert.rejects(store.updatePlanMessage("p", { subject: "Stale", body: "Do not overwrite" }, saved.provider_email), /Message changed/);
  for (const draft of [null, { subject: "", body: "Body" }, { subject: "Subject", body: " " },
    { subject: "x".repeat(201), body: "Body" }, { subject: "Subject", body: "x".repeat(20001) }]) {
    await assert.rejects(store.updatePlanMessage("p", draft, updated.provider_email), /Enter a subject/);
  }
  assert.deepEqual((await store.read()).plans, [updated]);
  await store.deletePlan("p");
  await assert.rejects(store.updatePlanMessage("p", { subject: "Missing", body: "No resurrection" }, updated.provider_email), /Plan not found/);
  assert.deepEqual((await store.read()).plans, []);
  store.close();
});

test("bills and plans survive closing and reopening storage", async () => {
  const { indexedDB, store } = await fixture();
  await store.createTask(task("a"));
  await store.savePlan(plan("p", "a"));
  store.close();
  const reopened = await openLocalStore({ indexedDB });
  assert.deepEqual(await reopened.read(), { tasks: [task("a")], plans: [plan("p", "a")] });
  reopened.close();
});

test("concurrent windows preserve distinct inserts and unrelated edits", async () => {
  const { indexedDB, store } = await fixture();
  const second = await openLocalStore({ indexedDB });
  await Promise.all([store.createTask(task("a")), second.createTask(task("b"))]);
  await Promise.all([store.updateTask("a", { notes: "Call tomorrow" }), second.updateTask("a", { status: "Done" })]);
  const snapshot = await store.read();
  assert.equal(snapshot.tasks.length, 2);
  assert.equal(snapshot.tasks[0].notes, "Call tomorrow");
  assert.equal(snapshot.tasks[0].status, "Done");
  store.close(); second.close();
});

test("duplicate IDs and missing bill references do not change saved data", async () => {
  const { store } = await fixture();
  await store.createTask(task("a"));
  await assert.rejects(store.createTask(task("a", "Overwrite")));
  await assert.rejects(store.savePlan(plan("p", "missing")));
  await assert.rejects(store.updateTask("missing", { title: "Missing" }));
  assert.deepEqual(await store.read(), { tasks: [task("a")], plans: [] });
  store.close();
});

test("export and confirmed import restore a complete snapshot", async () => {
  const { store } = await fixture();
  await store.createTask(task("a"));
  await store.savePlan(plan("p", "a"));
  const exported = await store.exportBackup();
  await store.createTask(task("b"));
  await assert.rejects(store.importBackup(exported), /Confirm/);
  assert.equal((await store.read()).tasks.length, 2);
  assert.deepEqual(await store.importBackup(exported, { replace: true }), { tasks: 1, plans: 1 });
  assert.deepEqual(await store.read(), parseBackup(exported));
  store.close();
});

test("invalid, future, duplicate and orphaned backups leave records intact", async () => {
  const { store } = await fixture();
  await store.createTask(task("original"));
  const invalid = [
    "{broken", backup([], [], 2), backup([task("a"), task("a")]),
    backup([], [plan("p", "missing")]),
    '{"format":"lifeadmin-backup","version":1,"tasks":[],"plans":[],"__proto__":{}}',
    backup([{ id: "a", title: 42 }]), "x".repeat(5 * 1024 * 1024 + 1),
  ];
  for (const text of invalid) {
    await assert.rejects(store.importBackup(text, { replace: true }));
    assert.deepEqual((await store.read()).tasks, [task("original")]);
  }
  store.close();
});

test("a write abort after clearing during restore rolls back the entire replacement", async () => {
  const { store } = await fixture();
  await store.createTask(task("original"));
  await store.savePlan(plan("original-plan", "original"));
  const originalAdd = IDBObjectStore.prototype.add;
  try {
    IDBObjectStore.prototype.add = function (...args) {
      const request = originalAdd.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort(), { once: true });
      return request;
    };
    await assert.rejects(store.importBackup(backup([task("new")]), { replace: true }));
  } finally { IDBObjectStore.prototype.add = originalAdd; }
  assert.deepEqual(await store.read(), { tasks: [task("original")], plans: [plan("original-plan", "original")] });
  store.close();
});

test("deleting a bill removes only its plans; clearing removes all local records", async () => {
  const { store } = await fixture();
  await store.createTask(task("a")); await store.createTask(task("b"));
  await store.savePlan(plan("pa", "a")); await store.savePlan(plan("pb", "b"));
  await store.deleteTask("a");
  assert.deepEqual(await store.read(), { tasks: [task("b")], plans: [plan("pb", "b")] });
  await store.deletePlan("pb");
  assert.equal((await store.read()).plans.length, 0);
  await store.clear();
  assert.deepEqual(await store.read(), { tasks: [], plans: [] });
  store.close();
});

test("returned records are isolated and invalid values are rejected", async () => {
  const { store } = await fixture();
  const input = task("a");
  await store.createTask(input);
  input.details.provider = "Changed";
  const snapshot = await store.read();
  snapshot.tasks[0].details.provider = "Also changed";
  assert.equal((await store.read()).tasks[0].details.provider, "Example Energy");
  await assert.rejects(store.updateTask("a", { id: "b" }));
  await assert.rejects(store.updateTask("a", { amount: NaN }));
  store.close();
  await assert.rejects(store.read(), /closed/);
  await assert.rejects(openLocalStore({ indexedDB: null }), /unavailable/);
});

test("storage budget failure preserves an exportable snapshot", async () => {
  const { store } = await fixture();
  await store.createTask(task("a"));
  const payload = Object.fromEntries(Array.from({ length: 60 }, (_, i) => ["field" + i, "x".repeat(100000)]));
  await assert.rejects(store.updateTask("a", { payload }), /5 MB/);
  assert.deepEqual(parseBackup(await store.exportBackup()).tasks, [task("a")]);
  store.close();
});

