import { QUESTIONS_PER_QUIZ, QuizError, buildSession, normalizeTriviaResponse, triviaUrl } from "./quizLogic.js";

const TIMEOUT_MS = 10000;

// Fetches a themed quiz from Open Trivia DB straight from the visitor's browser
// (their own request limit, no key, nothing of yours is used up).
// fetchImpl / signal / rng are injectable so this can be tested without the internet.
export async function fetchTriviaSession(topic, { fetchImpl = fetch, signal, rng = Math.random, timeoutMs = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forward = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", forward, { once: true });
  }
  try {
    let response;
    try {
      response = await fetchImpl(triviaUrl(topic), { signal: controller.signal });
    } catch (err) {
      if (signal?.aborted) throw err; // the visitor left: not an error worth showing
      throw new QuizError("network", "Request failed or timed out");
    }
    if (response.status === 429) throw new QuizError("rate-limit", "HTTP 429");
    if (!response.ok) throw new QuizError("bad-response", `HTTP ${response.status}`);
    let json;
    try {
      json = await response.json();
    } catch {
      throw new QuizError("bad-response", "Reply was not JSON");
    }
    const questions = normalizeTriviaResponse(json, topic);
    return buildSession(questions, QUESTIONS_PER_QUIZ, rng); // throws "not-enough" when fewer than 10 are usable
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}
