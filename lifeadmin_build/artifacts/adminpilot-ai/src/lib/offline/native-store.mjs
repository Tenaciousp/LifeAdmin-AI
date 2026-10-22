import { parseBackup, serialise, record, jsonValue, planWithEditedMessage, assertWorkflowCurrent } from "./storage.mjs";

// Native bridge owns the database transaction. No cached snapshot becomes a save.
export async function openNativeStore(bridge) {
  let closed = false;
  let queue = Promise.resolve();
  function ensureOpen() { if (closed) throw new Error("Device storage is closed."); }
  async function load() {
    ensureOpen();
    const result = await bridge.read();
    if (typeof result.revision !== "string" || !result.revision || result.revision.length > 100) throw new Error("Invalid device storage revision.");
    if (result.snapshot === null && result.revision !== "empty") throw new Error("Device records are unavailable.");
    return { revision: result.revision, data: result.snapshot === null ? { tasks: [], plans: [] } : parseBackup(result.snapshot) };
  }
  // Fail before displaying a blank workspace when records are unreadable.
  await load();
  function mutate(change) {
    const operation = queue.then(async () => {
      ensureOpen();
      for (let attempt = 0; attempt < 4; attempt++) {
        const current = await load();
        const value = change(current.data);
        const snapshot = serialise(current.data);
        parseBackup(snapshot); // Whole snapshot, references and size before replacement.
        try {
          await bridge.write({ expectedRevision: current.revision, snapshot });
          return structuredClone(value);
        } catch (error) {
          if (error?.code !== "conflict" || attempt === 3) throw error;
        }
      }
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return {
    close() { closed = true; },
    async read() { await queue; return (await load()).data; },
    createTask(task) {
      const value = record(task, "task");
      return mutate(data => { if (data.tasks.some(item => item.id === value.id)) throw new Error("Bill already exists."); data.tasks.push(value); return value; });
    },
    updateTask(id, changes) {
      jsonValue(changes);
      if (!changes || Array.isArray(changes) || typeof changes !== "object" || ("id" in changes && changes.id !== id)) throw new Error("Invalid bill changes.");
      const update = structuredClone(changes);
      return mutate(data => {
        const index = data.tasks.findIndex(item => item.id === id);
        if (index < 0) throw new Error("Bill not found.");
        const value = record({ ...data.tasks[index], ...update, id }, "task");
        data.tasks[index] = value;
        return value;
      });
    },
    savePlan(plan) {
      const value = record(plan, "plan");
      return mutate(data => {
        if (!data.tasks.some(item => item.id === value.task_id)) throw new Error("Save the bill before saving its plan.");
        if (data.plans.some(item => item.id === value.id)) throw new Error("Plan already exists.");
        data.plans.push(value); return value;
      });
    },
    saveWorkflowProgress(id, draft, expectedDraft = null) {
      jsonValue(draft);
      if (!draft || Array.isArray(draft) || typeof draft !== "object") throw new Error("Invalid bill-help progress.");
      const input = structuredClone(draft), expected = structuredClone(expectedDraft);
      return mutate(data => {
        const task = data.tasks.find(item => item.id === id);
        if (!task) throw new Error("Bill not found.");
        assertWorkflowCurrent(task, expected);
        task.workflow_draft = input; return task;
      });
    },
    saveWorkflowResult(plan, expectedDraft = null) {
      const value = record(plan, "plan");
      const expected = structuredClone(expectedDraft);
      return mutate(data => {
        const task = data.tasks.find(item => item.id === value.task_id);
        if (!task) throw new Error("Save the bill before saving its result.");
        assertWorkflowCurrent(task, expected);
        if (data.plans.some(item => item.id === value.id)) throw new Error("Result already exists.");
        delete task.workflow_draft;
        data.plans.push(value); return value;
      });
    },
    updatePlanMessage(id, draft, expected) {
      const input = structuredClone(draft), original = structuredClone(expected);
      return mutate(data => {
        const index = data.plans.findIndex(item => item.id === id);
        const value = planWithEditedMessage(data.plans[index], input, original);
        data.plans[index] = value;
        return value;
      });
    },
    deleteTask(id) { return mutate(data => { data.tasks = data.tasks.filter(item => item.id !== id); data.plans = data.plans.filter(item => item.task_id !== id); }); },
    deletePlan(id) { return mutate(data => { data.plans = data.plans.filter(item => item.id !== id); }); },
    clear() { return mutate(data => { data.tasks = []; data.plans = []; }); },
    async exportBackup() { return serialise(await this.read()); },
    importBackup(text, { replace = false } = {}) {
      if (replace !== true) throw new Error("Confirm replacement before restoring a backup.");
      const replacement = parseBackup(text);
      return mutate(data => { data.tasks = structuredClone(replacement.tasks); data.plans = structuredClone(replacement.plans); });
    },
  };
}

