// Run with:  node --test src/components/sections/ActivityCenter/MyAI/monIaClient.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { SUGGESTIONS, THINKING_PHRASES, THINKING_MS, MAX_HISTORY, SHARD_COLS, shardRows, seededRandom, makeShards, newConversationId, buildRequestBody, linkify, toParagraphs, describeApiError } from "./monIaClient.js";
import { PRIVACY_VERSION, PRIVACY_CONFIG, POLICY_SECTIONS } from "./privacyPolicy.js";
import { isUuid } from "../../../../../server/monIaLogic.js";

test("there are exactly 3 suggested questions, in this order", () => {
  assert.deepEqual(SUGGESTIONS, ["What does Akpoyovwire mean?", "Get to meet Akpos", "Who is the person behind this portfolio?"]);
});

test("thinking phrases: several, all different, all end with an ellipsis, sensible speed", () => {
  assert.ok(THINKING_PHRASES.length >= 6);
  assert.equal(new Set(THINKING_PHRASES).size, THINKING_PHRASES.length);
  assert.ok(THINKING_PHRASES.includes("Thinking…") && THINKING_PHRASES.includes("Putting two and two together…"));
  for (const p of THINKING_PHRASES) assert.ok(p.endsWith("…") && p.length < 45, p);
  assert.ok(THINKING_MS >= 1200 && THINKING_MS <= 3000);
});

test("paper pieces: stable per message, tile the whole bubble, stay within limits, more rows for long text", () => {
  const a = makeShards(5);
  assert.deepEqual(a, makeShards(5));
  assert.notDeepEqual(a, makeShards(6));
  assert.equal(a.length, SHARD_COLS * 3);
  assert.equal(new Set(a.map((p) => p.id)).size, a.length);
  for (const seed of [0, 1, 2, 99, 12345, -7, 1.5, NaN, undefined]) {
    const pieces = makeShards(seed, SHARD_COLS, 5);
    assert.equal(pieces.length, SHARD_COLS * 5);
    let area = 0;
    for (const p of pieces) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 100.0001 && p.y + p.h <= 100.0001);
      area += p.w * p.h;
      assert.ok(Math.abs(p.sx) <= 140 && Math.abs(p.sy) <= 90 && Math.abs(p.sr) <= 360 && p.d >= 0 && p.d <= 260, JSON.stringify(p));
    }
    assert.ok(Math.abs(area - 10000) < 0.01, `pieces cover ${area} of 10000`);
  }
  assert.equal(shardRows(0), 3);
  assert.ok(shardRows(60) <= shardRows(400) && shardRows(100000) === 8);
  const r = seededRandom(3);
  for (let i = 0; i < 1000; i++) { const v = r(); assert.ok(v > 0 && v < 1); }
});

test("conversation ids are valid and different every time, even without the browser's crypto", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const id = newConversationId();
    assert.ok(isUuid(id), id);
    seen.add(id);
  }
  assert.equal(seen.size, 200);
  for (let i = 0; i < 50; i++) assert.ok(isUuid(newConversationId(null)));
  assert.ok(isUuid(newConversationId({ getRandomValues: (a) => a.fill(7) })));
});

test("request body: only role and content, only the latest messages, with consent and id", () => {
  const msgs = Array.from({ length: 20 }, (_, i) => ({ id: i, role: i % 2 ? "assistant" : "user", content: `m${i}`, extra: "x" }));
  const body = buildRequestBody(msgs, "cid", PRIVACY_VERSION);
  assert.equal(body.consent, PRIVACY_VERSION);
  assert.equal(body.conversationId, "cid");
  assert.equal(body.messages.length, MAX_HISTORY);
  assert.deepEqual(Object.keys(body.messages[0]).sort(), ["content", "role"]);
  assert.equal(body.messages.at(-1).content, "m19");
});

test("links: web addresses and emails become links, trailing punctuation stays outside, nothing dangerous", () => {
  const join = (t) => t.map((x) => (x.type === "link" ? `<${x.href}|${x.text}>` : x.text)).join("");
  assert.equal(join(linkify("See https://github.com/akpoyovwire.")), "See <https://github.com/akpoyovwire|https://github.com/akpoyovwire>.");
  assert.equal(join(linkify("Mail me@site.com, thanks")), "Mail <mailto:me@site.com|me@site.com>, thanks");
  assert.equal(join(linkify("no links here")), "no links here");
  const bad = linkify("javascript:alert(1) and data:text/html,x and <script>");
  assert.ok(bad.every((t) => t.type === "text"));
  assert.deepEqual(linkify("").length, 0);
  assert.deepEqual(toParagraphs("a\n\nb\n\n\n c "), ["a", "b", "c"]);
});

test("error messages are friendly for every case", () => {
  assert.ok(describeApiError({ status: 429 }).includes("quickly"));
  assert.ok(describeApiError({ status: 403 }).includes("portfolio"));
  assert.equal(describeApiError({ status: 400, message: "Please keep your message under 500 characters." }), "Please keep your message under 500 characters.");
  assert.ok(describeApiError({ status: 502 }).includes("unavailable"));
  assert.ok(describeApiError(new TypeError("Failed to fetch")).includes("Couldn't reach"));
});

// ---------- the Privacy Policy text ----------
const policyText = POLICY_SECTIONS.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.list || []), ...(s.after || [])]).join("\n");

test("policy: structure is complete and has no leftovers", () => {
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(PRIVACY_VERSION));
  const ids = POLICY_SECTIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of POLICY_SECTIONS) assert.ok(s.heading && s.paragraphs.length > 0, s.id);
  for (const bad of ["TODO", "undefined", "NaN", "[", "]", "{", "}", "lorem"]) assert.ok(!policyText.includes(bad), `found ${bad}`);
});

test("policy: says what is true about how Mon IA works (Nigeria, Google free tier, recording, email, rights)", () => {
  for (const must of [
    "Nigeria Data Protection Act 2023", "Nigeria Data Protection Commission", "https://ndpc.gov.ng", "Groq", "Google", "human reviewers", "free Gemini",
    "Vercel", "Supabase", "Resend", "outside Nigeria", "72 hours", "consent", "withdraw", "18", "weekly", "recorded", PRIVACY_CONFIG.email, PRIVACY_CONFIG.controllerName,
  ]) assert.ok(policyText.includes(must), `policy is missing: ${must}`);
  assert.ok(policyText.includes(`${PRIVACY_CONFIG.databaseRetentionDays} days`));
  assert.ok(policyText.includes(`${PRIVACY_CONFIG.emailRetentionMonths} months`));
});

test("policy: the version date and the 'last updated' date agree", () => {
  const [y, m, d] = PRIVACY_VERSION.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  assert.equal(PRIVACY_CONFIG.lastUpdated, `${d} ${months[m - 1]} ${y}`);
});