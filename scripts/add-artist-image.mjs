// npm run add-artist-image -- <Spotify artist link | image link | path to an image file> [--no-cutout]
//
// Gets a picture of the artist, cuts the background out (runs on YOUR computer, nothing is
// uploaded), saves a transparent PNG in public/images/listening/artists/ and points the
// matching track(s) in src/data/listeningRoom.json at it.
//
// One-time setup:   npm i -D @imgly/background-removal-node sharp
// --no-cutout       use when the image you give is ALREADY a transparent PNG.
//
// Only use pictures you have the right to use (see the notes in the chat): your own photos,
// Creative Commons / public-domain images, or press photos you have permission for.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { slugify } from "./lib/tracks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "src/data/listeningRoom.json");
const outDir = path.join(root, "public/images/listening/artists");
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const args = process.argv.slice(2);
const noCutout = args.includes("--no-cutout");
const source = args.find((a) => !a.startsWith("--"));

const rl = readline.createInterface({ input, output });
const ask = async (q, def = "") => ((await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def);

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "portfolio-add-artist-image" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function sniffMime(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

async function download(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_INPUT_BYTES) throw new Error("image too large (max 15 MB)");
  return buf;
}

// Spotify artist link -> artist name (oEmbed, no key). Photo comes from Deezer (bigger), Spotify's thumbnail is the backup.
async function fromSpotifyArtist(url) {
  const o = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
  const name = o.title || "";
  console.log(`Spotify says the artist is: "${name}"`);
  let imageUrl = null;
  try {
    const r = await getJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=3`);
    const hits = (r.data || []).filter((h) => h.picture_xl || h.picture_big);
    if (hits.length) {
      console.log("\nWhich one is it?");
      hits.forEach((h, i) => console.log(`  ${i + 1}) ${h.name}`));
      const pick = Number(await ask("Pick a number (Enter = 1)", "1"));
      const h = hits[pick - 1] || hits[0];
      imageUrl = h.picture_xl || h.picture_big;
    }
  } catch (e) {
    console.log(`Deezer lookup failed (${e.message}).`);
  }
  imageUrl = imageUrl || o.thumbnail_url || null;
  if (!imageUrl) throw new Error("No picture found. Give me an image link or a file instead.");
  return { name, buf: await download(imageUrl) };
}

async function cutOut(buf) {
  let mod;
  try {
    mod = await import("@imgly/background-removal-node");
  } catch {
    throw new Error('Missing the cut-out tool. Run:  npm i -D @imgly/background-removal-node sharp');
  }
  const mime = sniffMime(buf);
  if (!mime) throw new Error("That file is not a PNG, JPG or WebP image.");
  console.log("Cutting out the background (the first run is slow while the model loads)...");
  const blob = await mod.removeBackground(new Blob([buf], { type: mime }), { output: { format: "image/png" } });
  return Buffer.from(await blob.arrayBuffer());
}

// Trim empty edges + cap the height so the file stays small. Skipped quietly if sharp is not installed.
async function tidy(buf) {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buf).trim().resize({ height: 900, withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    console.log("  (sharp not installed: skipped trimming/resizing)");
    return buf;
  }
}

try {
  const src = source || (await ask("Spotify artist link, image link, or file path"));
  let name = "", buf;

  if (/open\.spotify\.com\/(intl-[a-z]+\/)?artist\//i.test(src)) {
    ({ name, buf } = await fromSpotifyArtist(src));
  } else if (/^https?:\/\//i.test(src)) {
    buf = await download(src);
  } else {
    const file = src.replace(/^["']|["']$/g, "");
    if (!fs.existsSync(file)) throw new Error("File not found.");
    if (fs.statSync(file).size > MAX_INPUT_BYTES) throw new Error("image too large (max 15 MB)");
    buf = fs.readFileSync(file);
  }
  if (!sniffMime(buf)) throw new Error("That is not a PNG, JPG or WebP image.");

  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!data.tracks.length) throw new Error("No tracks in listeningRoom.json yet. Run add-track first.");
  const list = [...data.tracks].sort((a, b) => b.month.localeCompare(a.month) || a.position - b.position);
  console.log("\nWhose picture is this?");
  list.forEach((t, i) => console.log(`  ${i + 1}) ${t.month} #${t.position}  ${t.title} - ${t.artist}`));
  const lower = name.toLowerCase();
  const guess = lower ? list.findIndex((t) => t.artist.toLowerCase().includes(lower) || lower.includes(t.artist.toLowerCase())) : -1;
  const chosen = list[Number(await ask("Pick a number", guess >= 0 ? String(guess + 1) : "1")) - 1];
  if (!chosen) throw new Error("Bad number.");

  const same = data.tracks.filter((t) => t.artist.toLowerCase() === chosen.artist.toLowerCase());
  let targets = [chosen];
  if (same.length > 1 && (await ask(`Use it for all ${same.length} tracks by ${chosen.artist}? (Y/n)`, "y")).toLowerCase() !== "n") targets = same;

  const cut = noCutout ? buf : await cutOut(buf);
  const png = await tidy(cut);
  const rel = `/images/listening/artists/${slugify(chosen.artist)}.png`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(root, "public", rel), png);

  for (const t of targets) t.artistImage = rel;   // same objects as in data.tracks
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");
  console.log(`\nSaved public${rel} (${Math.round(png.length / 1024)} KB) for ${targets.length} track(s).`);
  console.log('Open the Listening Room to check the edges. Run "npm run validate:tracks", then commit and push.');
} catch (e) {
  console.error(`\n${e.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
