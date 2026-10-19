// Rock Paper Scissors rules. Pure functions, no React: easy to test on their own.
export const CHOICES = ["rock", "paper", "scissors"];
export const EMPTY_SCORE = { wins: 0, losses: 0, draws: 0 };

// key beats value
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

export function isValidChoice(choice) {
  return CHOICES.includes(choice);
}

// returns "win" | "loss" | "draw" from the PLAYER's point of view
export function getOutcome(player, computer) {
  if (!isValidChoice(player) || !isValidChoice(computer)) {
    throw new Error(`Invalid choice: ${player} vs ${computer}`);
  }
  if (player === computer) return "draw";
  return BEATS[player] === computer ? "win" : "loss";
}

// rng is injectable so tests can control it; defaults to Math.random
export function randomChoice(rng = Math.random) {
  const index = Math.min(CHOICES.length - 1, Math.floor(rng() * CHOICES.length));
  return CHOICES[index];
}

// returns a NEW score object, never mutates the old one
export function applyOutcome(score, outcome) {
  if (outcome === "win") return { ...score, wins: score.wins + 1 };
  if (outcome === "loss") return { ...score, losses: score.losses + 1 };
  if (outcome === "draw") return { ...score, draws: score.draws + 1 };
  throw new Error(`Invalid outcome: ${outcome}`);
}

// "Rock beats scissors." / "Both chose paper."
export function describeRound(player, computer, outcome) {
  const name = (c) => c.charAt(0).toUpperCase() + c.slice(1);
  if (outcome === "draw") return `Both chose ${player}.`;
  const winner = outcome === "win" ? player : computer;
  const loser = outcome === "win" ? computer : player;
  return `${name(winner)} beats ${loser}.`;
}
