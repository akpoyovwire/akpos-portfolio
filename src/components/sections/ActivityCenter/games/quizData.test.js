// Run with:  node --test src/components/sections/ActivityCenter/games/quizData.test.js
// Checks the GENERATED question bank (quiz/quizQuestions.js). Run it after every
//   python scripts/build_quiz.py
import test from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "./quiz/quizQuestions.js";
import { CATEGORIES, DIFFICULTIES, QUESTIONS_PER_QUIZ, isValidQuestion, buildSession, isCorrect } from "./quizLogic.js";

const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

test("the bank has at least 100 questions and every one is valid", () => {
  assert.ok(QUESTIONS.length >= 100, `only ${QUESTIONS.length} questions`);
  for (const q of QUESTIONS) assert.ok(isValidQuestion(q), `invalid question ${q.id}`);
});

test("ids and question texts are unique", () => {
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, QUESTIONS.length);
  assert.equal(new Set(QUESTIONS.map((q) => q.question.toLowerCase())).size, QUESTIONS.length);
});

test("every question has a category from the list, a difficulty, an explanation and a source", () => {
  for (const q of QUESTIONS) {
    assert.ok(CATEGORIES.includes(q.category), `${q.id}: ${q.category}`);
    assert.ok(DIFFICULTIES.includes(q.difficulty) && q.difficulty !== "hard", q.id);
    assert.ok(q.explanation.length > 5, `${q.id} has no explanation`);
    assert.ok(q.source.length > 2, `${q.id} has no source`);
  }
});

test("each of the 10 categories has at least 10 questions", () => {
  for (const category of CATEGORIES) {
    const n = QUESTIONS.filter((q) => q.category === category).length;
    assert.ok(n >= 10, `${category} has only ${n}`);
  }
});

test("exactly one option is the answer, and it is spelled the same as one of the options", () => {
  for (const q of QUESTIONS) {
    assert.equal(q.options.filter((o) => o === q.answer).length, 1, q.id);
    assert.equal(q.options.length, 4, q.id);
  }
});

test("200 random sessions: always 10 questions, no repeats, answers intact, lots of variety", () => {
  const seen = new Set();
  for (let s = 1; s <= 200; s++) {
    const session = buildSession(QUESTIONS, QUESTIONS_PER_QUIZ, seeded(s));
    assert.equal(session.length, 10);
    assert.equal(new Set(session.map((q) => q.id)).size, 10);
    for (const q of session) {
      assert.ok(isCorrect(q, q.options.indexOf(q.answer)));
      seen.add(q.id);
    }
  }
  assert.ok(seen.size >= QUESTIONS.length - 5, `only ${seen.size} different questions came up`);
});
