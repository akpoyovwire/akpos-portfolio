// Mon IA's chat endpoint. Runs on the server (Vercel Function), so no key ever reaches the browser.
import { KNOWLEDGE } from "../server/monIaKnowledge.js";
import {
  CANNED, buildSystemPrompt, isAgeQuestion, applyControlTokens, extractAllowedLinks, sanitizeLinks,
  validateIncoming, toGeminiContents, dropCannedTurns, parseGeminiResponse, createLimiter, isSameOrigin,
} from "../server/monIaLogic.js";
import { insertMessage } from "../server/monIaStore.js";
import { PRIVACY_VERSION } from "../src/components/sections/ActivityCenter/MyAI/privacyPolicy.js";

// Lets Vercel finish saving the chat AFTER the visitor already has the answer. Needs:  npm i @vercel/functions
// If it is not installed this is null and the save simply runs on its own.
const waitUntil = await import("@vercel/functions").then((m) => m.waitUntil).catch(() => null);
const GOOGLE_TIMEOUT_MS = 15000;

const SYSTEM_PROMPT = buildSystemPrompt(KNOWLEDGE);
const ALLOWED_LINKS = extractAllowedLinks(KNOWLEDGE);
const limiter = createLimiter({ perMinute: 8, perHour: 60 }); // best effort: memory is per warm server instance

// Saves the exchange. A recording problem is logged (without the visitor's words) but never breaks the chat.
async function record(conversationId, question, answer, kind) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("Mon IA: chat recording is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)");
    return;
  }
  try {
    await insertMessage({ url, key }, { conversationId, question, answer, kind, policyVersion: PRIVACY_VERSION });
  } catch (err) {
    console.error("Mon IA: could not record the chat:", err.message);
  }
}

// Sends the answer straight away, THEN finishes saving the chat (the visitor never waits for the database).
async function reply(res, startedAt, googleMs, conversationId, question, answer, kind) {
  const saving = record(conversationId, question, answer, kind);
  if (waitUntil) waitUntil(saving);
  const total = Date.now() - startedAt;
  res.setHeader("Server-Timing", `google;dur=${googleMs}, total;dur=${total}`);
  console.log(`Mon IA timing: google ${googleMs}ms, total before reply ${total}ms`);
  res.status(200).json({ reply: answer, kind });
  await saving;
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  let googleMs = 0;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
    if (!isSameOrigin(req.headers.origin, req.headers.host)) return res.status(403).json({ error: "Not allowed." });

    const { GEMINI_API_KEY, GEMINI_MODEL } = process.env;
    if (!GEMINI_API_KEY || !GEMINI_MODEL || !/^[A-Za-z0-9._-]+$/.test(GEMINI_MODEL)) {
      console.error("Mon IA: GEMINI_API_KEY or GEMINI_MODEL is missing or invalid");
      return res.status(500).json({ error: "Mon IA is not set up yet." });
    }

    // rate limit per visitor (the address is used only for this, in memory, and is not recorded)
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
    const limit = limiter.check(ip);
    if (!limit.ok) {
      res.setHeader("Retry-After", String(limit.retryAfter));
      return res.status(429).json({ error: "You're sending messages quickly. Please wait a moment." });
    }

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = null; }
    }
    const checked = validateIncoming(body, { policyVersion: PRIVACY_VERSION });
    if (!checked.ok) return res.status(checked.status).json({ error: checked.error });
    const { messages, conversationId } = checked;
    const question = messages[messages.length - 1].content;

    // age questions are answered here, in code, without asking the AI
    if (isAgeQuestion(question)) {
      return await reply(res, startedAt, 0, conversationId, question, CANNED.age, "age");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
    const googleStart = Date.now();
    let g;
    try {
      g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      signal: controller.signal,
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: toGeminiContents(dropCannedTurns(messages)),
        generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
      }),
      });
    } catch (err) {
      console.error("Mon IA: Google did not answer in time or could not be reached:", err?.name);
      return res.status(504).json({ error: "Mon IA took too long to answer. Please try again." });
    } finally {
      clearTimeout(timer);
    }
    googleMs = Date.now() - googleStart;
    if (!g.ok) {
      console.error("Mon IA: Gemini error", g.status);
      return res.status(502).json({ error: "Mon IA is unavailable right now." });
    }
    const parsed = parseGeminiResponse(await g.json());

    let answerText;
    let kind;
    if (parsed.blocked) {
      answerText = CANNED.refuse;
      kind = "refuse";
    } else if (parsed.empty) {
      return res.status(502).json({ error: "Mon IA couldn't answer that. Please try again." });
    } else {
      const mapped = applyControlTokens(parsed.text);
      kind = mapped.kind;
      answerText = kind === "answer" ? sanitizeLinks(mapped.text, ALLOWED_LINKS) : mapped.text;
      if (!answerText) return res.status(502).json({ error: "Mon IA couldn't answer that. Please try again." });
    }

    return await reply(res, startedAt, googleMs, conversationId, question, answerText, kind);
  } catch (err) {
    console.error("Mon IA crashed:", err?.message);
    return res.status(500).json({ error: "Something went wrong." });
  }
}