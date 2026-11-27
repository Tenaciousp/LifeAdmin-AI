import test from "node:test";
import assert from "node:assert/strict";
import { copyAndSaveBillHelp } from "./bill-help-handoff.mjs";

function fixture({ clipboard = "ok", save = "ok" } = {}) {
  const events = [];
  return {
    events,
    options: {
      copyPrompt() { events.push("copy"); return clipboard === "deny" ? Promise.reject(new Error("clipboard denied")) : Promise.resolve(); },
      saveProgress() { events.push("save"); return save === "deny" ? Promise.reject(new Error("save failed")) : Promise.resolve(); },
    },
  };
}

test("copy tap requests clipboard before the save await; assistant opening remains separate", async () => {
  const f = fixture();
  const result = await copyAndSaveBillHelp({ copyPrompt: f.options.copyPrompt, saveProgress: f.options.saveProgress });
  assert.deepEqual(f.events, ["copy", "save"]);
  assert.deepEqual(result, { saved: true, copied: true, error: null });
});

test("clipboard rejection is reported separately after progress saves for manual copy", async () => {
  const f = fixture({ clipboard: "deny" });
  const result = await copyAndSaveBillHelp({ copyPrompt: f.options.copyPrompt, saveProgress: f.options.saveProgress });
  assert.deepEqual(f.events, ["copy", "save"]);
  assert.equal(result.saved, true);
  assert.equal(result.copied, false);
  assert.match(result.error.message, /clipboard denied/);
});

test("save rejection never returns a saved result; clipboard rejection is already handled", async () => {
  const f = fixture({ clipboard: "deny", save: "deny" });
  await assert.rejects(copyAndSaveBillHelp({ copyPrompt: f.options.copyPrompt, saveProgress: f.options.saveProgress }), /save failed/);
  assert.deepEqual(f.events, ["copy", "save"]);
});

test("destination remains a separate allowlisted link, not a popup in the copy handler", async () => {
  const f = fixture();
  await copyAndSaveBillHelp({ copyPrompt: f.options.copyPrompt, saveProgress: f.options.saveProgress });
  assert.equal(f.events.includes("popup"), false);
  assert.equal(f.events.includes("navigate"), false);
});
