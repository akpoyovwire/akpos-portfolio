// Shared by add-track.mjs and validate-tracks.mjs (runs in Node, never in the browser).
export const MAX_SECONDS = 60;
export const DURATION_TOLERANCE = 0.5; // encoders pad a "60 s" clip by a few ms
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const AUDIO_EXT = [".mp3", ".m4a"];
export const TRACKS_PER_MONTH = 5;

export function parseSpotifyTrackUrl(input) {
  try {
    const u = new URL(String(input).trim());
    if (u.hostname !== "open.spotify.com") return null;
    const m = u.pathname.match(/\/track\/([A-Za-z0-9]{22})(?:\/|$)/);
    return m ? { id: m[1], url: `https://open.spotify.com/track/${m[1]}` } : null;
  } catch {
    return null;
  }
}

export function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "track";
}

export function nextFreePosition(tracks, month) {
  const used = new Set(tracks.filter((t) => t.month === month).map((t) => t.position));
  for (let p = 1; p <= TRACKS_PER_MONTH; p += 1) if (!used.has(p)) return p;
  return null;
}

// Replaces whatever sits at (month, position); returns a new array.
export function upsertTrack(tracks, entry) {
  return [...tracks.filter((t) => !(t.month === entry.month && t.position === entry.position)), entry].sort(
    (a, b) => (a.month === b.month ? a.position - b.position : a.month < b.month ? 1 : -1)
  );
}

const isStr = (v) => typeof v === "string" && v.trim().length > 0;

// Pure checks on the JSON itself. fileExists(publicPath) is injected so this is testable.
export function validateEntries(tracks, fileExists) {
  const errors = [];
  if (!Array.isArray(tracks)) return ["\"tracks\" must be an array"];
  const ids = new Set();
  const slots = new Set();
  tracks.forEach((t, i) => {
    const at = `track #${i + 1}${t && t.title ? ` (${t.title})` : ""}`;
    const bad = (msg) => errors.push(`${at}: ${msg}`);
    if (!isStr(t.id)) bad("missing id");
    else if (ids.has(t.id)) bad(`duplicate id "${t.id}"`);
    else ids.add(t.id);
    if (!isStr(t.title)) bad("missing title");
    if (!isStr(t.artist)) bad("missing artist");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.month || "")) bad("month must look like 2026-10");
    if (!Number.isInteger(t.position) || t.position < 1 || t.position > TRACKS_PER_MONTH) bad(`position must be 1-${TRACKS_PER_MONTH}`);
    const slot = `${t.month}#${t.position}`;
    if (t.published !== false) {
      if (slots.has(slot)) bad(`position ${t.position} is used twice in ${t.month}`);
      slots.add(slot);
    }
    if (t.commentary != null && (typeof t.commentary !== "string" || t.commentary.length > 1200)) bad("commentary must be text, 1200 characters max");
    for (const [field, prefix] of [["artwork", "/images/listening/"], ["artistImage", "/images/listening/"], ["audio", "/audio/"]]) {
      const v = t[field];
      if (v == null || v === "") continue;
      if (typeof v !== "string" || !v.startsWith(prefix) || v.includes("..")) bad(`${field} must be a path starting with ${prefix}`);
      else if (!fileExists(v)) bad(`${field} file not found: ${v}`);
    }
    if (t.audio && !AUDIO_EXT.some((e) => String(t.audio).toLowerCase().endsWith(e))) bad(`audio must be ${AUDIO_EXT.join(" or ")}`);
  });
  return errors;
}

// Size + duration of one audio file. readDuration(absPath) -> seconds, injected for tests.
export async function checkAudioFile(label, bytes, readDuration, absPath) {
  const errors = [];
  if (bytes > MAX_AUDIO_BYTES) errors.push(`${label}: ${(bytes / 1048576).toFixed(2)} MB is over the ${MAX_AUDIO_BYTES / 1048576} MB limit`);
  let seconds;
  try {
    seconds = await readDuration(absPath);
  } catch (e) {
    errors.push(`${label}: could not read audio duration (${e.message})`);
    return errors;
  }
  if (!Number.isFinite(seconds)) errors.push(`${label}: could not determine duration`);
  else if (seconds > MAX_SECONDS + DURATION_TOLERANCE) errors.push(`${label}: ${seconds.toFixed(1)} s is over the ${MAX_SECONDS} s limit`);
  return errors;
}

export async function defaultReadDuration(absPath) {
  let mm;
  try {
    mm = await import("music-metadata");
  } catch {
    throw new Error("music-metadata is not installed - run: npm i -D music-metadata");
  }
  const meta = await mm.parseFile(absPath, { duration: true });
  return meta.format.duration;
}
