// Quiz rules: picking questions, shuffling answers, scoring, and cleaning API data.
// Pure functions, no React: easy to test on their own.
export const QUESTIONS_PER_QUIZ = 10;

// keep in sync with CATEGORIES in scripts/build_quiz.py
export const CATEGORIES = [
  "Movies and television", "Music", "Politics and government", "Art and literature", "History",
  "Geography", "Science and technology", "Sports", "Famous people and culture", "General knowledge",
];
export const DIFFICULTIES = ["easy", "medium", "hard"];
const EASY_OR_MEDIUM = ["easy", "medium"];

// ---------- shuffling and picking ----------
// Fisher-Yates on a COPY. rng is injectable so tests can control it.
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const text = (v) => (typeof v === "string" ? v.trim() : "");
const sameKey = (v) => text(v).toLowerCase().replace(/\W+/g, " ").trim();

// A question must have text, exactly 4 different options, and an answer that is one of them.
export function isValidQuestion(q) {
  if (!q || typeof q !== "object") return false;
  if (!text(q.id) || !text(q.question) || !DIFFICULTIES.includes(q.difficulty)) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  const options = q.options.map(text);
  if (options.some((o) => !o)) return false;
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return false;
  return options.includes(text(q.answer));
}

// Picks `count` different questions (different ids AND different wording).
// Easy and medium come first; "hard" is only used to fill up. Never mutates the pool.
export function pickQuestions(pool, count = QUESTIONS_PER_QUIZ, rng = Math.random) {
  const seenIds = new Set();
  const seenText = new Set();
  const usable = [];
  for (const q of shuffle(pool.filter(isValidQuestion), rng)) {
    const key = sameKey(q.question);
    if (seenIds.has(q.id) || seenText.has(key)) continue;
    seenIds.add(q.id);
    seenText.add(key);
    usable.push(q);
  }
  const preferred = usable.filter((q) => EASY_OR_MEDIUM.includes(q.difficulty));
  const rest = usable.filter((q) => !EASY_OR_MEDIUM.includes(q.difficulty));
  return [...preferred, ...rest].slice(0, count);
}

// One playable question: options shuffled, and answerIndex always points at the right one
// (it is found AFTER shuffling, so shuffling can never corrupt the correct answer).
export function toPlayable(q, rng = Math.random) {
  const options = shuffle(q.options.map(text), rng);
  return {
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    question: text(q.question),
    options,
    answer: text(q.answer),
    answerIndex: options.indexOf(text(q.answer)),
    explanation: q.explanation || "",
    source: q.source || "",
  };
}

// A whole session: `count` different questions, each with shuffled options.
export function buildSession(pool, count = QUESTIONS_PER_QUIZ, rng = Math.random) {
  const picked = pickQuestions(pool, count, rng);
  if (picked.length < count) {
    throw new QuizError("not-enough", `Only ${picked.length} usable questions, need ${count}`);
  }
  return shuffle(picked, rng).map((q) => toPlayable(q, rng));
}

// ---------- answering and scoring ----------
export const isCorrect = (playable, index) => index === playable.answerIndex;
export const progressLabel = (index, total) => `Question ${index + 1} of ${total}`;

export function scoreMessage(score, total = QUESTIONS_PER_QUIZ) {
  const share = total ? score / total : 0;
  if (share === 1) return "Perfect score. Flawless.";
  if (share >= 0.8) return "Excellent. You know your stuff.";
  if (share >= 0.6) return "Solid. A good round.";
  if (share >= 0.4) return "Not bad. Try another round.";
  return "Tough round. Go again?";
}

export const titleCase = (word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : "");

// ---------- Open Trivia DB (themed quizzes) ----------
// categoryId values are Open Trivia DB's own category numbers
// (list them any time at https://opentdb.com/api_category.php).
export const TRIVIA_TOPICS = [
  { id: "music", label: "Music", categoryId: 12 },
  { id: "film", label: "Film", categoryId: 11 },
  { id: "video-games", label: "Video Games", categoryId: 15 },
  { id: "anime", label: "Anime & Manga", categoryId: 31 },
  { id: "general", label: "General Knowledge", categoryId: 9 },
];
export const TRIVIA_ATTRIBUTION = "Questions from Open Trivia DB";

// We ask for more than 10 so that, after dropping "hard" ones and bad ones, we still have 10.
export const triviaUrl = (topic, amount = 20) =>
  `https://opentdb.com/api.php?amount=${amount}&category=${topic.categoryId}&type=multiple&encode=base64`;

export class QuizError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "QuizError";
    this.code = code; // "rate-limit" | "no-results" | "bad-response" | "network" | "not-enough"
  }
}

// base64 text -> a normal string (handles accents and non-Latin letters)
export function decodeBase64(value) {
  const binary = atob(String(value));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

// Turns Open Trivia DB's reply into our question shape. Bad items are dropped, not guessed at.
export function normalizeTriviaResponse(json, topic) {
  if (!json || typeof json !== "object") throw new QuizError("bad-response", "Not a JSON object");
  if (json.response_code === 5) throw new QuizError("rate-limit", "Too many requests");
  if (json.response_code === 1) throw new QuizError("no-results", "No results for this topic");
  if (json.response_code !== 0 || !Array.isArray(json.results)) throw new QuizError("bad-response", "Unexpected reply");

  const out = [];
  json.results.forEach((item, i) => {
    try {
      if (decodeBase64(item.type) !== "multiple") return;
      const correct = decodeBase64(item.correct_answer);
      const wrong = item.incorrect_answers.map(decodeBase64);
      const q = {
        id: `trivia-${topic.id}-${i}`,
        category: decodeBase64(item.category),
        difficulty: decodeBase64(item.difficulty),
        question: decodeBase64(item.question),
        options: [correct, ...wrong],
        answer: correct,
        explanation: "", // the trivia service gives no explanations
        source: "Open Trivia DB",
      };
      if (isValidQuestion(q)) out.push(q);
    } catch {
      /* one broken item must not break the whole quiz: skip it */
    }
  });
  return out;
}

// Friendly text for each kind of failure
export function describeError(error) {
  switch (error?.code) {
    case "rate-limit":
      return "Too many quick requests. Wait a few seconds and try again.";
    case "network":
      return "Couldn't reach the question service. Check your connection and try again.";
    case "not-enough":
    case "no-results":
      return "The service didn't return enough questions for this topic. Try again or pick another topic.";
    default:
      return "Something went wrong loading the questions. Try again.";
  }
}
