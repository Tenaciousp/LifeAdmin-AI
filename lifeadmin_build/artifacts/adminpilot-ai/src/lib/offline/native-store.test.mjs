import { test } from "node:test";
import assert from "node:assert/strict";
import { openNativeStore } from "./native-store.mjs";
import { generateAndSaveLocalPlan } from "./plans.mjs";

globalThis.fetch = () => { throw new Error("Unexpected network request"); };
function database() {
  let revision = "empty", snapshot = null, fail = false, writes = 0;
  return {
    async read() { return { revision, snapshot }; },
    async write(input) {
      if (input.expectedRevision !== revision) throw Object.assign(new Error("Conflict"), { code: "conflict" });
      if (fail) { fail = false; throw new Error("Injected commit failure"); }
      snapshot = input.snapshot; revision = String(++writes);
      return { revision };
    },
    failNext() { fail = true; },
    corrupt() { snapshot = "{broken"; revision = "corrupt"; },
  };
}
const bill = { id: "bill", title: "Energy renewal", category_id: "energy_water", goal_id: "prepare_renewal", details: {} };

test("native repository reconnect and planning round trip", async () => {
  const bridge = database(), store = await openNativeStore(bridge);
  await store.createTask(bill);
  const plan = await generateAndSaveLocalPlan(store, bill.id);
  const exported = await store.exportBackup();
  store.close();
  const reopened = await openNativeStore(bridge);
  assert.deepEqual((await reopened.read()).plans, [plan]);
  await reopened.clear();
  await reopened.importBackup(exported, { replace: true });
  assert.deepEqual((await reopened.read()).plans, [plan]);
});

test("concurrent connections preserve independent edits through revision checks", async () => {
  const bridge = database(), first = await openNativeStore(bridge), second = await openNativeStore(bridge);
  await first.createTask(bill);
  await Promise.all([first.updateTask("bill", { status: "Done" }), second.updateTask("bill", { notes: "Updated" })]);
  const result = (await first.read()).tasks[0];
  assert.equal(result.status, "Done"); assert.equal(result.notes, "Updated");
});

test("failed save and replacement retain prior committed records", async () => {
  const bridge = database(), store = await openNativeStore(bridge);
  await store.createTask(bill);
  const before = await store.read();
  bridge.failNext();
  await assert.rejects(store.updateTask("bill", { title: "Changed" }), /Injected/);
  assert.deepEqual(await store.read(), before);
  const replacement = JSON.stringify({ format: "lifeadmin-backup", version: 1, tasks: [], plans: [] });
  bridge.failNext();
  await assert.rejects(store.importBackup(replacement, { replace: true }), /Injected/);
  assert.deepEqual(await store.read(), before);
  await store.updateTask("bill", { notes: "Queue recovered" });
  assert.equal((await store.read()).tasks[0].notes, "Queue recovered");
});

test("bad imports, duplicate records and orphaned plans fail before replacement", async () => {
  const store = await openNativeStore(database()); await store.createTask(bill);
  assert.throws(() => store.createTask({ ...bill, notes: undefined }), /Invalid backup/);
  await assert.rejects(store.createTask(bill), /already exists/);
  await assert.rejects(store.savePlan({ id: "plan", title: "", task_id: "missing", content: "" }), /Save the bill/);
  assert.throws(() => store.importBackup("{}", { replace: true }), /Unsupported/);
  assert.throws(() => store.importBackup("{}"), /Confirm replacement/);
  const oversized = JSON.stringify({ format: "lifeadmin-backup", version: 1, tasks: Array.from({length: 60}, (_, id) => ({ id: String(id), title: "", notes: "x".repeat(100000) })), plans: [] });
  assert.throws(() => store.importBackup(oversized, { replace: true }), /5 MB/);
  assert.deepEqual((await store.read()).tasks, [bill]);
});

test("bill deletion removes associated plans in one saved snapshot", async () => {
  const store = await openNativeStore(database()); await store.createTask(bill);
  await generateAndSaveLocalPlan(store, "bill");
  await store.deleteTask("bill");
  assert.deepEqual(await store.read(), { tasks: [], plans: [] });
});

test("corrupt native records fail closed and never become an empty workspace", async () => {
  const bridge = database(); bridge.corrupt();
  await assert.rejects(openNativeStore(bridge), /valid JSON/);
  await assert.rejects(openNativeStore({ read: async () => ({ revision: "existing", snapshot: null }) }), /unavailable/);
});

test("caller copies, queued inputs and closed connections remain isolated", async () => {
  const store = await openNativeStore(database());
  const input = structuredClone(bill), saving = store.createTask(input); input.title = "Mutated";
  await saving;
  const data = await store.read(); data.tasks[0].title = "Mutated again";
  assert.equal((await store.read()).tasks[0].title, bill.title);
  assert.throws(() => store.updateTask("bill", { id: "different" }), /Invalid bill/);
  store.close();
  await assert.rejects(store.read(), /closed/);
});

test("persistent conflict errors stop after bounded retries", async () => {
  let attempts = 0;
  const store = await openNativeStore({
    read: async () => ({ revision: "empty", snapshot: null }),
    write: async () => { attempts++; throw Object.assign(new Error("Conflict"), { code: "conflict" }); },
  });
  await assert.rejects(store.createTask(bill), /Conflict/); assert.equal(attempts, 4);
});

test("rejected native backup inputs preserve bills and plans without writing", async () => {
  const bridge = database();
  let writes = 0;
  const write = bridge.write;
  bridge.write = async input => { writes++; return write(input); };
  const store = await openNativeStore(bridge);
  await store.createTask(bill);
  await store.savePlan({ id: "saved", task_id: bill.id, title: "Saved plan", content: "Keep this plan." });
  const before = await store.read();
  const committedWrites = writes;
  const backup = (tasks = [], plans = [], version = 1) =>
    JSON.stringify({ format: "lifeadmin-backup", version, tasks, plans });
  const rejected = [
    ["malformed JSON", "{broken", /valid JSON/],
    ["unsupported format", "{}", /Unsupported/],
    ["future version", backup([], [], 2), /Unsupported/],
    ["duplicate bills", backup([bill, bill]), /duplicate/],
    ["duplicate plans", backup([bill], [before.plans[0], before.plans[0]]), /duplicate/],
    ["orphaned plan", backup([], before.plans), /matching bill/],
    ["forbidden field", '{"format":"lifeadmin-backup","version":1,"tasks":[],"plans":[],"__proto__":{}}', /Invalid backup field/],
    ["oversized file", "x".repeat(5 * 1024 * 1024 + 1), /5 MB/],
  ];
  for (const [label, text, expected] of rejected) {
    assert.throws(() => store.importBackup(text, { replace: true }), expected, label);
    assert.equal(writes, committedWrites, label + " reached native write");
    assert.deepEqual(await store.read(), before, label + " changed records");
  }
  assert.throws(() => store.importBackup(backup()), /Confirm replacement/);
  assert.equal(writes, committedWrites);
  store.close();
  const reopened = await openNativeStore(bridge);
  assert.deepEqual(await reopened.read(), before);
  reopened.close();
});
