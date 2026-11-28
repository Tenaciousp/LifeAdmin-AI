import test from "node:test";
import assert from "node:assert/strict";
import { composeInAppFollowUp, requestInAppFollowUp, retainProviderEmail, runAndClearEphemeralInput } from "./in-app-followup.mjs";
test("follow-up carries request, answer and user question in order", () => {
 const value=composeInAppFollowUp({originalRequest:"Compare broadband",currentAnswer:"Current result",followUpQuestion:"Include fees"});
 assert.ok(value.indexOf("Compare broadband")<value.indexOf("Current result"));
 assert.ok(value.indexOf("Current result")<value.indexOf("Include fees"));
 assert.match(value,/Do not invent prices/);
});
test("follow-up rejects missing context",()=>assert.throws(()=>composeInAppFollowUp({originalRequest:"x",currentAnswer:"",followUpQuestion:"y"}),/currentAnswer is required/));
test("follow-up rejects oversized request before provider call",()=>assert.throws(()=>composeInAppFollowUp({originalRequest:"x".repeat(12000),currentAnswer:"y".repeat(5000),followUpQuestion:"z".repeat(4000)}),/20,000 character limit/));

test("Gemini live-comparison follow-up asks for fresh source-backed research", async () => {
  const calls = [];
  const result = await requestInAppFollowUp({
    prompt: "question", output: "plan", method: "gemini_api", provider: "gemini", apiKey: "",
    liveComparison: true,
    generateDraft: async (...args) => calls.push(["draft", ...args]),
    generateComparison: async (...args) => { calls.push(["comparison", ...args]); return "sourced"; },
    generateCustomer: async (...args) => calls.push(["customer", ...args]),
  });
  assert.equal(result, "sourced");
  assert.deepEqual(calls, [["comparison", "question"]]);
});

test("customer-provider follow-up retains provider and requests fresh sources for comparisons", async () => {
  const calls = [];
  await requestInAppFollowUp({
    prompt: "question", output: "plan", method: "customer_api", provider: "anthropic", apiKey: "ephemeral-key",
    liveComparison: true, generateDraft: async () => {}, generateComparison: async () => {},
    generateCustomer: async (...args) => { calls.push(args); return "sourced"; },
  });
  assert.deepEqual(calls, [["question", "plan", "anthropic", "ephemeral-key", true]]);
});

test("ordinary AI follow-up keeps its output type and does not request search", async () => {
  const calls = [];
  await requestInAppFollowUp({
    prompt: "question", output: "letter", method: "gemini_api", provider: "gemini", apiKey: "",
    liveComparison: false,
    generateDraft: async (...args) => { calls.push(args); }, generateComparison: async () => {}, generateCustomer: async () => {},
  });
  assert.deepEqual(calls, [["question", "letter"]]);
});

test("a comparison follow-up preserves the user's edited provider email", () => {
  assert.deepEqual(retainProviderEmail(
    { messageSubject: "My edited subject", messageBody: "My edited email" },
    { messageSubject: "AI subject", messageBody: "AI email" },
  ), { messageSubject: "My edited subject", messageBody: "My edited email" });
});

test("ephemeral input clears after a successful provider request", async () => {
  const events = [];
  const result = await runAndClearEphemeralInput(async () => { events.push("request"); return "answer"; }, () => events.push("clear"));
  assert.equal(result, "answer");
  assert.deepEqual(events, ["request", "clear"]);
});

test("ephemeral input clears after a rejected provider request and preserves the error", async () => {
  const events = [];
  await assert.rejects(runAndClearEphemeralInput(async () => { events.push("request"); throw new Error("network failed"); }, () => events.push("clear")), /network failed/);
  assert.deepEqual(events, ["request", "clear"]);
});
