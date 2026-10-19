// Run with:  node --test src/components/sections/ActivityCenter/games/rpsLogic.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { CHOICES, EMPTY_SCORE, getOutcome, randomChoice, applyOutcome, describeRound } from "./rpsLogic.js";

test("all 9 combinations give the right outcome", () => {
  const expected = {
    "rock-rock": "draw", "rock-paper": "loss", "rock-scissors": "win",
    "paper-rock": "win", "paper-paper": "draw", "paper-scissors": "loss",
    "scissors-rock": "loss", "scissors-paper": "win", "scissors-scissors": "draw",
  };
  for (const p of CHOICES) for (const c of CHOICES) {
    assert.equal(getOutcome(p, c), expected[`${p}-${c}`], `${p} vs ${c}`);
  }
});

test("invalid choices are rejected", () => {
  assert.throws(() => getOutcome("lizard", "rock"));
  assert.throws(() => getOutcome("rock", undefined));
  assert.throws(() => getOutcome("ROCK", "paper"));
});

test("randomChoice maps the whole 0-1 range, including edges", () => {
  assert.equal(randomChoice(() => 0), "rock");
  assert.equal(randomChoice(() => 0.32), "rock");
  assert.equal(randomChoice(() => 0.34), "paper");
  assert.equal(randomChoice(() => 0.67), "scissors");
  assert.equal(randomChoice(() => 0.999999), "scissors");
  assert.equal(randomChoice(() => 1), "scissors"); // never out of range
});

test("randomChoice is roughly even over many rounds", () => {
  const counts = { rock: 0, paper: 0, scissors: 0 };
  for (let i = 0; i < 30000; i++) counts[randomChoice()]++;
  for (const c of CHOICES) assert.ok(counts[c] > 9000 && counts[c] < 11000, `${c}: ${counts[c]}`);
});

test("applyOutcome counts correctly across repeated rounds and never mutates", () => {
  const start = { ...EMPTY_SCORE };
  let s = start;
  for (const o of ["win", "win", "loss", "draw", "win", "draw"]) s = applyOutcome(s, o);
  assert.deepEqual(s, { wins: 3, losses: 1, draws: 2 });
  assert.deepEqual(start, { wins: 0, losses: 0, draws: 0 });
  assert.throws(() => applyOutcome(s, "banana"));
});

test("describeRound reads naturally", () => {
  assert.equal(describeRound("rock", "scissors", "win"), "Rock beats scissors.");
  assert.equal(describeRound("rock", "paper", "loss"), "Paper beats rock.");
  assert.equal(describeRound("paper", "paper", "draw"), "Both chose paper.");
});
