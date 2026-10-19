// Run with:  node --test src/components/sections/ActivityCenter/games/wordonData.test.js
// Checks the GENERATED word lists (wordon/wordonSolutions.js and wordon/wordonGuesses.js).
// Run it after every  python scripts/build_wordon_lists.py
import test from "node:test";
import assert from "node:assert/strict";
import { SOLUTIONS } from "./wordon/wordonSolutions.js";
import { ALLOWED } from "./wordon/wordonGuesses.js";
import { isWordShape, dailySolution, evaluateGuess, WORD_LENGTH } from "./wordonLogic.js";

test("every answer is a clean 4-letter word and there are no duplicates", () => {
  assert.ok(SOLUTIONS.length >= 200, `only ${SOLUTIONS.length} answers`);
  for (const w of SOLUTIONS) assert.ok(isWordShape(w), `bad answer: ${w}`);
  assert.equal(new Set(SOLUTIONS).size, SOLUTIONS.length, "duplicate answers");
});

test("every allowed guess is a clean 4-letter word and there are no duplicates", () => {
  for (const w of ALLOWED) assert.ok(isWordShape(w), `bad guess word: ${w}`);
  assert.equal(new Set(ALLOWED).size, ALLOWED.length, "duplicate guess words");
});

test("the guess list really comes from ENABLE (thousands of words, not just the answers)", () => {
  const hint = "Put enable1.txt in scripts/data/ and run  python scripts/build_wordon_lists.py  from the project root.";
  assert.ok(ALLOWED.length > 3000, `only ${ALLOWED.length} guess words: the full list was not built. ${hint}`);
  for (const w of ["ruby", "jake"]) assert.ok(ALLOWED.includes(w), `"${w}" should be accepted. ${hint}`);
});

test("every answer is also an allowed guess", () => {
  const allowed = new Set(ALLOWED);
  const missing = SOLUTIONS.filter((w) => !allowed.has(w));
  assert.deepEqual(missing, []);
});

test("a full year of daily words works and gives a valid answer every day", () => {
  const words = new Set();
  for (let n = 0; n < 366; n++) {
    const word = dailySolution(SOLUTIONS, new Date(2026, 9, 17 + n, 12));
    assert.ok(isWordShape(word));
    words.add(word);
  }
  assert.ok(words.size > 300, "daily words repeat too soon");
});

test("guessing the answer itself is always all green", () => {
  for (const w of SOLUTIONS) assert.ok(evaluateGuess(w, w).every((x) => x === "correct"));
  assert.equal(WORD_LENGTH, 4);
});
