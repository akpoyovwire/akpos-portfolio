// Run with:  node --test src/components/sections/ActivityCenter/games/quizLogic.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  QUESTIONS_PER_QUIZ, CATEGORIES, shuffle, isValidQuestion, pickQuestions, toPlayable, buildSession, isCorrect,
  progressLabel, scoreMessage, titleCase, TRIVIA_TOPICS, triviaUrl, decodeBase64, normalizeTriviaResponse,
  describeError, QuizError,
} from "./quizLogic.js";

// small deterministic random numbers, so the tests give the same result every time
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const make = (n, extra = {}) => ({
  id: `q-${String(n).padStart(3, "0")}`, category: "General knowledge", difficulty: "easy",
  question: `Question number ${n}?`, options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`], answer: `a${n}`,
  explanation: "because", source: "test", ...extra,
});
const pool = (size) => Array.from({ length: size }, (_, i) => make(i + 1));

test("there are 10 categories and 10 questions per quiz", () => {
  assert.equal(CATEGORIES.length, 10);
  assert.equal(new Set(CATEGORIES).size, 10);
  assert.equal(QUESTIONS_PER_QUIZ, 10);
});

test("shuffle keeps every item, never mutates, and is deterministic for a given rng", () => {
  const original = [1, 2, 3, 4, 5, 6];
  const out = shuffle(original, seeded(1));
  assert.deepEqual([...out].sort(), original);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(shuffle(original, seeded(7)), shuffle(original, seeded(7)));
  assert.deepEqual(shuffle([], seeded(1)), []);
  assert.deepEqual(shuffle([9], seeded(1)), [9]);
  assert.doesNotThrow(() => shuffle(original, () => 1)); // rng at the very edge stays in range
});

test("shuffle is fair: all 6 orders of 3 items turn up about equally", () => {
  const rng = seeded(42);
  const counts = {};
  for (let i = 0; i < 6000; i++) {
    const key = shuffle(["x", "y", "z"], rng).join("");
    counts[key] = (counts[key] || 0) + 1;
  }
  assert.equal(Object.keys(counts).length, 6);
  for (const n of Object.values(counts)) assert.ok(n > 800 && n < 1200, JSON.stringify(counts));
});

test("isValidQuestion accepts a good question and rejects every kind of bad one", () => {
  assert.ok(isValidQuestion(make(1)));
  const bad = [
    null, undefined, "x", {}, make(1, { question: "  " }), make(1, { id: "" }), make(1, { difficulty: "insane" }),
    make(1, { options: ["a", "b", "c"] }), make(1, { options: ["a", "b", "c", "d", "e"] }),
    make(1, { options: ["a", "A", "c", "d"], answer: "a" }), // duplicate (ignoring case)
    make(1, { options: ["a", "", "c", "d"], answer: "a" }), // an empty option
    make(1, { answer: "zzz" }), // answer is not one of the options
    make(1, { options: "abcd" }),
  ];
  for (const q of bad) assert.ok(!isValidQuestion(q), JSON.stringify(q));
});

test("pickQuestions: exactly the number asked for, no repeats, pool untouched", () => {
  const p = pool(50);
  const copy = JSON.stringify(p);
  for (let s = 1; s <= 100; s++) {
    const picked = pickQuestions(p, 10, seeded(s));
    assert.equal(picked.length, 10);
    assert.equal(new Set(picked.map((q) => q.id)).size, 10);
  }
  assert.equal(JSON.stringify(p), copy);
});

test("pickQuestions drops repeats by wording even when the ids differ, and skips invalid ones", () => {
  const p = [make(1), make(2, { question: "Question number 1?" }), make(3, { answer: "nope" }), make(4), make(5)];
  const ids = pickQuestions(p, 10, seeded(3)).map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!(ids.includes("q-001") && ids.includes("q-002")), "same wording picked twice");
  assert.ok(!ids.includes("q-003"), "invalid question picked");
  assert.equal(ids.length, 3);
});

test("pickQuestions prefers easy/medium and only uses hard to fill up", () => {
  const p = [...pool(6), ...Array.from({ length: 10 }, (_, i) => make(100 + i, { difficulty: "hard" }))];
  const picked = pickQuestions(p, 10, seeded(5));
  assert.equal(picked.filter((q) => q.difficulty === "hard").length, 4); // 6 easy + 4 hard
  const plenty = pickQuestions([...pool(20), ...p.slice(6)], 10, seeded(5));
  assert.ok(plenty.every((q) => q.difficulty !== "hard"));
});

test("toPlayable: shuffling can NEVER corrupt the correct answer", () => {
  const rng = seeded(99);
  const spots = [0, 0, 0, 0];
  for (let i = 0; i < 8000; i++) {
    const q = make(1, { options: ["alpha", "beta", "gamma", "delta"], answer: ["alpha", "beta", "gamma", "delta"][i % 4] });
    const p = toPlayable(q, rng);
    assert.deepEqual([...p.options].sort(), ["alpha", "beta", "delta", "gamma"]);
    assert.equal(p.options[p.answerIndex], q.answer);
    assert.ok(isCorrect(p, p.answerIndex));
    assert.ok(!isCorrect(p, (p.answerIndex + 1) % 4));
    spots[p.answerIndex]++;
  }
  for (const n of spots) assert.ok(n > 1700 && n < 2300, `the answer lands in one spot too often: ${spots}`); // not always in the same place
});

test("buildSession: exactly 10 different questions, every one valid", () => {
  const session = buildSession(pool(110), 10, seeded(11));
  assert.equal(session.length, 10);
  assert.equal(new Set(session.map((q) => q.id)).size, 10);
  for (const q of session) {
    assert.equal(q.options.length, 4);
    assert.equal(q.options[q.answerIndex], q.answer);
  }
});

test("buildSession: sessions differ from each other, and a small pool throws", () => {
  const p = pool(110);
  const a = buildSession(p, 10, seeded(1)).map((q) => q.id).join();
  const b = buildSession(p, 10, seeded(2)).map((q) => q.id).join();
  assert.notEqual(a, b);
  const seen = new Set();
  for (let s = 1; s <= 50; s++) buildSession(p, 10, seeded(s)).forEach((q) => seen.add(q.id));
  assert.ok(seen.size > 70, `only ${seen.size} different questions over 50 sessions`);
  assert.throws(() => buildSession(pool(9), 10), (e) => e instanceof QuizError && e.code === "not-enough");
});

test("scoring helpers", () => {
  assert.equal(progressLabel(0, 10), "Question 1 of 10");
  assert.equal(progressLabel(3, 10), "Question 4 of 10");
  assert.equal(progressLabel(9, 10), "Question 10 of 10");
  const tiers = new Set();
  for (let s = 0; s <= 10; s++) tiers.add(scoreMessage(s, 10));
  assert.equal(tiers.size, 5);
  assert.equal(scoreMessage(10), "Perfect score. Flawless.");
  assert.equal(scoreMessage(0), "Tough round. Go again?");
  assert.equal(titleCase("easy"), "Easy");
  assert.equal(titleCase(""), "");
});

test("trivia topics and url", () => {
  assert.equal(TRIVIA_TOPICS.length, 5);
  assert.equal(new Set(TRIVIA_TOPICS.map((t) => t.categoryId)).size, 5);
  const url = triviaUrl(TRIVIA_TOPICS[0]);
  assert.ok(url.startsWith("https://opentdb.com/api.php?"));
  assert.ok(url.includes("category=12") && url.includes("type=multiple") && url.includes("encode=base64"));
});

// --- Open Trivia DB cleaning ---
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const item = (n, over = {}) => ({
  type: b64("multiple"), difficulty: b64("easy"), category: b64("Entertainment: Music"),
  question: b64(`Trivia question ${n}?`), correct_answer: b64(`right ${n}`),
  incorrect_answers: [b64(`wrong a${n}`), b64(`wrong b${n}`), b64(`wrong c${n}`)], ...over,
});
const reply = (results, code = 0) => ({ response_code: code, results });
const topic = TRIVIA_TOPICS[0];

test("decodeBase64 handles accents and non-Latin text", () => {
  for (const s of ["plain", "Beyoncé", "Ngũgĩ wa Thiong'o", "日本語", "Mbappé & co <b>"]) assert.equal(decodeBase64(b64(s)), s);
});

test("a good Open Trivia DB reply becomes valid questions", () => {
  const out = normalizeTriviaResponse(reply([item(1), item(2)]), topic);
  assert.equal(out.length, 2);
  assert.equal(out[0].question, "Trivia question 1?");
  assert.equal(out[0].answer, "right 1");
  assert.equal(out[0].options.length, 4);
  assert.equal(out[0].source, "Open Trivia DB");
  assert.equal(out[0].explanation, "");
  assert.ok(out.every(isValidQuestion));
});

test("bad items are dropped, not guessed at", () => {
  const out = normalizeTriviaResponse(reply([
    item(1),
    item(2, { type: b64("boolean") }), // true/false question
    item(3, { incorrect_answers: [b64("x"), b64("x"), b64("y")] }), // duplicate wrong answers
    item(4, { correct_answer: b64("wrong a4") }), // correct answer duplicates a wrong one
    item(5, { incorrect_answers: [b64("only one")] }), // not 4 options
    item(6, { question: undefined }), // missing field
    item(7, { difficulty: b64("impossible") }),
    null,
  ]), topic);
  assert.deepEqual(out.map((q) => q.question), ["Trivia question 1?"]);
});

test("Open Trivia DB error codes become the right error", () => {
  const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
  assert.equal(code(() => normalizeTriviaResponse(reply([], 5), topic)), "rate-limit");
  assert.equal(code(() => normalizeTriviaResponse(reply([], 1), topic)), "no-results");
  assert.equal(code(() => normalizeTriviaResponse(reply([], 2), topic)), "bad-response");
  for (const junk of [null, undefined, "x", 5, {}, { response_code: 0 }, { response_code: 0, results: "no" }]) {
    assert.equal(code(() => normalizeTriviaResponse(junk, topic)), "bad-response", JSON.stringify(junk));
  }
});

test("every error has friendly text", () => {
  for (const c of ["rate-limit", "network", "not-enough", "no-results", "bad-response", "whatever"]) {
    assert.ok(describeError(new QuizError(c, "x")).length > 10, c);
  }
  assert.ok(describeError(undefined).length > 10);
});
