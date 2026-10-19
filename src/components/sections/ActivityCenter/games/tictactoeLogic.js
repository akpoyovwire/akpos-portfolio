// Tic-Tac-Toe rules and Akpos's brain. Pure functions, no React: easy to test on their own.
// The board is an array of 9 cells (0..8, row by row): null, "X" or "O".
export const HUMAN = "X";
export const AI = "O";
export const MODES = ["easy", "locked"]; // "locked" = locked in: never loses
export const EMPTY_SCORE = { wins: 0, losses: 0, draws: 0 };

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6], // diagonals
];

export const emptyBoard = () => Array(9).fill(null);

export function availableMoves(board) {
  return board.reduce((moves, cell, i) => (cell ? moves : [...moves, i]), []);
}

// returns a NEW board, never mutates the old one
export function placeMark(board, index, mark) {
  if (!Number.isInteger(index) || index < 0 || index > 8) throw new Error(`Invalid cell: ${index}`);
  if (board[index]) throw new Error(`Cell ${index} is taken`);
  const next = [...board];
  next[index] = mark;
  return next;
}

// { status: "win", winner, line } | { status: "draw" } | { status: "playing" }
export function getResult(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { status: "win", winner: board[a], line };
    }
  }
  return board.every(Boolean) ? { status: "draw" } : { status: "playing" };
}

// "win" | "loss" | "draw" from the HUMAN's point of view (null while still playing)
export function outcomeFor(result) {
  if (result.status === "draw") return "draw";
  if (result.status === "win") return result.winner === HUMAN ? "win" : "loss";
  return null;
}

// returns a NEW score object, never mutates the old one
export function applyResult(score, result) {
  const outcome = outcomeFor(result);
  if (outcome === "win") return { ...score, wins: score.wins + 1 };
  if (outcome === "loss") return { ...score, losses: score.losses + 1 };
  if (outcome === "draw") return { ...score, draws: score.draws + 1 };
  return score;
}

const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

// Easy: plays loosely. Takes a win it can see only 60% of the time, never blocks
// on purpose, otherwise picks any free cell. Beatable, but not totally silly.
export function easyMove(board, ai = AI, rng = Math.random) {
  const moves = availableMoves(board);
  if (!moves.length) throw new Error("No moves left");
  const winning = moves.find((m) => getResult(placeMark(board, m, ai)).winner === ai);
  if (winning !== undefined && rng() < 0.6) return winning;
  return pick(moves, rng);
}

// Full search: +10 (minus depth) if the AI wins, -10 (plus depth) if the human does.
function minimax(board, turn, ai, human, depth) {
  const result = getResult(board);
  if (result.status === "win") return result.winner === ai ? 10 - depth : depth - 10;
  if (result.status === "draw") return 0;
  const scores = availableMoves(board).map((m) =>
    minimax(placeMark(board, m, turn), turn === ai ? human : ai, ai, human, depth + 1)
  );
  return turn === ai ? Math.max(...scores) : Math.min(...scores);
}

// Locked in: always plays a best move, so it can win but can never lose.
// Among equally good moves it picks at random, so games don't repeat exactly.
export function lockedMove(board, ai = AI, rng = Math.random) {
  const moves = availableMoves(board);
  if (!moves.length) throw new Error("No moves left");
  if (moves.length === 9) return pick([0, 2, 6, 8, 4], rng); // every opening draws: skip the search
  const human = ai === AI ? HUMAN : AI;
  const scored = moves.map((m) => ({ m, s: minimax(placeMark(board, m, ai), human, ai, human, 1) }));
  const best = Math.max(...scored.map((x) => x.s));
  return pick(scored.filter((x) => x.s === best).map((x) => x.m), rng);
}

export function chooseMove(board, mode, rng = Math.random) {
  if (!MODES.includes(mode)) throw new Error(`Invalid mode: ${mode}`);
  return mode === "locked" ? lockedMove(board, AI, rng) : easyMove(board, AI, rng);
}
