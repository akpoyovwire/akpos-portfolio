// npm run add-track -- <spotify track link>
// Pulls title + artwork from Spotify oEmbed (no account, no key) and artist name + artist
// photo from Deezer's public search (no key). You confirm or correct everything.
// Anything that fails falls back to typing it in. Nothing here downloads audio:
// the clip is a file YOU provide.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import {
  parseSpotifyTrackUrl, slugify, nextFreePosition, upsertTrack, checkAudioFile, defaultReadDuration,
  AUDIO_EXT, MAX_IMAGE_BYTES, TRACKS_PER_MONTH,
} from "./lib/tracks.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "src/data/listeningRoom.json");
const rl = readline.createInterface({ input, output });
const ask = async (q, def = "") => ((await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def);

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "portfolio-add-track" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function saveImage(url, destRel) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!(res.headers.get("content-type") || "").startsWith("image/")) throw new Error("not an image");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw new Error("image too large");
    const abs = path.join(root, "public", destRel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    return destRel;
  } catch (e) {
    console.log(`  (could not save image: ${e.message})`);
    return null;
  }
}

try {
  const link = parseSpotifyTrackUrl(process.argv[2] || (await ask("Spotify track link")));
  if (!link) throw new Error("That is not a Spotify track link (expected https://open.spotify.com/track/...).");

  // 1) Spotify oEmbed: title + artwork. Falls back to manual.
  let title = "", spotifyArt = null;
  try {
    const o = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(link.url)}`);
    title = o.title || "";
    spotifyArt = o.thumbnail_url || null;
    console.log(`Spotify says: "${title}"`);
  } catch (e) {
    console.log(`Spotify oEmbed failed (${e.message}) - you'll type the details.`);
  }

  // 2) Deezer: artist name, artist photo (and a backup cover). Falls back to manual.
  let artist = "", artistImg = null, deezerCover = null;
  if (title) {
    try {
      const r = await getJson(`https://api.deezer.com/search/track?q=${encodeURIComponent(title)}&limit=5`);
      const hits = (r.data || []).filter((h) => h.artist && h.artist.name);
      if (hits.length) {
        console.log("\nWho is the artist?");
        hits.forEach((h, i) => console.log(`  ${i + 1}) ${h.title} - ${h.artist.name}`));
        const pick = Number(await ask("Pick a number (Enter to type it yourself)"));
        const h = hits[pick - 1];
        if (h) {
          artist = h.artist.name;
          artistImg = h.artist.picture_xl || h.artist.picture_big || null;
          deezerCover = (h.album && (h.album.cover_xl || h.album.cover_big)) || null;
        }
      }
    } catch (e) {
      console.log(`Deezer lookup failed (${e.message}) - type the artist yourself.`);
    }
  }

  title = await ask("Title", title);
  artist = await ask("Artist", artist);
  if (!title || !artist) throw new Error("Title and artist are required.");
  const commentary = await ask("Why is it in your top five? (one line; you can edit the JSON later)");

  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  const now = new Date();
  const month = await ask("Month (YYYY-MM)", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must look like 2026-10.");
  const free = nextFreePosition(data.tracks, month);
  const position = Number(await ask(`Position 1-${TRACKS_PER_MONTH}`, free ? String(free) : "1"));
  if (!Number.isInteger(position) || position < 1 || position > TRACKS_PER_MONTH) throw new Error("Bad position.");
  const taken = data.tracks.find((t) => t.month === month && t.position === position);
  if (taken && (await ask(`#${position} in ${month} is "${taken.title}". Replace it? (y/N)`)).toLowerCase() !== "y") throw new Error("Cancelled.");

  // 3) Your own clip: validated here AND again at build time.
  const slug = `${month}-${position}-${slugify(title)}`;
  let audio = null;
  const clip = (await ask("Path to YOUR clip (.mp3 or .m4a, max 60 s, max 2 MB; Enter to skip)")).replace(/^["']|["']$/g, "");
  if (clip) {
    const ext = path.extname(clip).toLowerCase();
    if (!AUDIO_EXT.includes(ext)) throw new Error(`Clip must be ${AUDIO_EXT.join(" or ")}.`);
    if (!fs.existsSync(clip)) throw new Error("Clip file not found.");
    const problems = await checkAudioFile(path.basename(clip), fs.statSync(clip).size, defaultReadDuration, clip);
    if (problems.length) throw new Error(problems.join("\n"));
    fs.mkdirSync(path.join(root, "public/audio"), { recursive: true });
    fs.copyFileSync(clip, path.join(root, "public/audio", `${slug}${ext}`));
    audio = `/audio/${slug}${ext}`;
    console.log(`  clip OK -> public${audio}`);
  } else console.log("  no clip: this entry shows \"snippet coming soon\" until you add one.");

  // 4) Images are saved into your repo so the site never depends on Spotify/Deezer at runtime.
  const art = spotifyArt || deezerCover;
  const artwork = art ? await saveImage(art, `/images/listening/${slug}-art.jpg`) : null;
  const artistImage = artistImg ? await saveImage(artistImg, `/images/listening/${slug}-artist.jpg`) : null;

  const entry = { id: slug, month, position, title, artist, artwork, artistImage, audio, commentary: commentary || null, spotifyUrl: link.url, published: true };
  data.tracks = upsertTrack(data.tracks, entry);
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");
  console.log(`\nSaved #${position} for ${month}: ${title} - ${artist}\nRun "npm run validate:tracks", then commit and push to publish.`);
} catch (e) {
  console.error(`\n${e.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
