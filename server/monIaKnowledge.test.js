// Run with:  node --test server/monIaKnowledge.test.js
// Checks the GENERATED knowledge file. Run it after every  python scripts/build_mon_ia_knowledge.py
import test from "node:test";
import assert from "node:assert/strict";
import { KNOWLEDGE } from "./monIaKnowledge.js";
import { buildSystemPrompt, extractAllowedLinks } from "./monIaLogic.js";

const CATEGORIES = ["identity", "expertise", "philosophy", "projects", "articles", "contact", "privacy", "assistant_rules"];
const all = KNOWLEDGE.map((k) => `${k.title}\n${k.text}`).join("\n");

test("records are well formed, unique, and in known categories", () => {
  assert.ok(KNOWLEDGE.length >= 15);
  assert.equal(new Set(KNOWLEDGE.map((k) => k.id)).size, KNOWLEDGE.length);
  for (const k of KNOWLEDGE) {
    assert.ok(CATEGORIES.includes(k.category), k.id);
    assert.ok(k.title && k.text && k.source, k.id);
  }
});

test("the facts Akpos supplied are there", () => {
  for (const must of ['Akpoyovwire means "Life is good" in Urhobo', "Akpos is an abbreviation of Akpoyovwire", "Ughelli North", "born in Warri", "Port Harcourt",
    "Build. Secure. Innovate. Educate.", "a problem solver and a visionary", "third person"]) assert.ok(all.includes(must), `missing: ${must}`);
});

test("drafts stay hidden: unconfirmed credentials and the unconfirmed games description are NOT published", () => {
  for (const hidden of ["ISC2", "NIIT", "CEH curriculum", "Tic-Tac-Toe"]) assert.ok(!all.includes(hidden), `${hidden} should still be a draft`);
});

test("no secrets, no tracking links, only https links", () => {
  for (const bad of ["AIza", "sb_secret_", "sk-", "eyJ", "utm_", "chatgpt.com", "BEGIN PRIVATE"]) assert.ok(!all.includes(bad), `found ${bad}`);
  // the word "password" may appear in a RULE ("never share passwords"), but never as a value like  password = ...
  assert.ok(!/(password|passwd|api[_ ]?key|secret|token)\s*[:=]\s*\S+/i.test(all), "something looks like a credential");
  const links = [...extractAllowedLinks(KNOWLEDGE)];
  assert.ok(links.includes("https://www.linkedin.com/in/akpoyovwire") && links.includes("https://github.com/akpoyovwire") && links.includes("https://medium.com/@akpoyovwire") && links.includes("ogbonakposofficial@gmail.com"));
  for (const l of links) assert.ok(l.startsWith("https://") || l.includes("@"), l);
});

test("the whole prompt stays a sensible size", () => {
  const prompt = buildSystemPrompt(KNOWLEDGE);
  assert.ok(prompt.length < 30000, `prompt is ${prompt.length} characters`);
});
