// Pure helpers for the Listening Room (no React), so they can be tested alone.
export const MAX_SNIPPET_SECONDS = 60;
export const TRACKS_PER_MONTH = 5;

const isPublished = (t) => t && t.published !== false;

export function formatTime(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function formatMonth(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(key || "");
  if (!m) return key || "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// Months that have at least one published track, newest first.
export function listMonths(tracks) {
  return [...new Set((tracks || []).filter(isPublished).map((t) => t.month))].sort().reverse();
}

// The published tracks of one month, in the order you configured (position 1 first).
export function tracksForMonth(tracks, month) {
  return (tracks || [])
    .filter((t) => isPublished(t) && t.month === month)
    .sort((a, b) => a.position - b.position)
    .slice(0, TRACKS_PER_MONTH);
}