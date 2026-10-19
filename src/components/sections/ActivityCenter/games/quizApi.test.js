// Run with:  node --test src/components/sections/ActivityCenter/games/quizApi.test.js
// Uses a fake fetch, so no internet is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { fetchTriviaSession } from "./quizApi.js";
import { TRIVIA_TOPICS, isValidQuestion } from "./quizLogic.js";

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const item = (n, difficulty = "easy") => ({
  type: b64("multiple"), difficulty: b64(difficulty), category: b64("Entertainment: Film"),
  question: b64(`Film question ${n}?`), correct_answer: b64(`right ${n}`),
  incorrect_answers: [b64(`wa${n}`), b64(`wb${n}`), b64(`wc${n}`)],
});
const okFetch = (results, code = 0) => async () => ({ ok: true, status: 200, json: async () => ({ response_code: code, results }) });
const topic = TRIVIA_TOPICS[1];
const fail = async (promise) => { try { await promise; } catch (e) { return e; } return null; };

test("a good reply gives exactly 10 playable questions", async () => {
  const results = Array.from({ length: 20 }, (_, i) => item(i, i % 5 === 0 ? "hard" : "easy"));
  const session = await fetchTriviaSession(topic, { fetchImpl: okFetch(results) });
  assert.equal(session.length, 10);
  assert.equal(new Set(session.map((q) => q.question)).size, 10);
  assert.ok(session.every((q) => q.difficulty !== "hard")); // plenty of easy ones, so no hard
  assert.ok(session.every((q) => q.options[q.answerIndex] === q.answer && isValidQuestion(q)));
});

test("asks for the right URL", async () => {
  let asked = "";
  const fetchImpl = async (url) => { asked = url; return okFetch(Array.from({ length: 12 }, (_, i) => item(i)))(); };
  await fetchTriviaSession(topic, { fetchImpl });
  assert.ok(asked.includes("category=11") && asked.includes("encode=base64"));
});

test("fewer than 10 usable questions -> not-enough", async () => {
  const e = await fail(fetchTriviaSession(topic, { fetchImpl: okFetch(Array.from({ length: 6 }, (_, i) => item(i))) }));
  assert.equal(e.code, "not-enough");
});

test("rate limit (code 5 or HTTP 429), HTTP errors, bad JSON and network failures", async () => {
  assert.equal((await fail(fetchTriviaSession(topic, { fetchImpl: okFetch([], 5) }))).code, "rate-limit");
  assert.equal((await fail(fetchTriviaSession(topic, { fetchImpl: async () => ({ ok: false, status: 429 }) }))).code, "rate-limit");
  assert.equal((await fail(fetchTriviaSession(topic, { fetchImpl: async () => ({ ok: false, status: 500 }) }))).code, "bad-response");
  assert.equal((await fail(fetchTriviaSession(topic, { fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }) }))).code, "bad-response");
  assert.equal((await fail(fetchTriviaSession(topic, { fetchImpl: async () => { throw new TypeError("Failed to fetch"); } }))).code, "network");
});

test("a request that never answers times out", async () => {
  const hang = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  const e = await fail(fetchTriviaSession(topic, { fetchImpl: hang, timeoutMs: 30 }));
  assert.equal(e.code, "network");
});

test("if the visitor leaves, the request is cancelled without a visible error code", async () => {
  const controller = new AbortController();
  const hang = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  const promise = fail(fetchTriviaSession(topic, { fetchImpl: hang, signal: controller.signal, timeoutMs: 5000 }));
  controller.abort();
  const e = await promise;
  assert.ok(e && e.code === undefined, "should be the plain abort error, not a QuizError");
});
