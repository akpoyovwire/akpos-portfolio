import React, { useCallback, useEffect, useRef, useState } from "react";
import HandIcon from "./HandIcon";
import { CHOICES, EMPTY_SCORE, getOutcome, randomChoice, applyOutcome, describeRound } from "./rpsLogic";

const REVEAL_MS = 800; // both fists shake, then the choices are revealed

const LABELS = { win: "You win!", loss: "Akpos wins", draw: "It's a draw" };

export default function RockPaperScissors() {
  // phase: "choose" -> "reveal" (fists shaking) -> "result"
  const [phase, setPhase] = useState("choose");
  const [round, setRound] = useState(null); // { player, akpos, outcome }
  const [pending, setPending] = useState(null); // player's pick while the fists shake
  const [score, setScore] = useState(EMPTY_SCORE);
  const timerRef = useRef(null);
  const phaseRef = useRef("choose");
  const rootRef = useRef(null);
  const firstChoiceRef = useRef(null);
  const nextRef = useRef(null);

  const go = (next) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Keyboard: Rock gets focus when a round starts, "Next round" gets focus when
  // it ends, so Enter always does the obvious thing.
  useEffect(() => {
    if (phase === "result") nextRef.current?.focus();
    if (phase === "choose") firstChoiceRef.current?.focus();
  }, [phase]);

  // Arrow keys (and Up/Down) move between every enabled button, wrapping around.
  useEffect(() => {
    const onKey = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const root = rootRef.current;
      if (!root) return;
      const items = [...root.querySelectorAll("button:not(:disabled)")];
      if (!items.length) return;
      e.preventDefault();
      const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
      const i = items.indexOf(document.activeElement);
      const next = i === -1 ? (forward ? 0 : items.length - 1) : (i + (forward ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = useCallback((player) => {
    // guard against double clicks / key repeat: only one pick per round
    if (phaseRef.current !== "choose") return;
    go("reveal");
    setPending(player);
    const akpos = randomChoice();
    timerRef.current = setTimeout(() => {
      const outcome = getOutcome(player, akpos);
      setRound({ player, akpos, outcome });
      setScore((s) => applyOutcome(s, outcome));
      go("result");
    }, REVEAL_MS);
  }, []);

  const nextRound = () => {
    if (phaseRef.current !== "result") return;
    setRound(null);
    setPending(null);
    go("choose");
  };

  const resetScore = () => {
    clearTimeout(timerRef.current);
    setScore(EMPTY_SCORE);
    setRound(null);
    setPending(null);
    go("choose");
  };

  const shaking = phase === "reveal";
  const idle = phase === "choose"; // before a pick: faint "ghost" fists
  const youHand = phase === "result" ? round.player : "rock";
  const cpuHand = phase === "result" ? round.akpos : "rock";
  const locked = phase !== "choose";

  return (
    <div className="rps" ref={rootRef}>
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

      <div className="rps-arena" aria-hidden={idle}>
        <div className="rps-side rps-side--you">
          <div className={`rps-hand-wrap${idle ? " rps-hand-wrap--ghost" : ""}${shaking ? " rps-hand-wrap--shake" : ""}${phase === "result" && round.outcome === "win" ? " rps-hand-wrap--winner" : ""}`}>
            <HandIcon choice={youHand} />
          </div>
          <span className="rps-side-label">You</span>
        </div>
        <span className="rps-versus">VS</span>
        <div className="rps-side rps-side--cpu">
          <div className={`rps-hand-wrap rps-hand-wrap--flip${idle ? " rps-hand-wrap--ghost" : ""}${shaking ? " rps-hand-wrap--shake" : ""}${phase === "result" && round.outcome === "loss" ? " rps-hand-wrap--winner" : ""}`}>
            <HandIcon choice={cpuHand} />
          </div>
          <span className="rps-side-label">Akpos</span>
        </div>
      </div>

      <div className="rps-status" role="status" aria-live="polite">
        {phase === "choose" && <p className="rps-status-main">Choose your hand</p>}
        {phase === "reveal" && <p className="rps-status-main">Rock… paper… scissors…</p>}
        {phase === "result" && (
          <>
            <p className={`rps-status-main rps-status-main--${round.outcome}`}>{LABELS[round.outcome]}</p>
            <p className="rps-status-sub">{describeRound(round.player, round.akpos, round.outcome)}</p>
          </>
        )}
      </div>

      <div className="rps-choices" role="group" aria-label="Pick rock, paper or scissors">
        {CHOICES.map((c, i) => (
          <button
            key={c}
            ref={i === 0 ? firstChoiceRef : undefined}
            type="button"
            className={`rps-choice${(phase === "result" ? round.player : pending) === c ? " rps-choice--picked" : ""}`}
            onClick={() => choose(c)}
            aria-disabled={locked}
            aria-label={c}
          >
            <HandIcon choice={c} />
            <span className="rps-choice-name">{c}</span>
          </button>
        ))}
      </div>

      <div className="rps-actions">
        <button ref={nextRef} type="button" className="activity-game-btn activity-game-btn--primary" onClick={nextRound} disabled={phase !== "result"}>
          Next round
        </button>
        <button type="button" className="activity-game-btn" onClick={resetScore}>
          Reset score
        </button>
      </div>

    </div>
  );
}
