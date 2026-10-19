import React, { useEffect, useRef, useState } from "react";
import { isCorrect, progressLabel, scoreMessage, titleCase } from "./quizLogic";

const LETTERS = ["A", "B", "C", "D"];

// The question screen every quiz mode shares: one question at a time, whether the answer was
// right, a short explanation, progress ("Question 4 of 10") and a final score.
// questions = a ready-made session from buildSession() (options already shuffled).
export default function QuizPlay({ questions, attribution = "", onAgain, onModes }) {
  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null); // option index the player chose, or null
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const rootRef = useRef(null);
  const firstOptionRef = useRef(null);
  const nextRef = useRef(null);
  const againRef = useRef(null);

  const q = questions[index];
  const answered = picked !== null;

  const choose = (i) => {
    if (answered || done) return; // one answer per question
    setPicked(i);
    if (isCorrect(q, i)) setScore((s) => s + 1);
  };
  const next = () => {
    if (!answered) return;
    if (index + 1 >= total) setDone(true);
    else {
      setIndex(index + 1);
      setPicked(null);
    }
  };

  // keep keyboard focus useful: first answer on a new question, "Next" after answering, "Play again" at the end
  useEffect(() => {
    if (done) againRef.current?.focus();
    else if (answered) nextRef.current?.focus();
    else firstOptionRef.current?.focus();
  }, [index, answered, done]);

  // keys: 1-4 or A-D answer, arrow keys move between the enabled buttons
  const live = useRef({});
  live.current = { choose, answered, done };
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const { choose: pick, answered: isAnswered, done: isDone } = live.current;
      if (isDone) return;
      const match = /^[1-4a-dA-D]$/.test(e.key) ? e.key.toLowerCase() : null;
      if (match && !isAnswered) {
        e.preventDefault();
        pick("1234".includes(match) ? Number(match) - 1 : "abcd".indexOf(match));
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) && rootRef.current) {
        const items = [...rootRef.current.querySelectorAll("button:not(:disabled):not([aria-disabled='true'])")];
        if (!items.length) return;
        e.preventDefault();
        const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
        const i = items.indexOf(document.activeElement);
        items[i === -1 ? (forward ? 0 : items.length - 1) : (i + (forward ? 1 : -1) + items.length) % items.length].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (done) {
    return (
      <div className="quiz-play quiz-result" ref={rootRef}>
        <p className="quiz-result-label">Final score</p>
        <p className="quiz-result-score" role="status">
          {score}
          <span className="quiz-result-total"> / {total}</span>
        </p>
        <p className="quiz-result-message">{scoreMessage(score, total)}</p>
        <div className="rps-actions">
          <button ref={againRef} type="button" className="activity-game-btn activity-game-btn--primary" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="activity-game-btn" onClick={onModes}>
            Change mode
          </button>
        </div>
        {attribution && <p className="quiz-credit">{attribution}</p>}
      </div>
    );
  }

  const correct = answered && isCorrect(q, picked);
  return (
    <div className="quiz-play" ref={rootRef}>
      <div className="quiz-meta">
        <p className="quiz-progress-label">{progressLabel(index, total)}</p>
        <p className="quiz-score">Score {score}</p>
      </div>
      <div
        className="quiz-progress"
        role="progressbar"
        aria-label="Quiz progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index + (answered ? 1 : 0)}
        style={{ "--progress": `${((index + (answered ? 1 : 0)) / total) * 100}%` }}
      />
      <div className="quiz-tags">
        <span className="quiz-tag">{q.category}</span>
        <span className={`quiz-tag quiz-tag--${q.difficulty}`}>{titleCase(q.difficulty)}</span>
      </div>

      <h3 className="quiz-question">{q.question}</h3>

      <div className="quiz-options" role="group" aria-label="Answers">
        {q.options.map((option, i) => {
          let state = "";
          if (answered) state = i === q.answerIndex ? " quiz-option--right" : i === picked ? " quiz-option--wrong" : "";
          return (
            <button
              key={`${q.id}-${i}`}
              ref={i === 0 ? firstOptionRef : undefined}
              type="button"
              className={`quiz-option${state}`}
              onClick={() => choose(i)}
              aria-disabled={answered}
              aria-label={`${LETTERS[i]}: ${option}${answered && i === q.answerIndex ? ", the correct answer" : ""}`}
            >
              <span className="quiz-option-key" aria-hidden="true">{LETTERS[i]}</span>
              <span className="quiz-option-text">{option}</span>
            </button>
          );
        })}
      </div>

      <div className="quiz-feedback" role="status" aria-live="polite">
        {answered && (
          <>
            <p className={`quiz-feedback-main quiz-feedback-main--${correct ? "right" : "wrong"}`}>
              {correct ? "Correct!" : `Not quite. The answer is ${q.answer}.`}
            </p>
            {q.explanation && <p className="quiz-feedback-why">{q.explanation}</p>}
          </>
        )}
      </div>

      <div className="rps-actions quiz-next">
        {answered && (
          <button ref={nextRef} type="button" className="activity-game-btn activity-game-btn--primary" onClick={next}>
            {index + 1 >= total ? "See results" : "Next question"}
          </button>
        )}
      </div>
      {attribution && <p className="quiz-credit">{attribution}</p>}
    </div>
  );
}
