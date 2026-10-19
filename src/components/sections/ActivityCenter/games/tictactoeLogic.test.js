// Run with:  node --test src/components/sections/ActivityCenter/games/tictactoeLogic.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  HUMAN, AI, LINES, EMPTY_SCORE, emptyBoard, availableMoves, placeMark, getResult,
  outcomeFor, applyResult, easyMove, lockedMove, chooseMove,
} from "./tictactoeLogic.js";

const from = (s) => [...s.replace(/\s/g, "")].map((c) => (c === "." ? null : c));

test("all 8 lines are detected for both players", () => {
  for (const mark of [HUMAN, AI]) {
    for (const line of LINES) {
      const b = emptyBoard();
      line.forEach((i) => (b[i] = mark));
      const r = getResult(b);
      assert.equal(r.status, "win");
      assert.equal(r.winner, mark);
      assert.deepEqual(r.line, line);
    }
  }
});

test("draw, still playing, and empty board", () => {
  assert.equal(getResult(from("XOX XOO OXX")).status, "draw");
  assert.equal(getResult(from("XO. ... ...")).status, "playing");
  assert.equal(getResult(emptyBoard()).status, "playing");
});

test("placeMark rejects taken or invalid cells and never mutates", () => {
  const b = emptyBoard();
  const next = placeMark(b, 4, "X");
  assert.equal(b[4], null);
  assert.equal(next[4], "X");
  assert.throws(() => placeMark(next, 4, "O"));
  assert.throws(() => placeMark(b, 9, "X"));
  assert.throws(() => placeMark(b, -1, "X"));
  assert.throws(() => placeMark(b, 1.5, "X"));
});

test("availableMoves lists the free cells", () => {
  assert.deepEqual(availableMoves(from("X.O ... ..X")), [1, 3, 4, 5, 6, 7]);
});

test("outcomeFor and applyResult score from the human's side, without mutating", () => {
  const win = { status: "win", winner: HUMAN, line: LINES[0] };
  const loss = { status: "win", winner: AI, line: LINES[0] };
  assert.equal(outcomeFor(win), "win");
  assert.equal(outcomeFor(loss), "loss");
  assert.equal(outcomeFor({ status: "draw" }), "draw");
  assert.equal(outcomeFor({ status: "playing" }), null);
  let s = EMPTY_SCORE;
  for (const r of [win, win, loss, { status: "draw" }, { status: "playing" }]) s = applyResult(s, r);
  assert.deepEqual(s, { wins: 2, losses: 1, draws: 1 });
  assert.deepEqual(EMPTY_SCORE, { wins: 0, losses: 0, draws: 0 });
});

test("easy always plays a legal move, over thousands of random boards", () => {
  for (let n = 0; n < 3000; n++) {
    let b = emptyBoard();
    let turn = HUMAN;
    while (getResult(b).status === "playing") {
      const moves = availableMoves(b);
      const m = turn === AI ? easyMove(b) : moves[Math.floor(Math.random() * moves.length)];
      assert.ok(moves.includes(m), `illegal move ${m}`);
      b = placeMark(b, m, turn);
      turn = turn === HUMAN ? AI : HUMAN;
    }
  }
});

test("easy takes a visible win when its dice say so, and is not perfect", () => {
  const b = from("OO. XX. X..");
  assert.equal(easyMove(b, AI, () => 0), 2); // takes the win
  const misses = new Set();
  for (let n = 0; n < 200; n++) misses.add(easyMove(b, AI, (() => { let k = 0; return () => (k++ === 0 ? 0.9 : Math.random()); })()));
  assert.ok(misses.size > 1, "easy should sometimes play something else");
});

test("locked in takes a win and blocks a loss", () => {
  assert.equal(lockedMove(from("OO. XX. X.."), AI), 2); // wins at once
  assert.equal(lockedMove(from("XX. O.. ..."), AI), 2); // must block
  assert.equal(lockedMove(from("X.. .O. ..X"), AI) % 2, 1); // must take an edge, not a corner
});

// every possible game against locked in: the human can never win
function everyGame(startTurn, rng) {
  let games = 0;
  const explore = (b, turn) => {
    const r = getResult(b);
    if (r.status !== "playing") {
      games += 1;
      assert.notEqual(r.winner, HUMAN, `locked in lost: ${b.join(",")}`);
      return;
    }
    if (turn === AI) explore(placeMark(b, lockedMove(b, AI, rng), AI), HUMAN);
    else for (const m of availableMoves(b)) explore(placeMark(b, m, HUMAN), AI);
  };
  explore(emptyBoard(), startTurn);
  return games;
}

test("locked in never loses: human first, every possible human play", () => {
  assert.ok(everyGame(HUMAN, () => 0) > 100);
  assert.ok(everyGame(HUMAN, () => 0.999) > 100);
});

test("locked in never loses: Akpos first, every possible human play", () => {
  assert.ok(everyGame(AI, () => 0) > 10);
  assert.ok(everyGame(AI, () => 0.5) > 10);
});

test("chooseMove picks by mode and rejects bad modes", () => {
  const b = from("OO. XX. X..");
  assert.equal(chooseMove(b, "locked", () => 0), 2);
  assert.ok(availableMoves(b).includes(chooseMove(b, "easy")));
  assert.throws(() => chooseMove(b, "hard"));
});
