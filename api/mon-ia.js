// Mon IA's chat endpoint. Runs on the server (Vercel Function), so no key ever reaches the browser.
import { KNOWLEDGE } from "../server/monIaKnowledge.js";
import {
  CANNED, buildSystemPrompt, isAgeQuestion, applyControlTokens, extractAllowedLinks, sanitizeLinks,
  validateIncoming, toGeminiContents, dropCannedTurns, createLimiter, isSameOrigin,
} from "../server/monIaLogic.js";
import { insertMessage } from "../server/monIaStore.js";
import {
  callModels, geminiAttempts, groqAttempts, parseModels, createAnswerCache,
  DEFAULT_FALLBACK_MODELS, DEFAULT_GROQ_MODEL, DEFAULT_GROQ_FALLBACKS,
} from "../server/monIaSpeed.js";
import { PRIVACY_VERSION } from "../src/components/sections/ActivityCenter/MyAI/privacyPolicy.js";

// Lets Vercel finish saving the chat AFTER the visitor already has the answer. Needs:  npm i @vercel/functions
// If it is not installed this is null and the save simply runs on its own.
const waitUntil = await import("@vercel/functions").then((m) => m.waitUntil).catch(() => null);

const SYSTEM_PROMPT = buildSystemPrompt(KNOWLEDGE);
const ALLOWED_LINKS = extractAllowedLinks(KNOWLEDGE);
const answerCache = createAnswerCache(); // repeats of the same first question are answered instantly, with no Google call
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
async function reply(res, startedAt, googleMs, conversationId, question, answer, kind, via = "google") {
  const saving = record(conversationId, question, answer, kind);
  if (waitUntil) waitUntil(saving);
  const total = Date.now() - startedAt;
  res.setHeader("Server-Timing", `ai;dur=${googleMs}, total;dur=${total}`);
  console.log(`Mon IA timing: ${googleMs}ms by ${via}, total before reply ${total}ms`);
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

    // Groq (very fast) is asked first; Google Gemini is the backup. At least one of them must be set up.
    const { GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY } = process.env;
    const groqModels = GROQ_API_KEY ? parseModels(process.env.GROQ_FALLBACK_MODELS ?? DEFAULT_GROQ_FALLBACKS, [process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL], { slash: true }) : [];
    const geminiModels = GEMINI_API_KEY && GEMINI_MODEL ? parseModels(process.env.GEMINI_FALLBACK_MODELS ?? DEFAULT_FALLBACK_MODELS, [GEMINI_MODEL]) : [];
    if (!groqModels.length && !geminiModels.length) {
      console.error("Mon IA: neither GROQ_API_KEY nor GEMINI_API_KEY + GEMINI_MODEL is set (or a model name is invalid)");
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

    // the same first question again: answered from memory, instantly
    const cacheKey = messages.length === 1 ? answerCache.key(question) : null;
    const cached = cacheKey ? answerCache.get(cacheKey) : null;
    if (cached) return await reply(res, startedAt, 0, conversationId, question, cached, "answer", "memory");

    // ask Groq first; if it is slow or fails, also ask Gemini. The first good answer wins.
    const history = dropCannedTurns(messages);
    const result = await callModels({
      attempts: [
        ...groqAttempts({ apiKey: GROQ_API_KEY, models: groqModels, system: SYSTEM_PROMPT, messages: history }),
        ...geminiAttempts({
          apiKey: GEMINI_API_KEY,
          models: geminiModels,
          body: {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: toGeminiContents(history),
            generationConfig: { maxOutputTokens: 500, temperature: 0.3 },
          },
        }),
      ],
      hedgeMs: Number(process.env.MON_IA_HEDGE_MS) || 1800,
      deadlineMs: Number(process.env.MON_IA_DEADLINE_MS) || 9000,
    });
    googleMs = result.ms;
    if (!result.ok) {
      console.error("Mon IA: no AI service answered:", result.status, JSON.stringify(result.failures));
      return result.status === 504
        ? res.status(504).json({ error: "Mon IA took too long to answer. Please try again." })
        : res.status(502).json({ error: "Mon IA is unavailable right now." });
    }
    if (result.failures.length) console.log("Mon IA: skipped before the answer:", JSON.stringify(result.failures));

    let answerText;
    let kind;
    if (result.blocked) {
      answerText = CANNED.refuse;
      kind = "refuse";
    } else {
      const mapped = applyControlTokens(result.text);
      kind = mapped.kind;
      answerText = kind === "answer" ? sanitizeLinks(mapped.text, ALLOWED_LINKS) : mapped.text;
      if (!answerText) return res.status(502).json({ error: "Mon IA couldn't answer that. Please try again." });
    }

    if (cacheKey && kind === "answer") answerCache.set(cacheKey, answerText);
    return await reply(res, startedAt, googleMs, conversationId, question, answerText, kind, result.model);
  } catch (err) {
    console.error("Mon IA crashed:", err?.message);
    return res.status(500).json({ error: "Something went wrong." });
  }
}