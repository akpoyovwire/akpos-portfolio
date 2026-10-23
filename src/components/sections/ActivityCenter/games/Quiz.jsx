import React, { useEffect, useRef, useState } from "react";
import "../../../../styles/quiz.css"; // all Quiz styles live here
import QuizPlay from "./QuizPlay";
import { fetchTriviaSession } from "./quizApi";
import { QUESTIONS_PER_QUIZ, TRIVIA_ATTRIBUTION, TRIVIA_TOPICS, buildSession, describeError } from "./quizLogic";

const LEAVE_MS = 350; // how long the two cards you did NOT pick take to fade away
const AI_IDEAS = ["Afrobeats", "Nigerian history", "Space", "Marvel"];

// The three mode cards. All three use quiz.jpg for now: change the image paths below
// when you have your own pictures (for example "/images/quiz-categorized.jpg").
const MODES = [
  { id: "topics", title: "Categorized", blurb: "Music, film, video games, anime and more.", note: "Open Trivia DB", image: "/images/quiz.jpg" },
  { id: "ai", title: "Your choice", blurb: "Name any topic and AI writes the questions.", note: "Coming soon", image: "/images/quiz.jpg" },
  { id: "random", title: "Random", blurb: "10 random questions from my own bank.", note: "10 categories", image: "/images/quiz.jpg" },
];

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Stages: choose (3 mode cards) -> topics | ai | random -> loading -> play (or error).
// Picking a mode fades the other two cards away, then that mode's screen appears in the middle.
export default function Quiz() {
  const [stage, setStage] = useState("choose");
  const [leaving, setLeaving] = useState(null); // id of the card that was picked, while the others fade
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState(null); // which mode made the current session
  const [topic, setTopic] = useState(null);
  const [error, setError] = useState("");
  const [runId, setRunId] = useState(0);
  const [aiTopic, setAiTopic] = useState("");
  const [aiNote, setAiNote] = useState(false);

  const rootRef = useRef(null);
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const stageRef = useRef("choose");
  stageRef.current = stage;

  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearTimeout(timerRef.current);
    },
    []
  );

  // put keyboard focus on the first button of every new screen
  useEffect(() => {
    if (stage === "play" || stage === "loading") return;
    rootRef.current?.querySelector("[data-autofocus]")?.focus();
  }, [stage]);

  // arrow keys move between the buttons on the chooser screens (the question screen has its own handler)
  useEffect(() => {
    const onKey = (e) => {
      if (stageRef.current === "play" || !rootRef.current) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      const active = document.activeElement;
      if (active?.tagName === "INPUT") return; // let the cursor move inside the text box
      const items = [...rootRef.current.querySelectorAll("button:not(:disabled):not([aria-disabled='true'])")];
      if (!items.length) return;
      e.preventDefault();
      const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
      const i = items.indexOf(active);
      items[i === -1 ? (forward ? 0 : items.length - 1) : (i + (forward ? 1 : -1) + items.length) % items.length].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goModes = () => {
    abortRef.current?.abort();
    clearTimeout(timerRef.current);
    setLeaving(null);
    setSession(null);
    setError("");
    setAiNote(false);
    setStage("choose");
  };

  const pickMode = (id) => {
    if (leaving) return;
    if (prefersReducedMotion()) {
      setStage(id);
      return;
    }
    setLeaving(id);
    timerRef.current = setTimeout(() => {
      setStage(id);
      setLeaving(null);
    }, LEAVE_MS);
  };

  const begin = (nextMode, nextTopic = null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMode(nextMode);
    setTopic(nextTopic);
    setError("");
    setStage("loading");
    return controller;
  };
  const show = (questions) => {
    setSession(questions);
    setRunId((n) => n + 1);
    setStage("play");
  };

  const startTopic = async (t) => {
    const controller = begin("topics", t);
    try {
      show(await fetchTriviaSession(t, { signal: controller.signal }));
    } catch (err) {
      if (controller.signal.aborted) return; // the visitor went back: say nothing
      setError(describeError(err));
      setStage("error");
    }
  };

  const startRandom = async () => {
    const controller = begin("random");
    try {
      // the 110-question bank is only downloaded when someone actually plays Random
      const { QUESTIONS } = await import("./quiz/quizQuestions");
      if (controller.signal.aborted) return;
      show(buildSession(QUESTIONS, QUESTIONS_PER_QUIZ));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(describeError(err));
      setStage("error");
    }
  };

  const playAgain = () => (mode === "random" ? startRandom() : startTopic(topic));
  const retry = playAgain;

  return (
    <div className="quiz" ref={rootRef}>
      {stage !== "choose" && (
        <button type="button" className="quiz-back" onClick={goModes}>
          <span className="quiz-back-arrow" aria-hidden="true" />
          <span className="quiz-back-label">Modes</span>
        </button>
      )}

      {stage === "choose" && (
        <div className="quiz-modes" role="group" aria-label="Choose how to play">
          {MODES.map((m, i) => (
            <button
              key={m.id}
              type="button"
              data-autofocus={i === 0 ? "" : undefined}
              className={`quiz-mode quiz-mode--${m.id}${leaving ? (leaving === m.id ? " quiz-mode--picked" : " quiz-mode--leaving") : ""}`}
              onClick={() => pickMode(m.id)}
              aria-label={`${m.title}. ${m.blurb} ${m.note}.`}
            >
              <img
                src={m.image}
                alt=""
                decoding="async"
                className="quiz-mode-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="quiz-mode-shade" aria-hidden="true" />
              <span className="quiz-mode-text">
                <span className="quiz-mode-note">{m.note}</span>
                <span className="quiz-mode-title">{m.title}</span>
                <span className="quiz-mode-blurb">{m.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {stage === "topics" && (
        <section className="quiz-panel" aria-labelledby="quiz-topics-title">
          <h3 id="quiz-topics-title" className="quiz-panel-title">Pick a category</h3>
          <div className="quiz-topics" role="group" aria-label="Topics">
            {TRIVIA_TOPICS.map((t, i) => (
              <button key={t.id} type="button" data-autofocus={i === 0 ? "" : undefined} className="quiz-topic" onClick={() => startTopic(t)}>
                {t.label}
              </button>
            ))}
          </div>
          <p className="quiz-credit">{TRIVIA_ATTRIBUTION}. Written by the community, so a few answers may be debatable.</p>
        </section>
      )}

      {stage === "random" && (
        <section className="quiz-panel" aria-labelledby="quiz-random-title">
          <h3 id="quiz-random-title" className="quiz-panel-title">Random mix</h3>
          <p className="quiz-panel-text">Ten random questions from my own bank, across ten categories, from easy to medium.</p>
          <button type="button" data-autofocus className="activity-game-btn activity-game-btn--primary" onClick={startRandom}>
            Start
          </button>
        </section>
      )}

      {stage === "ai" && (
        <section className="quiz-panel" aria-labelledby="quiz-ai-title">
          <h3 id="quiz-ai-title" className="quiz-panel-title">Your choice</h3>
          <p className="quiz-panel-text">Type any topic and AI will write ten questions about it.</p>
          <label className="quiz-field">
            <span className="quiz-field-label">Your topic</span>
            <input
              data-autofocus
              className="quiz-input"
              type="text"
              maxLength={60}
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="e.g. Afrobeats"
              autoComplete="off"
            />
          </label>
          <div className="quiz-ideas" role="group" aria-label="Topic ideas">
            {AI_IDEAS.map((idea) => (
              <button key={idea} type="button" className="quiz-idea" onClick={() => setAiTopic(idea)}>
                {idea}
              </button>
            ))}
          </div>
          <button type="button" className="activity-game-btn activity-game-btn--primary" aria-disabled="true" aria-describedby="quiz-ai-note" onClick={() => setAiNote(true)}>
            Write my quiz
          </button>
          <p id="quiz-ai-note" className="quiz-notice" role="status">
            {aiNote ? (
              "AI quizzes are coming soon. Try Categorized or Random for now."
            ) : (
              <>
                <strong>Coming soon.</strong> AI-written questions can contain mistakes, so they will be labelled.
              </>
            )}
          </p>
        </section>
      )}

      {stage === "loading" && (
        <p className="quiz-loading" role="status">
          Loading questions…
        </p>
      )}

      {stage === "error" && (
        <section className="quiz-panel" aria-labelledby="quiz-error-title">
          <h3 id="quiz-error-title" className="quiz-panel-title quiz-panel-title--error">Couldn't load the quiz</h3>
          <p className="quiz-panel-text" role="alert">{error}</p>
          <div className="rps-actions">
            <button type="button" data-autofocus className="activity-game-btn activity-game-btn--primary" onClick={retry}>
              Try again
            </button>
            {mode === "topics" && (
              <button type="button" className="activity-game-btn" onClick={startRandom}>
                Use my own questions
              </button>
            )}
          </div>
        </section>
      )}

      {stage === "play" && session && (
        <QuizPlay
          key={runId}
          questions={session}
          attribution={mode === "topics" ? TRIVIA_ATTRIBUTION : ""}
          onAgain={playAgain}
          onModes={goModes}
        />
      )}
    </div>
  );
}