// Run with:  node --test src/components/sections/ActivityCenter/games/wordonLogic.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  WORD_LENGTH, MAX_ATTEMPTS, CORRECT, PRESENT, ABSENT, isWordShape, isValidGuess, evaluateGuess,
  mergeKeyStatuses, deriveStatus, describeGuess, dayIndex, dailySolution, dateKey, pickRandomSolution,
  emptyStats, recordResult, winPercent, sanitizeStats, sanitizeDaily,
} from "./wordonLogic.js";

const C = CORRECT, P = PRESENT, A = ABSENT;

test("words are exactly 4 lowercase letters", () => {
  assert.equal(WORD_LENGTH, 4);
  assert.equal(MAX_ATTEMPTS, 6);
  for (const ok of ["play", "ruby", "abcd"]) assert.ok(isWordShape(ok), ok);
  for (const bad of ["pla", "plays", "Play", "pl4y", "pl y", "", null, undefined, 1234]) assert.ok(!isWordShape(bad), String(bad));
});

test("isValidGuess needs the right shape AND a place in the word list", () => {
  const allowed = new Set(["play", "poll"]);
  assert.ok(isValidGuess("play", allowed));
  assert.ok(!isValidGuess("plax", allowed)); // not a word
  assert.ok(!isValidGuess("pla", allowed)); // too short
  assert.ok(!isValidGuess("PLAY", allowed)); // callers lowercase first
});

test("feedback: all green, all grey, all yellow", () => {
  assert.deepEqual(evaluateGuess("play", "play"), [C, C, C, C]);
  assert.deepEqual(evaluateGuess("quiz", "fold"), [A, A, A, A]);
  assert.deepEqual(evaluateGuess("abcd", "dcba"), [P, P, P, P]);
});

test("feedback: repeated letters (the tricky part)", () => {
  assert.deepEqual(evaluateGuess("loop", "pool"), [P, C, C, P]);
  assert.deepEqual(evaluateGuess("noon", "moon"), [A, C, C, C]); // the first n has no spare n to match
  assert.deepEqual(evaluateGuess("moon", "noon"), [A, C, C, C]);
  assert.deepEqual(evaluateGuess("eels", "else"), [C, P, P, P]);
  // answer b-a-b-y: the 3rd b is green, leaving ONE spare a and ONE spare b for the others
  assert.deepEqual(evaluateGuess("abba", "baby"), [P, P, C, A]); // first a yellow, second a has none left
});

test("feedback: a letter is only yellow as many times as the answer has it", () => {
  // answer has ONE o: only one of the guess's two o's may score
  assert.deepEqual(evaluateGuess("book", "frog").filter((x) => x !== A).length, 1);
  assert.deepEqual(evaluateGuess("oxox", "doll"), [P, A, A, A]);
  // a green steals the letter from an earlier yellow candidate
  assert.deepEqual(evaluateGuess("lall", "ball"), [A, C, C, C]);
  assert.deepEqual(evaluateGuess("alla", "ball"), [P, P, C, A]); // the green l is taken, so only ONE l and ONE a are spare
});

test("feedback matches an independent brute-force definition for EVERY pair of words over a,b,c", () => {
  const letters = ["a", "b", "c"];
  const words = [];
  for (const a of letters) for (const b of letters) for (const c of letters) for (const d of letters) words.push(a + b + c + d);
  assert.equal(words.length, 81);

  // Definition, per letter L:  greens = positions where guess and answer both have L.
  // total scored = min(count in guess, count in answer). Yellows = total - greens,
  // given to the LEFTMOST non-green positions of L in the guess.
  const reference = (guess, solution) => {
    const out = [...guess].map((ch, i) => (ch === solution[i] ? C : A));
    for (const L of new Set(guess)) {
      const inGuess = [...guess].filter((x) => x === L).length;
      const inSolution = [...solution].filter((x) => x === L).length;
      const greens = [...guess].filter((x, i) => x === L && solution[i] === L).length;
      let yellows = Math.min(inGuess, inSolution) - greens;
      for (let i = 0; i < guess.length && yellows > 0; i++) {
        if (guess[i] === L && out[i] !== C) {
          out[i] = P;
          yellows -= 1;
        }
      }
    }
    return out;
  };

  for (const g of words) for (const s of words) {
    assert.deepEqual(evaluateGuess(g, s), reference(g, s), `${g} vs ${s}`);
  }
});

test("evaluateGuess rejects bad input", () => {
  assert.throws(() => evaluateGuess("pla", "play"));
  assert.throws(() => evaluateGuess("play", "plays"));
  assert.throws(() => evaluateGuess("Play", "play"));
});

test("keyboard colours keep each letter's best result and never downgrade", () => {
  let keys = {};
  keys = mergeKeyStatuses(keys, "loop", [P, C, C, P]);
  assert.deepEqual(keys, { l: P, o: C, p: P });
  keys = mergeKeyStatuses(keys, "pool", [C, A, A, A]); // o is grey here, but it was green before
  assert.equal(keys.o, C);
  assert.equal(keys.p, C); // upgraded yellow -> green
  assert.equal(keys.l, P); // grey must not replace yellow
  const before = { ...keys };
  mergeKeyStatuses(keys, "zzzz", [A, A, A, A]);
  assert.deepEqual(keys, before); // never mutates
});

test("game status: playing, won (even on the last try), lost", () => {
  assert.equal(deriveStatus([], "play"), "playing");
  assert.equal(deriveStatus(["quiz", "fold"], "play"), "playing");
  assert.equal(deriveStatus(["quiz", "play"], "play"), "won");
  const six = ["quiz", "fold", "ruby", "jazz", "zero", "gift"];
  assert.equal(deriveStatus(six, "play"), "lost");
  assert.equal(deriveStatus([...six.slice(0, 5), "play"], "play"), "won");
});

test("describeGuess reads out well for a screen reader", () => {
  assert.equal(describeGuess("loop", [P, C, C, P], 2), "Guess 2 of 6: L present, O correct, O correct, P present");
});

test("daily word: same all day, next word tomorrow, wraps around, handles DST and year changes", () => {
  const list = ["aaaa", "bbbb", "cccc"];
  const d = (y, m, day, h = 12, min = 0) => new Date(y, m, day, h, min);
  assert.equal(dayIndex(d(2026, 9, 17)), 0);
  assert.equal(dayIndex(d(2026, 9, 17, 0, 1)), 0); // just after midnight
  assert.equal(dayIndex(d(2026, 9, 17, 23, 59)), 0); // just before midnight
  assert.equal(dayIndex(d(2026, 9, 18, 0, 1)), 1);
  assert.equal(dailySolution(list, d(2026, 9, 17, 0, 1)), dailySolution(list, d(2026, 9, 17, 23, 59)));
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => dailySolution(list, d(2026, 9, 17 + n))), ["aaaa", "bbbb", "cccc", "aaaa", "bbbb"]);
  assert.equal(dailySolution(list, d(2026, 9, 14)), "aaaa"); // before the epoch still works (negative days)
  assert.equal(dailySolution(list, d(2026, 9, 16)), "cccc");
  // walking day by day for 3 years: the index goes up by exactly 1 every day (no DST skips or repeats)
  let prev = dayIndex(d(2026, 0, 1));
  for (let n = 1; n <= 1100; n++) {
    const cur = dayIndex(d(2026, 0, 1 + n, 3, 30));
    assert.equal(cur, prev + 1, `day ${n}`);
    prev = cur;
  }
  assert.throws(() => dailySolution([], d(2026, 9, 17)));
});

test("dateKey is the local calendar date", () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(dateKey(new Date(2026, 11, 31, 0, 0)), "2026-12-31");
});

test("practice picks stay in the list and never repeat the last word", () => {
  const list = ["aaaa", "bbbb", "cccc"];
  assert.equal(pickRandomSolution(list, () => 0), "aaaa");
  assert.equal(pickRandomSolution(list, () => 0.999999), "cccc");
  assert.equal(pickRandomSolution(list, () => 1), "cccc");
  for (let i = 0; i < 500; i++) assert.notEqual(pickRandomSolution(list, Math.random, "bbbb"), "bbbb");
  assert.equal(pickRandomSolution(["only"], Math.random, "only"), "only");
});

test("stats: wins, losses, streaks, distribution, win percent, no mutation", () => {
  const start = emptyStats();
  let s = start;
  s = recordResult(s, { won: true, attempts: 3 });
  s = recordResult(s, { won: true, attempts: 3 });
  s = recordResult(s, { won: true, attempts: 6 });
  assert.deepEqual(s, { played: 3, wins: 3, streak: 3, maxStreak: 3, distribution: [0, 0, 2, 0, 0, 1] });
  s = recordResult(s, { won: false });
  assert.equal(s.streak, 0);
  assert.equal(s.maxStreak, 3);
  s = recordResult(s, { won: true, attempts: 1 });
  assert.deepEqual(s, { played: 5, wins: 4, streak: 1, maxStreak: 3, distribution: [1, 0, 2, 0, 0, 1] });
  assert.equal(winPercent(s), 80);
  assert.equal(winPercent(emptyStats()), 0);
  assert.deepEqual(start, emptyStats()); // the original was never touched
  assert.throws(() => recordResult(s, { won: true, attempts: 7 }));
  assert.throws(() => recordResult(s, { won: true, attempts: 0 }));
});

test("sanitizeStats keeps good data and throws away bad or tampered data", () => {
  const good = { played: 5, wins: 4, streak: 1, maxStreak: 3, distribution: [1, 0, 2, 0, 0, 1] };
  assert.deepEqual(sanitizeStats(good), good);
  for (const bad of [null, undefined, "x", 5, {}, { ...good, wins: 9 }, { ...good, played: -1 }, { ...good, streak: 7 },
    { ...good, distribution: [1, 2] }, { ...good, distribution: [1, 0, 2, 0, 0, "1"] }, { ...good, played: 1.5 }]) {
    assert.deepEqual(sanitizeStats(bad), emptyStats(), JSON.stringify(bad));
  }
});

test("sanitizeDaily only returns today's valid saved guesses", () => {
  const ok = { dateKey: "2026-10-17", guesses: ["play", "quiz"] };
  assert.deepEqual(sanitizeDaily(ok, "2026-10-17"), ["play", "quiz"]);
  assert.equal(sanitizeDaily(ok, "2026-10-18"), null); // a different day
  for (const bad of [null, "x", {}, { dateKey: "2026-10-17" }, { dateKey: "2026-10-17", guesses: ["pla"] },
    { dateKey: "2026-10-17", guesses: Array(7).fill("play") }, { dateKey: "2026-10-17", guesses: "play" }]) {
    assert.equal(sanitizeDaily(bad, "2026-10-17"), null, JSON.stringify(bad));
  }
});
