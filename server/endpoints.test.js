// Run with:  node --test server/endpoints.test.js
// Runs api/mon-ia.js and api/cron/mon-ia-digest.js against a FAKE Google, Supabase and Resend.
import test from "node:test";
import assert from "node:assert/strict";
import chat from "../api/mon-ia.js";
import digest from "../api/cron/mon-ia-digest.js";
import { PRIVACY_VERSION } from "../src/components/sections/ActivityCenter/MyAI/privacyPolicy.js";
import { CANNED } from "./monIaLogic.js";

const ID = "3f2b8c1e-9d4a-4b6e-8a1c-2d5e7f9a0b3c";
const realFetch = globalThis.fetch;
process.env.GEMINI_API_KEY = "test-gemini";
process.env.GEMINI_MODEL = "gemini-test";
process.env.SUPABASE_URL = "https://abc.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "sb_secret_test";
process.env.RESEND_API_KEY = "re_test";
process.env.DIGEST_TO_EMAIL = "me@example.com";
process.env.CRON_SECRET = "cron-secret";

let ipCounter = 0;
const nextIp = () => `10.0.0.${++ipCounter}`;
const mkRes = () => {
  const r = { code: 200, headers: {}, body: undefined };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
};
const ask = async (content, over = {}) => {
  const req = {
    method: "POST", headers: { host: "site.test", origin: "https://site.test", "x-forwarded-for": nextIp(), ...(over.headers || {}) },
    body: { consent: PRIVACY_VERSION, conversationId: ID, messages: [{ role: "user", content }], ...(over.body || {}) },
  };
  if (over.method) req.method = over.method;
  const res = mkRes();
  await chat(req, res);
  return res;
};

// a fake internet: tells each fake service what to do, and remembers every call
function fakeNet({ gemini = { text: "Akpos builds useful things." }, geminiStatus = 200, supabaseOk = true, rows = [], resendOk = true } = {}) {
  const calls = { gemini: [], inserts: [], emails: [], patches: [], deletes: [], reads: 0 };
  const queue = [...rows];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) {
      calls.gemini.push(JSON.parse(init.body));
      return { ok: geminiStatus === 200, status: geminiStatus, json: async () => gemini.raw || { candidates: [{ content: { parts: [{ text: gemini.text }] } }] } };
    }
    if (u.includes("/rest/v1/mon_ia_messages")) {
      if (init.method === "POST") { calls.inserts.push(JSON.parse(init.body)); return { ok: supabaseOk, status: supabaseOk ? 201 : 500 }; }
      if (init.method === "PATCH") { calls.patches.push(u); return { ok: true, status: 204 }; }
      if (init.method === "DELETE") { calls.deletes.push(u); return { ok: true, status: 204 }; }
      calls.reads += 1;
      return { ok: true, status: 200, json: async () => queue.splice(0, 400) };
    }
    if (u.includes("api.resend.com")) {
      calls.emails.push(JSON.parse(init.body));
      return { ok: resendOk, status: resendOk ? 200 : 403, json: async () => (resendOk ? { id: "em_1" } : { message: "nope" }) };
    }
    throw new Error(`unexpected fetch: ${u}`);
  };
  return calls;
}
test.afterEach(() => { globalThis.fetch = realFetch; });

test("chat: a normal question gets an answer, and the exchange is recorded without IP or device details", async () => {
  const net = fakeNet({ gemini: { text: "Akpos works across development and security." } });
  const res = await ask("What does he do?");
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { reply: "Akpos works across development and security.", kind: "answer" });
  assert.equal(net.inserts.length, 1);
  assert.deepEqual(net.inserts[0], { conversation_id: ID, question: "What does he do?", answer: "Akpos works across development and security.", kind: "answer", policy_version: PRIVACY_VERSION });
  const sent = net.gemini[0];
  assert.ok(sent.systemInstruction.parts[0].text.includes("Life is good") && sent.systemInstruction.parts[0].text.includes("Ughelli North"));
  assert.ok(!sent.systemInstruction.parts[0].text.includes("ISC2")); // the draft credentials never reach the AI
});

test("chat: age questions get the exact sentence and the AI is never asked", async () => {
  const net = fakeNet();
  const res = await ask("How old is Akpos?");
  assert.equal(res.body.reply, CANNED.age);
  assert.equal(res.body.kind, "age");
  assert.equal(net.gemini.length, 0);
  assert.equal(net.inserts[0].kind, "age");
});

test("chat: control tokens from the AI become the exact canned sentences", async () => {
  for (const [token, kind] of [["[[AGE]]", "age"], ["[[REFUSE]]", "refuse"], ["[[PRIVATE]]", "private"]]) {
    fakeNet({ gemini: { text: token } });
    const res = await ask(`question for ${kind}`);
    assert.equal(res.body.reply, CANNED[kind]);
    assert.equal(res.body.kind, kind);
  }
});

test("chat: the AI cannot sneak in links that are not in the knowledge base", async () => {
  fakeNet({ gemini: { text: "See https://github.com/akpoyovwire and https://evil.example.com/x or mail fake@evil.com." } });
  const res = await ask("Where can I see his code?");
  assert.ok(res.body.reply.includes("https://github.com/akpoyovwire"));
  assert.ok(!res.body.reply.includes("evil"));
});

test("chat: a Google safety block becomes the refusal sentence", async () => {
  fakeNet({ gemini: { raw: { promptFeedback: { blockReason: "SAFETY" } } } });
  const res = await ask("something nasty");
  assert.equal(res.body.reply, CANNED.refuse);
});

test("chat: Google errors give a friendly 502 and record nothing", async () => {
  const net = fakeNet({ geminiStatus: 500 });
  const res = await ask("hello there");
  assert.equal(res.code, 502);
  assert.ok(res.body.error.includes("unavailable"));
  assert.equal(net.inserts.length, 0);
});

test("chat: if recording fails the visitor still gets their answer", async () => {
  fakeNet({ supabaseOk: false });
  const res = await ask("What is his tagline?");
  assert.equal(res.code, 200);
  assert.ok(res.body.reply.length > 0);
});

test("chat: the consent, origin and method rules", async () => {
  fakeNet();
  assert.equal((await ask("hi", { body: { consent: "old" } })).code, 400);
  assert.equal((await ask("hi", { body: { consent: undefined } })).code, 400);
  assert.equal((await ask("hi", { headers: { origin: "https://evil.com" } })).code, 403);
  assert.equal((await ask("hi", { method: "GET" })).code, 405);
  assert.equal((await ask("x".repeat(600))).code, 400);
});

test("chat: missing settings give a clear error and never crash", async () => {
  fakeNet();
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal((await ask("hi")).code, 500);
  process.env.GEMINI_API_KEY = saved;
});

test("chat: the 9th quick message from one visitor is rate limited", async () => {
  fakeNet();
  const ip = "10.9.9.9";
  const results = [];
  for (let i = 0; i < 10; i++) results.push((await ask("hello", { headers: { "x-forwarded-for": ip } })).code);
  assert.deepEqual(results.slice(0, 8), Array(8).fill(200));
  assert.equal(results[8], 429);
});

// ---------- the weekly digest ----------
const row = (id, convo, at, q, a) => ({ id, conversation_id: convo, created_at: at, question: q, answer: a, kind: "answer" });
const cron = async (headers = { authorization: "Bearer cron-secret" }, method = "GET") => {
  const res = mkRes();
  await digest({ method, headers }, res);
  return res;
};

test("digest: refuses strangers and wrong methods", async () => {
  const net = fakeNet();
  assert.equal((await cron({})).code, 401);
  assert.equal((await cron({ authorization: "Bearer wrong" })).code, 401);
  assert.equal((await cron({ authorization: "cron-secret" })).code, 401);
  assert.equal((await cron(undefined, "POST")).code, 405);
  assert.equal(net.emails.length, 0);
});

test("digest: emails the unsent chats, marks them as sent, and cleans up old ones", async () => {
  const net = fakeNet({ rows: [row(1, ID, "2026-10-20T10:00:00Z", "Who is Akpos?", "A problem solver."), row(2, ID, "2026-10-20T10:01:00Z", "<b>hi</b>", "Hello")] });
  const res = await cron();
  assert.equal(res.code, 200);
  assert.equal(res.body.emails, 1);
  assert.equal(res.body.messages, 2);
  assert.equal(net.emails[0].to[0], "me@example.com");
  assert.ok(net.emails[0].subject.includes("1 conversation, 2 messages"));
  assert.ok(net.emails[0].text.includes("Who is Akpos?") && net.emails[0].html.includes("&lt;b&gt;hi&lt;/b&gt;"));
  assert.ok(net.patches[0].endsWith("?id=in.(1,2)"));
  assert.equal(net.deletes.length, 1);
});

test("digest: with nothing new it still sends one short 'no conversations' email", async () => {
  const net = fakeNet({ rows: [] });
  const res = await cron();
  assert.equal(res.code, 200);
  assert.equal(net.emails.length, 1);
  assert.ok(net.emails[0].subject.includes("no new conversations"));
  assert.equal(net.patches.length, 0);
});

test("digest: if the email fails, nothing is marked as sent (so next time it is tried again)", async () => {
  const net = fakeNet({ rows: [row(1, ID, "2026-10-20T10:00:00Z", "q", "a")], resendOk: false });
  const res = await cron();
  assert.equal(res.code, 502);
  assert.equal(net.patches.length, 0);
  assert.equal(net.deletes.length, 0);
});

test("digest: more than 400 chats are sent in several emails", async () => {
  const rows = Array.from({ length: 900 }, (_, i) => row(i + 1, ID, "2026-10-20T10:00:00Z", `q${i}`, `a${i}`));
  const net = fakeNet({ rows });
  const res = await cron();
  assert.equal(res.body.emails, 3);
  assert.equal(res.body.messages, 900);
  assert.equal(net.patches.length, 3);
});

test("chat: after an age question, the AI is not shown the fixed reply, so 'how are you' gets a real answer", async () => {
  const net = fakeNet({ gemini: { text: "I'm doing well, thank you. Ask me anything about Akpos." } });
  const res = await ask("how are you", { body: { messages: [
    { role: "user", content: "How old is Akpos?" }, { role: "assistant", content: CANNED.age }, { role: "user", content: "how are you" },
  ] } });
  assert.equal(res.body.kind, "answer");
  assert.ok(res.body.reply.includes("doing well"));
  const sent = JSON.stringify(net.gemini[0].contents);
  assert.ok(!sent.includes("Fuel in Nigeria") && !sent.includes("How old is Akpos"));
  assert.equal(net.gemini[0].contents.length, 1);
});

test("chat: the answer is sent without waiting for the database save, and timing is reported", async () => {
  fakeNet({ gemini: { text: "Akpos builds useful things." } });
  const base = globalThis.fetch;
  globalThis.fetch = async (u, i) => {
    if (String(u).includes("/rest/v1/mon_ia_messages") && i?.method === "POST") await new Promise((r) => setTimeout(r, 300));
    return base(u, i);
  };
  const res = mkRes();
  let sentAt = 0;
  const json = res.json;
  res.json = (b) => { sentAt = Date.now(); return json(b); };
  const t0 = Date.now();
  await chat({ method: "POST", headers: { host: "site.test", origin: "https://site.test", "x-forwarded-for": nextIp() },
    body: { consent: PRIVACY_VERSION, conversationId: ID, messages: [{ role: "user", content: "What does he do?" }] } }, res);
  assert.ok(sentAt - t0 < 200, `reply took ${sentAt - t0} ms`);
  assert.ok(Date.now() - t0 >= 290); // the save still finished before the function ended
  assert.match(res.headers["Server-Timing"], /google;dur=\d+, total;dur=\d+/);
});

test("chat: if Google never answers, the visitor gets a clear timeout instead of waiting forever", async () => {
  globalThis.fetch = (u, init = {}) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  const res = await Promise.race([ask("hello there"), new Promise((r) => setTimeout(() => r("HUNG"), 17000))]);
  assert.equal(res.code, 504);
});