// Run with:  node --test server/monIaServices.test.js
// Tests the database, digest and email helpers with a fake fetch (no internet needed).
import test from "node:test";
import assert from "node:assert/strict";
import { insertMessage, fetchUnsent, markEmailed, purgeEmailed } from "./monIaStore.js";
import { groupConversations, digestSubject, formatDigestText, formatDigestHtml, escapeHtml } from "./monIaDigest.js";
import { sendEmail, EmailError } from "./monIaEmail.js";

const recorder = (reply = { ok: true, status: 200, json: async () => [] }) => {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return typeof reply === "function" ? reply(url, init) : reply; };
  fn.calls = calls;
  return fn;
};
const cfgNew = { url: "https://abc.supabase.co/", key: "sb_secret_abc" };
const cfgJwt = { url: "https://abc.supabase.co", key: "eyJhbGciOi.payload.sig" };

test("insertMessage sends exactly the fields we mean to store, and nothing about the visitor's device", async () => {
  const f = recorder();
  await insertMessage(cfgNew, { conversationId: "c1", question: "Q?", answer: "A.", kind: "answer", policyVersion: "v1", ip: "1.2.3.4", userAgent: "x" }, f);
  const { url, init } = f.calls[0];
  assert.equal(url, "https://abc.supabase.co/rest/v1/mon_ia_messages");
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), { conversation_id: "c1", question: "Q?", answer: "A.", kind: "answer", policy_version: "v1" });
  assert.ok(!init.body.includes("1.2.3.4") && !init.body.includes("userAgent"));
});

test("secret keys: sb_secret_ goes in apikey only; the older JWT key goes in both", async () => {
  const a = recorder(); await insertMessage(cfgNew, { conversationId: "c", question: "q", answer: "a", kind: "answer", policyVersion: "v" }, a);
  assert.equal(a.calls[0].init.headers.apikey, "sb_secret_abc");
  assert.equal(a.calls[0].init.headers.Authorization, undefined);
  const b = recorder(); await insertMessage(cfgJwt, { conversationId: "c", question: "q", answer: "a", kind: "answer", policyVersion: "v" }, b);
  assert.equal(b.calls[0].init.headers.Authorization, `Bearer ${cfgJwt.key}`);
});

test("a failed insert throws (so the caller can log it)", async () => {
  await assert.rejects(insertMessage(cfgNew, { conversationId: "c", question: "q", answer: "a", kind: "answer", policyVersion: "v" }, recorder({ ok: false, status: 401 })), /HTTP 401/);
});

test("fetchUnsent asks only for not-yet-emailed rows, oldest first", async () => {
  const rows = [{ id: 1 }];
  const f = recorder({ ok: true, status: 200, json: async () => rows });
  assert.deepEqual(await fetchUnsent(cfgNew, 50, f), rows);
  assert.ok(f.calls[0].url.includes("emailed_at=is.null") && f.calls[0].url.includes("order=created_at.asc") && f.calls[0].url.includes("limit=50"));
  await assert.rejects(fetchUnsent(cfgNew, 5, recorder({ ok: true, status: 200, json: async () => ({ not: "an array" }) })), /unexpected/);
  await assert.rejects(fetchUnsent(cfgNew, 5, recorder({ ok: false, status: 500 })), /HTTP 500/);
});

test("markEmailed updates only the given ids, and refuses anything that is not a whole number", async () => {
  const f = recorder();
  assert.equal(await markEmailed(cfgNew, [3, 4, 5], "2026-10-26T07:00:00.000Z", f), 3);
  assert.ok(f.calls[0].url.endsWith("?id=in.(3,4,5)"));
  assert.equal(f.calls[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { emailed_at: "2026-10-26T07:00:00.000Z" });
  assert.equal(await markEmailed(cfgNew, [], "x", f), 0);
  assert.equal(f.calls.length, 1);
  await assert.rejects(markEmailed(cfgNew, [1, "2) or (1=1"], "x", f), /whole numbers/);
});

test("purgeEmailed only deletes rows that were emailed before the cutoff", async () => {
  const f = recorder();
  const cutoff = await purgeEmailed(cfgNew, 30, new Date("2026-11-30T00:00:00.000Z"), f);
  assert.equal(cutoff, "2026-10-31T00:00:00.000Z");
  assert.equal(f.calls[0].init.method, "DELETE");
  assert.ok(f.calls[0].url.includes("emailed_at=not.is.null"));
  assert.ok(f.calls[0].url.includes("emailed_at=lt.2026-10-31T00%3A00%3A00.000Z"));
});

const rows = [
  { id: 1, conversation_id: "aaaaaaaa-1111-4111-8111-111111111111", created_at: "2026-10-20T10:00:00Z", question: "Who is Akpos?", answer: "A problem solver.", kind: "answer" },
  { id: 2, conversation_id: "bbbbbbbb-2222-4222-8222-222222222222", created_at: "2026-10-20T09:00:00Z", question: "How old is he?", answer: "Fuel...", kind: "age" },
  { id: 3, conversation_id: "aaaaaaaa-1111-4111-8111-111111111111", created_at: "2026-10-20T10:05:00Z", question: "<script>alert(1)</script> & more", answer: "Line1\nLine2", kind: "answer" },
];

test("digest: conversations grouped, ordered by time, messages in order", () => {
  const g = groupConversations(rows);
  assert.equal(g.length, 2);
  assert.equal(g[0].id.slice(0, 8), "bbbbbbbb"); // started first (09:00)
  assert.deepEqual(g[1].messages.map((m) => m.question), ["Who is Akpos?", "<script>alert(1)</script> & more"]);
  assert.deepEqual(groupConversations([]), []);
});

test("digest text and subject", () => {
  const g = groupConversations(rows);
  assert.equal(digestSubject(g, 3), "Mon IA weekly digest: 2 conversations, 3 messages");
  assert.equal(digestSubject(groupConversations([rows[0]]), 1), "Mon IA weekly digest: 1 conversation, 1 message");
  assert.equal(digestSubject([], 0), "Mon IA weekly digest: no new conversations");
  const text = formatDigestText(g, 3);
  assert.ok(text.includes("Visitor: Who is Akpos?") && text.includes("Mon IA: A problem solver.") && text.includes("[age rule]"));
  assert.ok(text.includes("10:00") || text.includes("11:00")); // shown in Port Harcourt time (UTC+1)
  assert.ok(formatDigestText([], 0).startsWith("No new"));
});

test("digest HTML: visitor text can never inject markup", () => {
  const html = formatDigestHtml(groupConversations(rows), 3);
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt; &amp; more"));
  assert.ok(html.includes("Line1<br>Line2"));
  assert.equal(escapeHtml(`<a href="x">'&</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;");
});

test("sendEmail: right request, right errors", async () => {
  const f = recorder({ ok: true, status: 200, json: async () => ({ id: "em_1" }) });
  const r = await sendEmail({ apiKey: "re_key", from: "Mon IA <onboarding@resend.dev>", to: "me@example.com", subject: "S", text: "T", html: "<p>T</p>" }, f);
  assert.deepEqual(r, { ok: true, id: "em_1" });
  const { url, init } = f.calls[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.headers.Authorization, "Bearer re_key");
  assert.deepEqual(JSON.parse(init.body).to, ["me@example.com"]);
  await assert.rejects(sendEmail({ apiKey: "k", from: "f", to: "t", subject: "s" }, recorder({ ok: false, status: 403, json: async () => ({ message: "only to your own address" }) })), (e) => e instanceof EmailError && e.status === 403 && e.message.includes("own address"));
  await assert.rejects(sendEmail({ apiKey: "", from: "f", to: "t", subject: "s" }, f), /Missing email settings/);
});
