import { test } from "node:test";
import assert from "node:assert/strict";
import { aiDraftAvailable, aiDraftConfigured, generateWithGemini } from "./ai-generation.mjs";

const reply = (status, payload) => ({ status, async json() { return payload; } });
const valid = { subject: "Bill query", body: "Please explain the new charge." };

test("Gemini generation sends only the reviewed prompt and output to HomeAdmin's proxy", async () => {
  let request;
  const result = await generateWithGemini("Reviewed bill facts", "letter", async (url, init) => {
    request = { url, init };
    return reply(200, valid);
  });
  assert.deepEqual(result, valid);
  assert.equal(request.url, "/api/ai/draft");
  assert.equal(request.init.credentials, "omit");
  assert.deepEqual(JSON.parse(request.init.body), { prompt: "Reviewed bill facts", output: "letter", consent: true });
  assert.equal(request.init.headers.Authorization, undefined);
  assert.equal(aiDraftConfigured(), true);
});

test("Gemini request validation rejects empty, oversized and unsupported inputs", async () => {
  let called = false;
  const fetcher = async () => { called = true; return reply(200, valid); };
  await assert.rejects(generateWithGemini(" ", "letter", fetcher), /request/);
  await assert.rejects(generateWithGemini("x".repeat(20001), "plan", fetcher), /20,000/);
  await assert.rejects(generateWithGemini("prompt", "unknown", fetcher), /plan, letter or reply/);
  assert.equal(called, false);
});

test("Gemini service errors provide safe retry and Copilot fallbacks", async () => {
  await assert.rejects(generateWithGemini("prompt", "plan", async () => reply(503, {})), /not available yet/);
  await assert.rejects(generateWithGemini("prompt", "plan", async () => reply(429, {})), /usage limit/);
  await assert.rejects(generateWithGemini("prompt", "plan", async () => { throw new Error("private network detail"); }), /Check your connection/);
  await assert.rejects(generateWithGemini("prompt", "plan", async () => reply(200, { subject: "", body: "" })), /incomplete/);
});

test("availability requires an explicit server signal and sends no bill data", async () => {
  let request;
  assert.equal(await aiDraftAvailable(async (url, init) => { request = {url, init}; return reply(200, {ai_drafts_available: true}); }), true);
  assert.equal(request.url, '/api/health');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.body, undefined);
  for (const result of [reply(200, {}), reply(200, {ai_drafts_available: 'true'}), reply(503, {ai_drafts_available: true})]) {
    assert.equal(await aiDraftAvailable(async () => result), false);
  }
  assert.equal(await aiDraftAvailable(async () => { throw Error('offline'); }), false);
});
