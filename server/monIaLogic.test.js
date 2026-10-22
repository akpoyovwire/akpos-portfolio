// Run with:  node --test server/monIaLogic.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CANNED, RULES, buildSystemPrompt, isAgeQuestion, applyControlTokens, extractAllowedLinks, sanitizeLinks, isUuid,
  validateIncoming, toGeminiContents, dropCannedTurns, parseGeminiResponse, createLimiter, isSameOrigin, MAX_QUESTION_CHARS, MAX_HISTORY,
} from "./monIaLogic.js";
import { PRIVACY_VERSION } from "../src/components/sections/ActivityCenter/MyAI/privacyPolicy.js";

const ID = "3f2b8c1e-9d4a-4b6e-8a1c-2d5e7f9a0b3c";
const ok = (body) => validateIncoming(body, { policyVersion: PRIVACY_VERSION });
const good = (messages) => ({ consent: PRIVACY_VERSION, conversationId: ID, messages });

test("the three exact sentences are exactly as specified", () => {
  assert.equal(CANNED.age, "Fuel in Nigeria is now 1450. Those are the only numbers that matter.");
  assert.equal(CANNED.refuse, "We don't talk about that.");
  assert.equal(CANNED.private, "That's something Akpos would have to address personally. You can contact him directly through his public contact information to find out more.");
});

test("age questions in many phrasings and languages are caught", () => {
  const yes = [
    "How old is Akpos?", "how old is he", "How old is Akpoyovwire??", "What's his age?", "what is his age", "akpos age", "Akpos's age please",
    "Age of Akpoyovwire", "When was he born?", "What year was Akpos born?", "date of birth", "his birthday", "How many years old is he",
    "Quel âge a-t-il ?", "¿Cuántos años tiene?", "Wie alt ist er?", "Quantos anos ele tem?", "Que idade ele tem?", "Quanti anni ha?",
    "Hoe oud is hij?", "كم عمره؟", "他多大年纪？", "何歳ですか", "сколько ему лет?", "how old he be?", "wetin be im age?", "which year e born",
  ];
  for (const q of yes) assert.ok(isAgeQuestion(q), `should catch: ${q}`);
});

test("questions that only mention 'age' or 'old' are NOT caught", () => {
  const no = [
    "How old is React?", "What is the age of AI?", "Tell me about his skills", "Which age group plays Wordon?", "Does he know the Stone Age?",
    "How old are you?", "how are you", "tell me my age", "How old is React", "What does he do?", "He is old school?", "What is the Iron Age", "Who is Akpos?", "", "   ",
  ];
  for (const q of no) assert.ok(!isAgeQuestion(q), `should NOT catch: ${q}`);
  assert.ok(!isAgeQuestion(undefined) && !isAgeQuestion(null) && !isAgeQuestion(42));
});

test("control tokens become the exact canned sentences, and nothing else leaks", () => {
  assert.deepEqual(applyControlTokens("[[AGE]]"), { kind: "age", text: CANNED.age });
  assert.deepEqual(applyControlTokens(" [[ refuse ]] "), { kind: "refuse", text: CANNED.refuse });
  assert.deepEqual(applyControlTokens("[[PRIVATE]]"), { kind: "private", text: CANNED.private });
  assert.equal(applyControlTokens("Sure thing. [[AGE]] extra words").text, CANNED.age); // token + chatter -> still the exact sentence
  assert.equal(applyControlTokens("[[REFUSE]] and [[AGE]]").kind, "age"); // age wins
  assert.deepEqual(applyControlTokens("Akpos builds things. [[WHATEVER]]"), { kind: "answer", text: "Akpos builds things." });
});

const KB = [
  { id: "contact", category: "contact", title: "Contact", text: "- GitHub: https://github.com/akpoyovwire\n- Email: Ogbonakposofficial@gmail.com\n- LinkedIn: https://www.linkedin.com/in/akpoyovwire/" },
  { id: "x", category: "identity", title: "X", text: "Plain text, no links." },
];

test("links: only links and emails from the knowledge base survive", () => {
  const allowed = extractAllowedLinks(KB);
  assert.ok(allowed.has("https://github.com/akpoyovwire"));
  assert.ok(allowed.has("ogbonakposofficial@gmail.com"));
  const s = (t) => sanitizeLinks(t, allowed);
  assert.equal(s("See https://github.com/akpoyovwire."), "See https://github.com/akpoyovwire.");
  assert.equal(s("See https://github.com/akpoyovwire/"), "See https://github.com/akpoyovwire/"); // trailing slash is fine
  assert.equal(s("HTTPS://GITHUB.COM/AKPOYOVWIRE ok"), "HTTPS://GITHUB.COM/AKPOYOVWIRE ok");
  assert.equal(s("Write to ogbonakposofficial@gmail.com today"), "Write to ogbonakposofficial@gmail.com today");
  assert.equal(s("Visit https://made-up.example.com/akpos for more"), "Visit for more");
  assert.equal(s("Mail someone.else@evil.com now"), "Mail now");
  assert.equal(s("Read [my blog](https://evil.com/x) now"), "Read my blog now");
  assert.equal(s("Link (https://evil.com) here"), "Link here");
  assert.equal(s("A https://github.com/akpoyovwire/secret-repo B"), "A B"); // a path that is not in the knowledge base
  assert.equal(s("No links at all."), "No links at all.");
});

test("system prompt: contains the rules and every published record, grouped, and nothing extra", () => {
  const prompt = buildSystemPrompt(KB);
  assert.ok(prompt.startsWith(RULES));
  assert.ok(prompt.includes("### Contact") && prompt.includes("Plain text, no links."));
  assert.ok(prompt.indexOf("## Identity") < prompt.indexOf("## Contact"));
  assert.ok(prompt.includes("third person") && prompt.includes("[[AGE]]") && prompt.includes("[[REFUSE]]") && prompt.includes("[[PRIVATE]]"));
  assert.ok(prompt.includes("DATA"));
});

test("uuid check", () => {
  assert.ok(isUuid(ID));
  for (const bad of ["", "nope", "3f2b8c1e-9d4a-4b6e-8a1c-2d5e7f9a0b3", null, 5, "3f2b8c1e-9d4a-9b6e-8a1c-2d5e7f9a0b3c"]) assert.ok(!isUuid(bad), String(bad));
});

test("validateIncoming: accepts a good request and tidies it", () => {
  const r = ok(good([{ role: "user", content: "  Who is Akpos?  " }]));
  assert.equal(r.ok, true);
  assert.deepEqual(r.messages, [{ role: "user", content: "Who is Akpos?" }]);
  assert.equal(r.conversationId, ID);
});

test("validateIncoming: consent is required and must be the CURRENT policy version", () => {
  const msgs = [{ role: "user", content: "hi" }];
  assert.equal(ok({ conversationId: ID, messages: msgs }).ok, false);
  assert.equal(ok({ consent: "old-version", conversationId: ID, messages: msgs }).ok, false);
  assert.equal(ok({ consent: PRIVACY_VERSION, conversationId: ID, messages: msgs }).ok, true);
});

test("validateIncoming: rejects bad shapes, long messages, wrong roles, and bodies that end with the assistant", () => {
  const msg = (content, role = "user") => ({ role, content });
  const bad = [
    null, "x", [], {}, good("no"), good([msg("hi", "system")]), good([{ role: "user" }]), good([{ role: "user", content: 5 }]),
    good([msg("x".repeat(MAX_QUESTION_CHARS + 1))]), good([msg("q"), msg("a", "assistant")]), good([]), good([msg("   ")]),
    { consent: PRIVACY_VERSION, conversationId: "nope", messages: [msg("hi")] },
  ];
  for (const b of bad) assert.equal(ok(b).ok, false, JSON.stringify(b)?.slice(0, 80));
  assert.equal(ok(good([msg("x".repeat(MAX_QUESTION_CHARS))])).ok, true);
  assert.equal(ok(good([msg("hi")])).status, undefined);
  assert.equal(ok({ ...good([msg("hi")]), junk: "y".repeat(20000) }).status, 413);
});

test("validateIncoming: keeps only the latest messages and always starts with the visitor", () => {
  const many = [];
  for (let i = 0; i < 12; i++) many.push({ role: i % 2 ? "assistant" : "user", content: `m${i}` });
  many.push({ role: "user", content: "last" });
  const r = ok(good(many));
  assert.ok(r.messages.length <= MAX_HISTORY);
  assert.equal(r.messages[0].role, "user");
  assert.equal(r.messages.at(-1).content, "last");
});

test("Gemini helpers", () => {
  const out = toGeminiContents([{ role: "user", content: "a" }, { role: "user", content: "b" }, { role: "assistant", content: "c" }, { role: "user", content: "d" }]);
  assert.deepEqual(out.map((m) => m.role), ["user", "model", "user"]);
  assert.equal(out[0].parts[0].text, "a\nb");
  assert.deepEqual(parseGeminiResponse({ candidates: [{ content: { parts: [{ text: "Hello " }, { text: "there" }] } }] }), { text: "Hello there" });
  assert.deepEqual(parseGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } }), { blocked: true });
  assert.deepEqual(parseGeminiResponse({ candidates: [{ finishReason: "SAFETY" }] }), { blocked: true });
  for (const empty of [null, {}, { candidates: [] }, { candidates: [{ content: { parts: [] } }] }, { candidates: [{ content: { parts: [{ text: "  " }] } }] }]) {
    assert.deepEqual(parseGeminiResponse(empty), { empty: true });
  }
});

test("rate limiter: per-minute and per-hour, per visitor, and it recovers", () => {
  let t = 1_000_000;
  const limiter = createLimiter({ perMinute: 3, perHour: 5, now: () => t });
  for (let i = 0; i < 3; i++) assert.ok(limiter.check("a").ok);
  const blocked = limiter.check("a");
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
  assert.ok(limiter.check("b").ok); // someone else is unaffected
  t += 61_000;
  assert.ok(limiter.check("a").ok);
  assert.ok(limiter.check("a").ok);
  t += 61_000; // 5 within the hour already used
  assert.equal(limiter.check("a").ok, false);
  t += 3_600_000;
  assert.ok(limiter.check("a").ok);
});

test("same-origin check", () => {
  assert.ok(isSameOrigin(undefined, "mysite.com"));
  assert.ok(isSameOrigin("https://mysite.com", "mysite.com"));
  assert.ok(isSameOrigin("http://localhost:3000", "localhost:3000"));
  assert.ok(!isSameOrigin("https://evil.com", "mysite.com"));
  assert.ok(!isSameOrigin("not a url", "mysite.com"));
});

test("the AI rules limit [[AGE]] to Akpos's age and cover small talk and Mon IA itself", () => {
  assert.ok(RULES.includes("ONLY when the visitor asks how old Akpos is"));
  assert.ok(RULES.includes("how are you") && RULES.includes("how old you are"));
  assert.ok(RULES.includes("Never copy or repeat an earlier reply"));
});

test("canned replies are removed from the history the AI sees, with the question they answered", () => {
  const u = (content) => ({ role: "user", content });
  const a = (content) => ({ role: "assistant", content });
  const out = dropCannedTurns([u("How old is Akpos?"), a(CANNED.age), u("how are you")]);
  assert.deepEqual(out, [u("how are you")]);
  const mixed = dropCannedTurns([u("What does he do?"), a("He builds things."), u("age?"), a(CANNED.refuse), u("thanks")]);
  assert.deepEqual(mixed, [u("What does he do?"), a("He builds things."), u("thanks")]);
  assert.deepEqual(dropCannedTurns([u("hi")]), [u("hi")]);
});
