// Mon IA in the browser: suggested questions, request building, safe link detection, error text.
// Pure functions, no React: easy to test on their own.
export const MAX_CHARS = 500;
export const MAX_HISTORY = 8;
export const WELCOME = "Bonjour! I'm Mon IA, Akpoyovwire's Intelligence Artificielle assistant.  I'm here to help you explore Akpos's portfolio, discover his works, learn more about him and what he does";

export const SUGGESTIONS = ["What does Akpoyovwire mean?", "Get to meet Akpos", "Who is the person behind this portfolio?"];

// What Mon IA "says" while it waits for the answer (one at a time, changing every THINKING_MS)
export const THINKING_PHRASES = [
  "Thinking…",
  "Putting two and two together…",
  "Connecting the dots…",
  "Reading what Akpos has approved…",
  "Choosing my words…",
  "Double-checking the facts…",
  "Almost there…",
  "Still working on it…",
];
export const THINKING_MS = 1800;

// Same random numbers for the same whole number, so a bubble's pieces never change between renders.
export function seededRandom(seed) {
  let s = (Math.abs(Math.trunc(Number(seed) || 0)) % 2147483646) + 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

// The pieces a message bubble is built from: lots of tiny scraps of paper that tile the bubble exactly.
// Each one starts scattered (offset, spin, delay) and flies into place, like a burst played backwards.
export const SHARD_COLS = 18;
const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));
// taller bubbles (long answers) get more rows so the scraps stay tiny
export const shardRows = (length) => Math.max(3, Math.min(8, Math.ceil((Number(length) || 0) / 50)));
export function makeShards(seed, cols = SHARD_COLS, rows = 3) {
  const rand = seededRandom(seed * 7919 + 13);
  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pieces.push({
        id: `${c}-${r}`,
        x: (c * 100) / cols,
        y: (r * 100) / rows,
        w: 100 / cols,
        h: 100 / rows,
        sx: clamp(Math.round((rand() * 2 - 1) * 140), 140),
        sy: clamp(Math.round((rand() * 2 - 1) * 90), 90),
        sr: Math.round((rand() * 2 - 1) * 360),
        d: Math.round(rand() * 260),
      });
    }
  }
  return pieces;
}

// a random conversation number (UUID v4). It lives only in memory, never in browser storage.
export function newConversationId(cryptoImpl = globalThis.crypto) {
  if (cryptoImpl?.randomUUID) return cryptoImpl.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoImpl?.getRandomValues) cryptoImpl.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// only the last few messages, only role + content, plus the policy version the visitor accepted
export function buildRequestBody(messages, conversationId, consent) {
  return {
    consent,
    conversationId,
    messages: messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content })),
  };
}

// Splits text into plain pieces and links. Only http(s) and email links ever become links.
const LINK_RE = /(https?:\/\/[^\s<>()"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
export function linkify(text) {
  const tokens = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    let raw = match[0];
    const tail = raw.match(/[.,;:!?]+$/)?.[0] || "";
    if (tail) raw = raw.slice(0, -tail.length);
    if (match.index > last) tokens.push({ type: "text", text: text.slice(last, match.index) });
    tokens.push({ type: "link", text: raw, href: raw.includes("@") && !/^https?:/i.test(raw) ? `mailto:${raw}` : raw });
    if (tail) tokens.push({ type: "text", text: tail });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", text: text.slice(last) });
  return tokens;
}

export const toParagraphs = (text) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

export function describeApiError(err) {
  const status = err?.status;
  if (status === 429) return "You're sending messages quickly. Please wait a moment and try again.";
  if (status === 403) return "Mon IA can only be used from the portfolio website.";
  if ((status === 400 || status === 413) && typeof err?.message === "string" && err.message) return err.message;
  if (typeof status === "number") return "Mon IA is unavailable right now. Please try again in a moment.";
  return "Couldn't reach Mon IA. Check your connection and try again.";
}