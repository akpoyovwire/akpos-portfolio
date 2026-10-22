// Run with:  node --test server/monIaSpeed.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { callGemini, callModels, groqAttempts, parseModels, createAnswerCache, DEFAULT_FALLBACK_MODELS } from "./monIaSpeed.js";

const OK = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const FAIL = (status) => ({ ok: false, status, json: async () => ({}) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const modelOf = (url) => /models\/([^:]+):/.exec(String(url))[1];
// a fake Google: behaviours[model] is a function (signal) => response promise
function fake(behaviours) {
  const calls = [];
  const f = async (url, init) => {
    const m = modelOf(url);
    calls.push(m);
    return behaviours[m](init.signal);
  };
  f.calls = calls;
  return f;
}
const hang = (signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
const run = (fetchImpl, over = {}) => callGemini({ apiKey: "k", models: ["a", "b", "c"], body: { x: 1 }, fetchImpl, hedgeMs: 60, deadlineMs: 600, ...over });

test("model list: safe names only, no duplicates, defaults are sensible", () => {
  assert.deepEqual(parseModels("b, c ,b,,bad name,../x", ["a"]), ["a", "b", "c"]);
  assert.deepEqual(parseModels(undefined), []);
  assert.deepEqual(parseModels(DEFAULT_FALLBACK_MODELS), ["gemini-3.1-flash-lite", "gemini-3.5-flash"]);
});

test("fast main model: only one request is made", async () => {
  const f = fake({ a: async () => OK("hi"), b: async () => OK("no"), c: async () => OK("no") });
  const r = await run(f);
  assert.equal(r.ok, true);
  assert.equal(r.model, "a");
  assert.deepEqual(f.calls, ["a"]);
});

test("main model returns 503: the next model is asked straight away, not after the wait", async () => {
  const f = fake({ a: async () => FAIL(503), b: async () => OK("from b"), c: async () => OK("c") });
  const r = await run(f, { hedgeMs: 5000 });
  assert.equal(r.model, "b");
  assert.ok(r.ms < 500, `${r.ms} ms`);
  assert.deepEqual(r.failures, [{ model: "a", status: 503 }]);
});

test("main model is slow: the next model is asked too, the faster answer wins, the slow request is cancelled", async () => {
  let aCancelled = false;
  const f = fake({
    a: (signal) => new Promise((_, rej) => signal.addEventListener("abort", () => { aCancelled = true; rej(new Error("x")); })),
    b: async () => OK("from b"),
    c: async () => OK("c"),
  });
  const r = await run(f);
  assert.equal(r.model, "b");
  assert.ok(r.ms >= 50 && r.ms < 400, `${r.ms} ms`);
  assert.equal(aCancelled, true);
});

test("a slow main model that answers before the wait is over means no second request", async () => {
  const f = fake({ a: async () => { await sleep(20); return OK("a"); }, b: async () => OK("b"), c: async () => OK("c") });
  const r = await run(f, { hedgeMs: 300 });
  assert.equal(r.model, "a");
  assert.deepEqual(f.calls, ["a"]);
});

test("a model that no longer exists (404) is skipped", async () => {
  const f = fake({ a: async () => FAIL(404), b: async () => FAIL(429), c: async () => OK("c") });
  const r = await run(f);
  assert.equal(r.model, "c");
  assert.deepEqual(r.failures.map((x) => x.status), [404, 429]);
});

test("everything failing gives a failure with the last status, and every model was tried", async () => {
  const f = fake({ a: async () => FAIL(503), b: async () => FAIL(503), c: async () => FAIL(500) });
  const r = await run(f);
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
  assert.equal(r.failures.length, 3);
});

test("a wrong key (401/403) stops at once: other models would fail the same way", async () => {
  const f = fake({ a: async () => FAIL(403), b: async () => OK("b"), c: async () => OK("c") });
  const r = await run(f);
  assert.equal(r.ok, false);
  assert.equal(r.fatal, true);
  assert.deepEqual(f.calls, ["a"]);
});

test("nobody answers: a clear timeout at the deadline, and nothing is left running", async () => {
  const f = fake({ a: hang, b: hang, c: hang });
  const r = await run(f, { deadlineMs: 200 });
  assert.equal(r.ok, false);
  assert.equal(r.status, 504);
  assert.ok(r.ms >= 190 && r.ms < 500, `${r.ms} ms`);
});

test("network errors and broken replies count as failures and fall through", async () => {
  const f = fake({
    a: async () => { throw new TypeError("fetch failed"); },
    b: async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }),
    c: async () => OK("c"),
  });
  const r = await run(f);
  assert.equal(r.model, "c");
});

test("no models configured: a clear failure, no crash", async () => {
  const r = await run(fake({}), { models: [] });
  assert.equal(r.ok, false);
});

test("answer cache: same first question (any case, spacing, final punctuation) hits; expires; stays small", () => {
  let t = 0;
  const c = createAnswerCache({ ttlMs: 1000, max: 2, now: () => t });
  const k = c.key("  What does Akpoyovwire MEAN?? ");
  assert.equal(k, "what does akpoyovwire mean");
  assert.equal(c.get(k), null);
  c.set(k, "Life is good.");
  assert.equal(c.get(c.key("what does akpoyovwire mean")), "Life is good.");
  t = 1001;
  assert.equal(c.get(k), null);
  c.set("one", "1"); c.set("two", "2"); c.set("three", "3");
  assert.equal(c.get("one"), null);
  assert.equal(c.get("three"), "3");
  c.set("", "x"); c.set("k", "");
  assert.equal(c.get(""), null);
});

test("Groq request: OpenAI format, system prompt first, low reasoning effort only for gpt-oss models", async () => {
  const seen = [];
  const f = async (url, init) => { seen.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization }); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "  hi  " } }] }) }; };
  const r = await callModels({ attempts: groqAttempts({ apiKey: "gsk", models: ["openai/gpt-oss-20b", "qwen/qwen3.6-27b"], system: "SYS", messages: [{ role: "user", content: "q" }], fetchImpl: f }) });
  assert.equal(r.text, "hi");
  assert.equal(r.model, "groq:openai/gpt-oss-20b");
  assert.equal(seen[0].auth, "Bearer gsk");
  assert.deepEqual(seen[0].body.messages, [{ role: "system", content: "SYS" }, { role: "user", content: "q" }]);
  assert.equal(seen[0].body.reasoning_effort, "low");
  const r2 = await callModels({ attempts: groqAttempts({ apiKey: "gsk", models: ["qwen/qwen3.6-27b"], system: "S", messages: [], fetchImpl: f }) });
  assert.equal(seen[1].body.reasoning_effort, undefined);
  assert.equal(r2.ok, true);
});

test("Groq: empty or odd replies count as failures, and the provider's reason is kept for the logs", async () => {
  const empty = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "" } }] }) });
  assert.equal((await callModels({ attempts: groqAttempts({ apiKey: "k", models: ["m"], system: "s", messages: [], fetchImpl: empty }) })).ok, false);
  const nope = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "unsupported parameter reasoning_effort" } }) });
  const r = await callModels({ attempts: groqAttempts({ apiKey: "k", models: ["m"], system: "s", messages: [], fetchImpl: nope }) });
  assert.deepEqual(r.failures, [{ model: "groq:m", status: 400, detail: "unsupported parameter reasoning_effort" }]);
});

test("two providers: a bad key on one only switches that provider off", async () => {
  const calls = [];
  const mk = (id, provider, out) => ({ id, provider, run: async () => { calls.push(id); return out; } });
  const r = await callModels({ attempts: [mk("g1", "groq", { status: 401 }), mk("g2", "groq", { ok: true, text: "no" }), mk("m1", "gemini", { ok: true, text: "from gemini" })] });
  assert.equal(r.text, "from gemini");
  assert.deepEqual(calls, ["g1", "m1"]); // g2 skipped: same provider, bad key
});

test("a safety block from the AI is passed on as a block, not as an error", async () => {
  const r = await callModels({ attempts: [{ id: "x", provider: "gemini", run: async () => ({ ok: true, blocked: true }) }] });
  assert.equal(r.ok, true);
  assert.equal(r.blocked, true);
});

test("model names: Groq's 'owner/name' form is allowed only when asked for; paths and odd names are always refused", () => {
  assert.deepEqual(parseModels("openai/gpt-oss-20b", ["openai/gpt-oss-120b"], { slash: true }), ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  assert.deepEqual(parseModels("openai/gpt-oss-20b, gemini-3.1-flash-lite"), ["gemini-3.1-flash-lite"]); // no slash for Gemini
  assert.deepEqual(parseModels("../x, a/b/c, /a, a/, a/..", [], { slash: true }), []);
});