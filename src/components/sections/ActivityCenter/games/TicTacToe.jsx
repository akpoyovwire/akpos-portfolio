import React, { useCallback, useEffect, useRef, useState } from "react";
import { HUMAN, AI, EMPTY_SCORE, emptyBoard, placeMark, getResult, outcomeFor, applyResult, chooseMove } from "./tictactoeLogic";

const THINK_MS = 550; // Akpos "thinks" for a moment so his move doesn't feel instant

const MODE_LABELS = { easy: "Easy", locked: "Locked in" };
const LABELS = { win: "You win!", loss: "Akpos wins", draw: "It's a draw" };

// One drawn mark. pathLength="1" lets the CSS draw each stroke in.
function Mark({ kind }) {
  return (
    <svg viewBox="0 0 100 100" className={`ttt-mark ttt-mark--${kind.toLowerCase()}`} aria-hidden="true" focusable="false">
      {kind === HUMAN ? (
        <>
          <path pathLength="1" d="M27 27 L73 73" />
          <path pathLength="1" d="M73 27 L27 73" />
        </>
      ) : (
        <circle pathLength="1" cx="50" cy="50" r="24" />
      )}
    </svg>
  );
}

// Reuses the Rock Paper Scissors score / status styles (.rps-score*, .rps-status*)
// so both games look the same.
export default function TicTacToe() {
  // phase: "pick" (no mode yet) -> "you" -> "akpos" -> "over"
  const [mode, setMode] = useState(null);
  const [board, setBoard] = useState(emptyBoard);
  const [phase, setPhase] = useState("pick");
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(EMPTY_SCORE);
  const [round, setRound] = useState(0); // even rounds: you start, odd rounds: Akpos starts

  const timerRef = useRef(null);
  const phaseRef = useRef("pick");
  const boardRef = useRef(board);
  const modeRef = useRef(null);
  const rootRef = useRef(null);
  const easyRef = useRef(null);
  const nextRef = useRef(null);
  const cellRefs = useRef([]);

  const go = (next) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const commit = (next) => {
    boardRef.current = next;
    setBoard(next);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // returns true when the game just ended
  const finish = (nextBoard) => {
    const res = getResult(nextBoard);
    if (res.status === "playing") return false;
    setResult(res);
    setScore((s) => applyResult(s, res));
    go("over");
    return true;
  };

  const scheduleAkpos = (fromBoard, forMode) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const next = placeMark(fromBoard, chooseMove(fromBoard, forMode), AI);
      commit(next);
      if (!finish(next)) go("you");
    }, THINK_MS);
  };

  const startRound = (forMode, roundNo) => {
    clearTimeout(timerRef.current);
    const fresh = emptyBoard();
    commit(fresh);
    setResult(null);
    setRound(roundNo);
    if (roundNo % 2 === 0) {
      go("you");
    } else {
      go("akpos");
      scheduleAkpos(fresh, forMode);
    }
  };

  const pickMode = (m) => {
    modeRef.current = m;
    setMode(m);
    startRound(m, mode ? round : 0); // switching mode keeps the score, restarts the board
  };

  const play = useCallback((i) => {
    if (phaseRef.current !== "you" || boardRef.current[i]) return; // one move at a time
    const next = placeMark(boardRef.current, i, HUMAN);
    commit(next);
    if (!finish(next)) {
      go("akpos");
      scheduleAkpos(next, modeRef.current);
    }
  }, []);

  const nextRound = () => {
    if (phaseRef.current !== "over") return;
    startRound(modeRef.current, round + 1);
  };

  const resetScore = () => {
    setScore(EMPTY_SCORE);
    if (modeRef.current) startRound(modeRef.current, 0);
  };

  // Keyboard focus: Easy on arrival, a cell when a round starts, "Next round" when it ends.
  useEffect(() => {
    if (phase === "pick") easyRef.current?.focus();
    if (phase === "over") nextRef.current?.focus();
    if (phase === "you" && rootRef.current && !rootRef.current.contains(document.activeElement)) {
      cellRefs.current[4]?.focus();
    }
  }, [phase, round]);

  // Arrow keys: on the board they move cell to cell (left/right by 1, up/down by a row,
  // wrapping); anywhere else they move between the enabled buttons, like Rock Paper Scissors.
  useEffect(() => {
    const onKey = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement;
      const cell = active?.dataset?.cell;
      e.preventDefault();
      if (cell !== undefined) {
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
        cellRefs.current[(Number(cell) + step + 9) % 9]?.focus();
        return;
      }
      const items = [...root.querySelectorAll("button:not(:disabled)")];
      if (!items.length) return;
      const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
      const i = items.indexOf(active);
      const next = i === -1 ? (forward ? 0 : items.length - 1) : (i + (forward ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const outcome = result ? outcomeFor(result) : null;
  const winLine = result?.status === "win" ? result.line : null;
  const canPlay = phase === "you";

  let main = "Choose your mode";
  let sub = "Easy or locked in?";
  if (phase === "you") {
    main = "Your move";
    sub = "You are X";
  } else if (phase === "akpos") {
    main = "Akpos is thinking…";
    sub = "You are X";
  } else if (phase === "over") {
    main = LABELS[outcome];
    sub =
      outcome === "win"
        ? "Three in a row."
        : outcome === "loss"
          ? "Akpos got three in a row."
          : mode === "locked"
            ? "Locked in never loses. A draw is your best."
            : "Nobody got three in a row.";
  }

  return (
    <div className="ttt" ref={rootRef}>
      <dl className="rps-score" aria-label="Score">
        <div className="rps-score-item rps-score-item--you">
          <dt>You</dt>
          <dd>{score.wins}</dd>
        </div>
        <div className="rps-score-item">
          <dt>Draws</dt>
          <dd>{score.draws}</dd>
        </div>
        <div className="rps-score-item rps-score-item--cpu">
          <dt>Akpos</dt>
          <dd>{score.losses}</dd>
        </div>
      </dl>

      <div className="ttt-modes" role="group" aria-label="Choose how hard Akpos plays">
        {Object.entries(MODE_LABELS).map(([m, label]) => (
          <button
            key={m}
            ref={m === "easy" ? easyRef : undefined}
            type="button"
            className={`activity-game-btn${mode === m ? " activity-game-btn--primary" : ""}`}
            aria-pressed={mode === m}
            onClick={() => pickMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={`ttt-board${phase === "pick" ? " ttt-board--ghost" : ""}`} role="group" aria-label="Tic-Tac-Toe board">
        {board.map((mark, i) => (
          <button
            key={i}
            ref={(el) => (cellRefs.current[i] = el)}
            data-cell={i}
            type="button"
            className={`ttt-cell${winLine?.includes(i) ? " ttt-cell--win" : ""}${winLine && !winLine.includes(i) ? " ttt-cell--dim" : ""}`}
            onClick={() => play(i)}
            aria-disabled={!canPlay || !!mark}
            aria-label={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, ${mark ? mark : "empty"}`}
          >
            {mark && <Mark kind={mark} />}
          </button>
        ))}
      </div>

      <div className="rps-status" role="status" aria-live="polite">
        <p className={`rps-status-main${outcome && outcome !== "draw" ? ` rps-status-main--${outcome}` : ""}`}>{main}</p>
        <p className="rps-status-sub">{sub}</p>
      </div>

      <div className="rps-actions">
        <button ref={nextRef} type="button" className="activity-game-btn activity-game-btn--primary" onClick={nextRound} disabled={phase !== "over"}>
          Next round
        </button>
        <button type="button" className="activity-game-btn" onClick={resetScore}>
          Reset score
        </button>
      </div>
    </div>
  );
}
