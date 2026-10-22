// Fails the build if the Listening Room data or any file in public/audio breaks the rules.
// Runs automatically before "npm run build" (see "prebuild" in package.json), so a bad
// clip can't reach Vercel. Every file in public/audio is checked, referenced or not,
// because everything in public/ is served to the world.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEntries, checkAudioFile, defaultReadDuration, AUDIO_EXT } from "./lib/tracks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "src/data/listeningRoom.json");
const pub = (p) => path.join(root, "public", p);

let data;
try {
  data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
} catch (e) {
  console.error(`Listening Room: cannot read src/data/listeningRoom.json (${e.message})`);
  process.exit(1);
}

const errors = validateEntries(data.tracks, (p) => fs.existsSync(pub(p)));

const audioDir = pub("/audio");
const files = fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter((f) => !f.startsWith(".")) : [];
for (const f of files) {
  const abs = path.join(audioDir, f);
  if (!AUDIO_EXT.some((e) => f.toLowerCase().endsWith(e))) {
    errors.push(`public/audio/${f}: only ${AUDIO_EXT.join(" / ")} files are allowed`);
    continue;
  }
  errors.push(...(await checkAudioFile(`public/audio/${f}`, fs.statSync(abs).size, defaultReadDuration, abs)));
}

if (errors.length) {
  console.error("\nListening Room validation failed:\n" + errors.map((e) => `  - ${e}`).join("\n") + "\n");
  process.exit(1);
}
console.log(`Listening Room: ${data.tracks.length} track(s), ${files.length} audio file(s) OK`);
