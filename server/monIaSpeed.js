// Speed and reliability for Mon IA's call to Google. Pure logic, no secrets: tested with a fake fetch.
//
// Why: Google's free Gemini models often answer slowly or return 503 "high demand". So instead of waiting on
// one model, Mon IA asks the main model and, if it is slow (hedgeMs) or fails, ALSO asks the next model.
// The first good answer wins and the others are cancelled.

export const DEFAULT_FALLBACK_MODELS = "gemini-3.1-flash-lite,gemini-3.5-flash";

// "a, b ,c" -> ["a","b","c"]  (only safe model names, no duplicates).
// Groq names look like "openai/gpt-oss-120b", so Groq lists pass { slash: true }. Gemini names go into a web
// address, so they never allow a slash.
export function parseModels(text, always = [], { slash = false } = {}) {
  const ok = slash ? /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?$/ : /^[A-Za-z0-9._-]+$/;
  const out = [];
  for (const raw of [...always, ...String(text || "").split(",")]) {
    const name = String(raw).trim();
    if (name && name.length <= 60 && ok.test(name) && !name.includes("..") && !out.includes(name)) out.push(name);
  }
  return out;
}

import { parseGeminiResponse } from "./monIaLogic.js";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GROQ_FALLBACKS = "openai/gpt-oss-20b";

async function errorDetail(res) {
  try {
    const j = await res.json();
    const m = j?.error?.message || j?.message;
    return typeof m === "string" ? m.slice(0, 160) : undefined; // the provider's reason, never the visitor's words
  } catch {
    return undefined;
  }
}

// One "attempt" = one model on one provider. run(signal) -> { ok:true, text } | { ok:true, blocked:true } | { status, detail? }
export function geminiAttempts({ apiKey, models, body, fetchImpl = fetch }) {
  return models.map((model) => ({
    id: model,
    provider: "gemini",
    async run(signal) {
      const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) return { status: res.status, detail: await errorDetail(res) };
      let data;
      try { data = await res.json(); } catch { return { status: 502 }; }
      const parsed = parseGeminiResponse(data);
      if (parsed.blocked) return { ok: true, blocked: true };
      if (parsed.empty) return { status: 502 };
      return { ok: true, text: parsed.text };
    },
  }));
}

// Groq speaks the OpenAI chat format. The gpt-oss models "think" before answering, so ask for the lowest effort.
export function groqAttempts({ apiKey, models, system, messages, fetchImpl = fetch }) {
  return models.map((model) => ({
    id: `groq:${model}`,
    provider: "groq",
    async run(signal) {
      const res = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...messages],
          max_completion_tokens: 600,
          temperature: 0.3,
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
        signal,
      });
      if (!res.ok) return { status: res.status, detail: await errorDetail(res) };
      let data;
      try { data = await res.json(); } catch { return { status: 502 }; }
      const text = data?.choices?.[0]?.message?.content;
      return typeof text === "string" && text.trim() ? { ok: true, text: text.trim() } : { status: 502 };
    },
  }));
}

// Asks the first attempt; if it is slow (hedgeMs) or fails, ALSO asks the next. First good answer wins, the rest are cancelled.
// A wrong key (401/403) switches off that provider only. -> { ok:true, text, blocked, model, ms, failures } | { ok:false, status, ms, failures, fatal? }
export function callModels({ attempts, hedgeMs = 1800, deadlineMs = 9000 }) {
  const started = Date.now();
  return new Promise((resolve) => {
    const controllers = [];
    const failures = [];
    const dead = new Set();
    let settled = false;
    let next = 0;
    let inFlight = 0;
    let hedgeTimer = null;

    const deadlineTimer = setTimeout(() => finish({ ok: false, status: 504 }), deadlineMs);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer);
      clearTimeout(deadlineTimer);
      for (const c of controllers) c.abort();
      resolve({ ...result, ms: Date.now() - started, failures });
    }

    function launch() {
      if (settled) return false;
      while (next < attempts.length && dead.has(attempts[next].provider)) next += 1;
      if (next >= attempts.length) return false;
      const attempt = attempts[next++];
      const controller = new AbortController();
      controllers.push(controller);
      inFlight += 1;
      clearTimeout(hedgeTimer);
      if (next < attempts.length) hedgeTimer = setTimeout(launch, hedgeMs);
      run(attempt, controller);
      return true;
    }

    async function run(attempt, controller) {
      let out;
      try {
        out = await attempt.run(controller.signal);
      } catch {
        out = { status: 0 }; // network problem, or we cancelled it
      }
      if (settled) return;
      if (out?.ok) return finish({ ok: true, text: out.text, blocked: !!out.blocked, model: attempt.id });
      const status = out?.status || 0;
      const keyProblem = status === 401 || status === 403;
      if (keyProblem) dead.add(attempt.provider);
      failures.push(out?.detail ? { model: attempt.id, status, detail: out.detail } : { model: attempt.id, status });
      inFlight -= 1;
      if (!launch() && inFlight === 0) finish({ ok: false, status: status || 502, ...(keyProblem ? { fatal: true } : {}) });
    }

    if (!attempts.length) finish({ ok: false, status: 500 });
    else launch();
  });
}

// Gemini only (kept for simple use and tests)
export function callGemini({ apiKey, models, body, fetchImpl = fetch, hedgeMs = 2500, deadlineMs = 9000 }) {
  return callModels({ attempts: geminiAttempts({ apiKey, models, body, fetchImpl }), hedgeMs, deadlineMs });
}

// Remembers answers to the same FIRST question (no conversation before it), so repeats are instant.
export function createAnswerCache({ ttlMs = 6 * 3600 * 1000, max = 200, now = Date.now } = {}) {
  const map = new Map();
  const key = (q) => String(q).normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  return {
    key,
    get(k) {
      const e = map.get(k);
      if (!e) return null;
      if (now() - e.at > ttlMs) { map.delete(k); return null; }
      return e.text;
    },
    set(k, text) {
      if (!k || !text) return;
      if (!map.has(k) && map.size >= max) map.delete(map.keys().next().value);
      map.set(k, { text, at: now() });
    },
  };
}