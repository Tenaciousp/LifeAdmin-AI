import { test } from "node:test";
import assert from "node:assert/strict";
import { aiDraftAvailable, aiDraftConfigured, customerKeyAiAvailable, generateCustomerAi, generateLiveComparison, liveComparisonAvailable, generateWithGemini } from "./ai-generation.mjs";

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

test("live comparison availability requires its own explicit server signal", async () => {
  assert.equal(await liveComparisonAvailable(async () => reply(200, { live_comparisons_available: true })), true);
  for (const result of [reply(200, {}), reply(200, { live_comparisons_available: "true" }), reply(503, { live_comparisons_available: true })]) {
    assert.equal(await liveComparisonAvailable(async () => result), false);
  }
});

test("live comparison sends only the approved prompt and requires complete grounded evidence", async () => {
  let request;
  const payload = { body: "Current result", sources: [{ title: "Provider offer", url: "https://example.test/offer" }],
    citations: [], search_suggestions_html: "<a>Related search</a>", checked_at: "2026-11-20T12:00:00Z", model: "gemini-test" };
  const result = await generateLiveComparison("Reviewed comparison request", async (url, init) => {
    request = { url, init }; return reply(200, payload);
  });
  assert.equal(request.url, "/api/ai/comparison");
  assert.equal(request.init.credentials, "omit");
  assert.deepEqual(JSON.parse(request.init.body), { prompt: "Reviewed comparison request", consent: true });
  assert.equal(result.body, payload.body);
  assert.equal(result.grounding.sources[0].url, payload.sources[0].url);
  await assert.rejects(generateLiveComparison(" ", async () => reply(200, payload)), /request/);
  await assert.rejects(generateLiveComparison("request", async () => reply(200, { ...payload, search_suggestions_html: "" })), /source evidence/);
  await assert.rejects(generateLiveComparison("request", async () => reply(200, { ...payload, sources: [{ title: "bad", url: "http://example.test" }] })), /valid HTTPS source/);
  await assert.rejects(generateLiveComparison("request", async () => reply(429, {})), /usage limit/);
});

test("customer-key AI sends a one-request key in a header and keeps it out of the body", async () => {
  let request;
  const key = "synthetic-not-a-real-key";
  const result = await generateCustomerAi("Reviewed synthetic request", "letter", "openai", key, false, async (url, init) => {
    request = { url, init };
    return reply(200, { body: "Synthetic answer", model: "fixture-model" });
  });
  assert.equal(request.url, "/api/ai/customer");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.credentials, "omit");
  assert.equal(request.init.headers["X-Customer-Provider-Key"], key);
  assert.deepEqual(JSON.parse(request.init.body), {
    prompt: "Reviewed synthetic request", output: "letter", provider: "openai", search: false, consent: true,
  });
  assert.doesNotMatch(request.init.body, /synthetic-not-a-real-key/);
  assert.deepEqual(result, { body: "Synthetic answer", grounding: null, model: "fixture-model" });
});

test("customer-key research requires dated HTTPS sources and the server flag stays explicit", async () => {
  const payload = { body: "Synthetic comparison", sources: [{ title: "Fictional offer", url: "https://offers.provider.example/offer" }], checked_at: "2026-11-24T10:00:00Z", model: "fixture-model" };
  const result = await generateCustomerAi("Synthetic comparison request", "plan", "gemini", "synthetic-not-a-real-key", true, async () => reply(200, payload));
  assert.equal(result.grounding.sources[0].url, payload.sources[0].url);
  await assert.rejects(generateCustomerAi("Synthetic comparison request", "plan", "gemini", "synthetic-not-a-real-key", true, async () => reply(200, { ...payload, sources: [] })), /source evidence/);
  await assert.rejects(generateCustomerAi("Synthetic comparison request", "plan", "gemini", "synthetic-not-a-real-key", true, async () => reply(200, { ...payload, sources: [{ title: "Bad", url: "http://provider.example/offer" }] })), /valid HTTPS sources/);
  for (const value of [reply(200, {}), reply(200, { customer_key_ai_available: "true" }), reply(503, { customer_key_ai_available: true })]) {
    assert.equal(await customerKeyAiAvailable(async () => value), false);
  }
  assert.equal(await customerKeyAiAvailable(async () => reply(200, { customer_key_ai_available: true })), true);
});

test("customer-key AI validation and quota errors keep safe handoff wording", async () => {
  let called = false;
  const fetcher = async () => { called = true; return reply(200, { body: "unused" }); };
  await assert.rejects(generateCustomerAi(" ", "letter", "openai", "synthetic-not-a-real-key", false, fetcher), /request/);
  await assert.rejects(generateCustomerAi("request", "unknown", "openai", "synthetic-not-a-real-key", false, fetcher), /plan, letter or reply/);
  await assert.rejects(generateCustomerAi("request", "letter", "unsupported", "synthetic-not-a-real-key", false, fetcher), /supported AI provider/);
  await assert.rejects(generateCustomerAi("request", "letter", "openai", "short", false, fetcher), /provider API key/);
  assert.equal(called, false);
  await assert.rejects(generateCustomerAi("request", "letter", "openai", "synthetic-not-a-real-key", false, async () => reply(503, {})), /not enabled for this version/);
  await assert.rejects(generateCustomerAi("request", "letter", "openai", "synthetic-not-a-real-key", false, async () => reply(429, { error: "Usage limit. Check its billing." })), /usage limit/i);
});
