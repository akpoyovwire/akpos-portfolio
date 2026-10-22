// Run with:  node --test src/components/sections/ActivityCenter/gameInfo.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { GAME_INFO, LISTENING_ROOM_INFO, getGameInfo } from "./gameInfo.js";

test("every game name finds its panel, whatever the capitals or spaces", () => {
  for (const name of ["Tic Tac Toe", "tic-tac-toe", "Wordon", "Rock Paper Scissors", "Rock, Paper, Scissors", "Quiz"]) assert.ok(getGameInfo(name), name);
  assert.equal(getGameInfo("Something else"), null);
  assert.equal(getGameInfo(undefined), null);
});

test("every panel is complete", () => {
  for (const info of [...Object.values(GAME_INFO), LISTENING_ROOM_INFO]) {
    assert.ok(info.title && info.intro && info.sections.length >= 2);
    assert.ok(info.sections.some((s) => s.heading === "Built with"));
    for (const s of info.sections) assert.ok(s.heading && (s.list?.length || s.paragraphs?.length));
  }
});