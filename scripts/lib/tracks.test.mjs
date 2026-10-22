// Run: node --test scripts/lib/tracks.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseSpotifyTrackUrl, slugify, nextFreePosition, upsertTrack, validateEntries, checkAudioFile } from "./tracks.mjs";

const ID = "4uLU6hMCjMI75M1A2tKUQC";
const ok = (o = {}) => ({ id: "a", title: "T", artist: "A", month: "2026-10", position: 1, ...o });
const exists = () => true;

test("spotify links", () => {
  assert.equal(parseSpotifyTrackUrl(`https://open.spotify.com/track/${ID}?si=abc`).id, ID);
  assert.equal(parseSpotifyTrackUrl(`https://open.spotify.com/intl-fr/track/${ID}`).id, ID);
  assert.equal(parseSpotifyTrackUrl(`https://open.spotify.com/album/${ID}`), null);
  assert.equal(parseSpotifyTrackUrl(`https://evil.com/track/${ID}`), null);
  assert.equal(parseSpotifyTrackUrl("not a url"), null);
  assert.equal(parseSpotifyTrackUrl(`https://open.spotify.com/track/short`), null);
});
test("slugify", () => {
  assert.equal(slugify("Beyoncé – Halo (Live!)"), "beyonce-halo-live");
  assert.equal(slugify("???"), "track");
});
test("positions + upsert", () => {
  const t = [ok({ position: 1 }), ok({ id: "b", position: 2 })];
  assert.equal(nextFreePosition(t, "2026-10"), 3);
  assert.equal(nextFreePosition(t, "2026-11"), 1);
  const full = [1, 2, 3, 4, 5].map((p) => ok({ id: `x${p}`, position: p }));
  assert.equal(nextFreePosition(full, "2026-10"), null);
  const out = upsertTrack(t, ok({ id: "new", position: 2, title: "N" }));
  assert.equal(out.length, 2);
  assert.equal(out.find((x) => x.position === 2).title, "N");
});
test("valid entry passes", () => assert.deepEqual(validateEntries([ok({ audio: "/audio/a.mp3", artwork: "/images/listening/a.jpg" })], exists), []));
test("rejects bad data", () => {
  const e = validateEntries(
    [ok({ title: "" }), ok({ id: "b", month: "2026-13" }), ok({ id: "c", position: 6 }), ok({ id: "d", audio: "/audio/x.wav" }), ok({ id: "e", audio: "/audio/../secret.mp3" }), ok({ id: "f", artwork: "https://evil.com/a.jpg" })],
    exists
  ).join("\n");
  for (const s of ["missing title", "month must look like", "position must be 1-5", "audio must be .mp3 or .m4a", "audio must be a path", "artwork must be a path"]) assert.match(e, new RegExp(s));
});
test("duplicate position in a month is an error, unpublished one is not", () => {
  assert.match(validateEntries([ok(), ok({ id: "b" })], exists).join(), /used twice/);
  assert.deepEqual(validateEntries([ok(), ok({ id: "b", published: false })], exists), []);
  assert.match(validateEntries([ok(), ok({ position: 2 })], exists).join(), /duplicate id/);
});
test("missing file is an error", () => assert.match(validateEntries([ok({ audio: "/audio/a.mp3" })], () => false).join(), /not found/));
test("audio limits", async () => {
  assert.deepEqual(await checkAudioFile("a", 1000, async () => 59.9), []);
  assert.deepEqual(await checkAudioFile("a", 1000, async () => 60.4), []); // encoder padding
  assert.match((await checkAudioFile("a", 1000, async () => 61))[0], /over the 60 s/);
  assert.match((await checkAudioFile("a", 3 * 1048576, async () => 30))[0], /over the 2 MB/);
  assert.match((await checkAudioFile("a", 10, async () => { throw new Error("boom"); }))[0], /could not read/);
  assert.match((await checkAudioFile("a", 10, async () => NaN))[0], /could not determine/);
});
