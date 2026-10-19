// Wordon rules, daily word and stats. Pure functions, no React: easy to test on their own.
export const WORD_LENGTH = 4; // keep in sync with WORD_LENGTH in scripts/build_wordon_lists.py
export const MAX_ATTEMPTS = 6;
export const DAILY_EPOCH = [2026, 9, 17]; // [year, month (0 = Jan), day]: this local date is day 0

export const CORRECT = "correct"; // right letter, right place  (green)
export const PRESENT = "present"; // right letter, wrong place  (yellow)
export const ABSENT = "absent"; //  no (more) of this letter   (grey)

const SHAPE = new RegExp(`^[a-z]{${WORD_LENGTH}}$`);
export const isWordShape = (word) => typeof word === "string" && SHAPE.test(word);

// allowed is a Set of every word a player may guess
export function isValidGuess(guess, allowed) {
  return isWordShape(guess) && allowed.has(guess);
}

// Feedback for one guess. Repeated letters are handled in two passes:
//  1. mark the greens, and count the solution's letters that greens did NOT use
//  2. left to right, a non-green letter is yellow only while one of those is left
export function evaluateGuess(guess, solution) {
  if (!isWordShape(guess) || !isWordShape(solution)) {
    throw new Error(`Need two ${WORD_LENGTH}-letter lowercase words: ${guess} / ${solution}`);
  }
  const result = Array(WORD_LENGTH).fill(ABSENT);
  const unused = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === solution[i]) result[i] = CORRECT;
    else unused[solution[i]] = (unused[solution[i]] || 0) + 1;
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] !== CORRECT && unused[guess[i]] > 0) {
      result[i] = PRESENT;
      unused[guess[i]] -= 1;
    }
  }
  return result;
}

const RANK = { [ABSENT]: 1, [PRESENT]: 2, [CORRECT]: 3 };

// On-screen keyboard colours: each key keeps its BEST result so far (never downgrades).
// Returns a NEW object.
export function mergeKeyStatuses(previous, guess, evaluation) {
  const next = { ...previous };
  for (let i = 0; i < guess.length; i++) {
    const letter = guess[i];
    if (!next[letter] || RANK[evaluation[i]] > RANK[next[letter]]) next[letter] = evaluation[i];
  }
  return next;
}

// "playing" | "won" | "lost" from the list of submitted guesses
export function deriveStatus(guesses, solution) {
  if (guesses.length && guesses[guesses.length - 1] === solution) return "won";
  return guesses.length >= MAX_ATTEMPTS ? "lost" : "playing";
}

// Screen-reader text for one submitted guess: "Guess 2 of 6: S absent, T present, ..."
export function describeGuess(guess, evaluation, attempt) {
  const parts = [...guess].map((letter, i) => `${letter.toUpperCase()} ${evaluation[i]}`);
  return `Guess ${attempt} of ${MAX_ATTEMPTS}: ${parts.join(", ")}`;
}

// ---------- daily word ----------
// Days are counted on the player's LOCAL calendar date (not a 24h timer), so the word
// changes at local midnight and a daylight-saving jump can never skip or repeat a day.
const dayNumber = (year, month, day) => Math.round(Date.UTC(year, month, day) / 86400000);

export function dayIndex(date, epoch = DAILY_EPOCH) {
  return dayNumber(date.getFullYear(), date.getMonth(), date.getDate()) - dayNumber(...epoch);
}

export function dailySolution(solutions, date, epoch = DAILY_EPOCH) {
  if (!solutions.length) throw new Error("No solutions");
  const n = solutions.length;
  return solutions[((dayIndex(date, epoch) % n) + n) % n];
}

export function dateKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// practice mode: a random answer, never the same one twice in a row
export function pickRandomSolution(solutions, rng = Math.random, avoid = null) {
  const pool = solutions.length > 1 ? solutions.filter((w) => w !== avoid) : solutions;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

// ---------- statistics ----------
export const emptyStats = () => ({ played: 0, wins: 0, streak: 0, maxStreak: 0, distribution: Array(MAX_ATTEMPTS).fill(0) });

// returns a NEW stats object. attempts = how many guesses a WIN took (1..MAX_ATTEMPTS)
export function recordResult(stats, { won, attempts }) {
  const next = { ...stats, distribution: [...stats.distribution], played: stats.played + 1 };
  if (!won) return { ...next, streak: 0 };
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > MAX_ATTEMPTS) throw new Error(`Invalid attempts: ${attempts}`);
  next.wins += 1;
  next.streak += 1;
  next.maxStreak = Math.max(next.maxStreak, next.streak);
  next.distribution[attempts - 1] += 1;
  return next;
}

export const winPercent = (stats) => (stats.played ? Math.round((stats.wins / stats.played) * 100) : 0);

const isCount = (n) => Number.isInteger(n) && n >= 0;

// Anything read back from localStorage may be missing, old or tampered with: trust nothing.
export function sanitizeStats(raw) {
  const ok =
    raw &&
    typeof raw === "object" &&
    [raw.played, raw.wins, raw.streak, raw.maxStreak].every(isCount) &&
    Array.isArray(raw.distribution) &&
    raw.distribution.length === MAX_ATTEMPTS &&
    raw.distribution.every(isCount) &&
    raw.wins <= raw.played &&
    raw.streak <= raw.maxStreak;
  return ok
    ? { played: raw.played, wins: raw.wins, streak: raw.streak, maxStreak: raw.maxStreak, distribution: [...raw.distribution] }
    : emptyStats();
}

// today's saved guesses, or null when nothing valid is saved for today
export function sanitizeDaily(raw, todayKey) {
  if (!raw || typeof raw !== "object" || raw.dateKey !== todayKey) return null;
  const { guesses } = raw;
  if (!Array.isArray(guesses) || guesses.length > MAX_ATTEMPTS || !guesses.every(isWordShape)) return null;
  return [...guesses];
}
