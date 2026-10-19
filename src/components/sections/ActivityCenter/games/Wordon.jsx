import React, { useEffect, useRef, useState } from "react";
import "../../../../styles/wordon.css"; // Wordon's own styles
import {
  WORD_LENGTH, MAX_ATTEMPTS, evaluateGuess, isValidGuess, mergeKeyStatuses, deriveStatus, describeGuess,
  dailySolution, dateKey, pickRandomSolution, emptyStats, recordResult, winPercent, sanitizeStats, sanitizeDaily,
} from "./wordonLogic";

// Tile flip timing. Keep FLIP_STAGGER_MS in sync with the 250ms stagger in .wordon-tile--flip (CSS).
const FLIP_STAGGER_MS = 250;
const FLIP_MS = 500;
const REVEAL_MS = FLIP_STAGGER_MS * (WORD_LENGTH - 1) + FLIP_MS + 80; // +80ms so the last tile has fully landed

const STATS_KEY = "wordon:stats:v1";
const DAILY_KEY = "wordon:daily:v1";
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

// localStorage can be blocked (private mode, strict settings): the game must still work.
const load = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const save = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: keep playing without saving */
  }
};

function buildGame(mode, solution, guesses = []) {
  let keyStatus = {};
  for (const g of guesses) keyStatus = mergeKeyStatuses(keyStatus, g, evaluateGuess(g, solution));
  return { mode, solution, guesses, current: "", status: deriveStatus(guesses, solution), revealing: false, freshRow: -1, keyStatus };
}

function StatsPanel({ stats, onClose }) {
  const most = Math.max(1, ...stats.distribution);
  return (
    <div className="wordon-stats" role="region" aria-label="Statistics">
      <dl className="rps-score">
        <div className="rps-score-item">
          <dt>Played</dt>
          <dd>{stats.played}</dd>
        </div>
        <div className="rps-score-item rps-score-item--you">
          <dt>Win %</dt>
          <dd>{winPercent(stats)}</dd>
        </div>
        <div className="rps-score-item">
          <dt>Streak</dt>
          <dd>{stats.streak}</dd>
        </div>
        <div className="rps-score-item rps-score-item--cpu">
          <dt>Best</dt>
          <dd>{stats.maxStreak}</dd>
        </div>
      </dl>
      <p className="rps-side-label">Daily guess distribution</p>
      <ol className="wordon-dist">
        {stats.distribution.map((count, i) => (
          <li key={i} className="wordon-dist-row">
            <span className="wordon-dist-label">{i + 1}</span>
            <span className="wordon-dist-bar" style={{ "--share": `${Math.max(8, (count / most) * 100)}%` }}>
              {count}
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="activity-game-btn activity-game-btn--primary" onClick={onClose}>
        Back to game
      </button>
    </div>
  );
}

export default function Wordon() {
  const [lists, setLists] = useState(null); // { solutions, allowed: Set }
  const [loadError, setLoadError] = useState(false);
  const [game, setGame] = useState(null);
  const [stats, setStats] = useState(emptyStats);
  const [statsOpen, setStatsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [shaking, setShaking] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // refs mirror the state the keyboard handler needs, so it never reads stale values
  const gameRef = useRef(null);
  const listsRef = useRef(null);
  const statsRef = useRef(emptyStats());
  const statsOpenRef = useRef(false);
  const revealTimer = useRef(null);
  const noticeTimer = useRef(null);
  const shakeTimer = useRef(null);
  const primaryRef = useRef(null);
  const actions = useRef({});

  const commit = (next) => {
    gameRef.current = next;
    setGame(next);
  };

  // stats come back from the device; the word lists load on demand so the first page stays light
  useEffect(() => {
    const saved = sanitizeStats(load(STATS_KEY));
    statsRef.current = saved;
    setStats(saved);

    let alive = true;
   Promise.all([import("./wordon/wordonSolutions"), import("./wordon/wordonGuesses")])
      .then(([s, a]) => {
        if (!alive) return;
        const loaded = { solutions: s.SOLUTIONS, allowed: new Set(a.ALLOWED) };
        listsRef.current = loaded;
        setLists(loaded);
        startDaily();
      })
      .catch(() => alive && setLoadError(true));

    return () => {
      alive = false;
      clearTimeout(revealTimer.current);
      clearTimeout(noticeTimer.current);
      clearTimeout(shakeTimer.current);
    };
  }, []);

  const startDaily = () => {
    const today = new Date();
    const solution = dailySolution(listsRef.current.solutions, today);
    const saved = sanitizeDaily(load(DAILY_KEY), dateKey(today)); // a refresh keeps today's guesses
    commit(buildGame("daily", solution, saved || []));
  };

  const startPractice = () => {
    const previous = gameRef.current?.mode === "practice" ? gameRef.current.solution : null;
    commit(buildGame("practice", pickRandomSolution(listsRef.current.solutions, Math.random, previous)));
  };

  const chooseMode = (mode) => {
    const g = gameRef.current;
    if (!g || g.revealing) return;
    if (statsOpenRef.current) {
      statsOpenRef.current = false;
      setStatsOpen(false); // leave the Stats view
    }
    if (g.mode === mode) return; // already on that game: just came back from Stats
    setNotice("");
    if (mode === "daily") startDaily();
    else startPractice();
  };

  const toggleStats = () => {
    if (gameRef.current?.revealing) return; // let the tiles finish flipping first
    const next = !statsOpenRef.current;
    statsOpenRef.current = next;
    setStatsOpen(next);
  };

  const showNotice = (text) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(""), 1600);
    clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 450);
  };

  const canType = () => {
    const g = gameRef.current;
    return g && g.status === "playing" && !g.revealing && !statsOpenRef.current;
  };

  const addLetter = (letter) => {
    if (!canType()) return;
    const g = gameRef.current;
    if (g.current.length < WORD_LENGTH) commit({ ...g, current: g.current + letter });
  };

  const removeLetter = () => {
    if (!canType()) return;
    const g = gameRef.current;
    if (g.current) commit({ ...g, current: g.current.slice(0, -1) });
  };

  const submit = () => {
    if (!canType()) return;
    const g = gameRef.current;
    const guess = g.current;
    if (guess.length < WORD_LENGTH) return showNotice("Not enough letters");
    // an invalid word shakes the row and does NOT use up an attempt
    if (!isValidGuess(guess, listsRef.current.allowed)) return showNotice("Not in word list");

    const guesses = [...g.guesses, guess];
    const evaluation = evaluateGuess(guess, g.solution);
    const status = deriveStatus(guesses, g.solution);
    commit({ ...g, guesses, current: "", status, revealing: true, freshRow: guesses.length - 1 });
    setAnnouncement(describeGuess(guess, evaluation, guesses.length));
    if (g.mode === "daily") save(DAILY_KEY, { dateKey: dateKey(new Date()), guesses });

    // Count a finished DAILY game NOW, not after the flip: closing the game mid-flip can no longer
    // lose the result, and the Stats panel can't be opened during the flip, so it can't spoil it.
    // Practice games are never counted, so they can't break your daily streak.
    if (g.mode === "daily" && status !== "playing") {
      const next = recordResult(statsRef.current, { won: status === "won", attempts: guesses.length });
      statsRef.current = next;
      setStats(next);
      save(STATS_KEY, next);
    }

    // after the tiles have flipped: unlock the board and colour the keyboard
    revealTimer.current = setTimeout(() => {
      const cur = gameRef.current;
      commit({ ...cur, revealing: false, keyStatus: mergeKeyStatuses(cur.keyStatus, guess, evaluation) });
    }, REVEAL_MS);
  };

  const playAgain = () => startPractice();

  actions.current = { addLetter, removeLetter, submit };

  // physical keyboard: letters, Backspace, Enter
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || statsOpenRef.current) return;
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        if (!e.repeat) actions.current.addLetter(e.key.toLowerCase());
      } else if (e.key === "Backspace") {
        e.preventDefault();
        actions.current.removeLetter();
      } else if (e.key === "Enter") {
        // a focused button outside the keyboard (Daily, Practice, Stats, Play again) keeps its own Enter
        const onOtherButton = active?.tagName === "BUTTON" && !active.closest(".wordon-keyboard");
        if (onOtherButton) return;
        e.preventDefault();
        if (!e.repeat) actions.current.submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // when a game ends, put focus on the main next step so Enter just works
  const finished = !!game && game.status !== "playing" && !game.revealing;
  useEffect(() => {
    if (finished && !statsOpen) primaryRef.current?.focus();
  }, [finished, statsOpen]);

  if (loadError) {
    return (
      <div className="wordon">
        <p className="rps-status-main rps-status-main--loss">Couldn't load the words</p>
        <p className="rps-status-sub">Close this game and open it again.</p>
      </div>
    );
  }
  if (!lists || !game) {
    return (
      <div className="wordon">
        <p className="rps-status-main">Loading words…</p>
      </div>
    );
  }

  const { guesses, status, revealing } = game;
  const evaluations = guesses.map((g) => evaluateGuess(g, game.solution));

  // status text (the result stays hidden until the tiles have finished flipping)
  let main = notice || "Guess the word";
  let sub = `Attempts left: ${MAX_ATTEMPTS - guesses.length}`;
  let tone = "";
  if (revealing) {
    main = "Checking…";
    sub = "";
  } else if (status === "won") {
    main = "You got it!";
    tone = "win";
    sub = `Solved in ${guesses.length} of ${MAX_ATTEMPTS}.${game.mode === "daily" ? " New daily word tomorrow." : ""}`;
  } else if (status === "lost") {
    main = `The word was ${game.solution.toUpperCase()}`;
    tone = "loss";
    sub = `Better luck next time.${game.mode === "daily" ? " New daily word tomorrow." : ""}`;
  }

  const pressKey = (k) => {
    if (k === "enter") actions.current.submit();
    else if (k === "back") actions.current.removeLetter();
    else actions.current.addLetter(k);
  };
  const keyDisabled = status !== "playing" || revealing;

  const renderKey = (k) => {
    const wide = k === "enter" || k === "back";
    const state = game.keyStatus[k];
    return (
      <button
        key={k}
        type="button"
        className={`wordon-key${wide ? " wordon-key--wide" : ""}${state ? ` wordon-key--${state}` : ""}`}
        onClick={() => pressKey(k)}
        aria-disabled={keyDisabled}
        aria-label={k === "enter" ? "Enter" : k === "back" ? "Backspace" : state ? `${k}, ${state}` : k}
      >
        {k === "enter" ? "Enter" : k === "back" ? "⌫" : k}
      </button>
    );
  };

  return (
    <div className="wordon">
      <div className="wordon-bar" role="group" aria-label="Game options">
        {["daily", "practice"].map((m) => (
          <button
            key={m}
            type="button"
            className={`activity-game-btn${!statsOpen && game.mode === m ? " activity-game-btn--primary" : ""}`}
            aria-pressed={!statsOpen && game.mode === m}
            onClick={() => chooseMode(m)}
          >
            {m === "daily" ? "Daily" : "Practice"}
          </button>
        ))}
        <button type="button" className={`activity-game-btn${statsOpen ? " activity-game-btn--primary" : ""}`} aria-pressed={statsOpen} onClick={toggleStats}>
          Stats
        </button>
      </div>

      {statsOpen ? (
        <StatsPanel stats={stats} onClose={toggleStats} />
      ) : (
        <>
          <div className="rps-status" role="status" aria-live="polite">
            <p className={`rps-status-main${tone ? ` rps-status-main--${tone}` : ""}`}>{main}</p>
            <p className="rps-status-sub">{sub}</p>
          </div>

          <div className="wordon-grid" role="grid" aria-label="Wordon board" style={{ "--rows": MAX_ATTEMPTS, "--cols": WORD_LENGTH }}>
            {Array.from({ length: MAX_ATTEMPTS }, (_, r) => {
              const submitted = r < guesses.length;
              const typing = r === guesses.length && status === "playing";
              const word = submitted ? guesses[r] : typing ? game.current : "";
              return (
                <div key={r} role="row" className={`wordon-row${typing && shaking ? " wordon-row--shake" : ""}`}>
                  {Array.from({ length: WORD_LENGTH }, (_, c) => {
                    const letter = word[c] || "";
                    const state = submitted ? evaluations[r][c] : "";
                    const classes = ["wordon-tile"];
                    if (state) classes.push(`wordon-tile--${state}`);
                    if (submitted && revealing && r === game.freshRow) classes.push("wordon-tile--flip");
                    if (typing && letter) classes.push("wordon-tile--typing");
                    return (
                      <div
                        key={c}
                        role="gridcell"
                        className={classes.join(" ")}
                        style={{ "--i": c }}
                        aria-label={`Row ${r + 1}, letter ${c + 1}, ${letter || "empty"}${state && !(revealing && r === game.freshRow) ? `, ${state}` : ""}`}
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="wordon-keyboard" role="group" aria-label="On-screen keyboard">
            {KEY_ROWS.map((row, i) => (
              <div key={row} className="wordon-keys">
                {i === 2 && renderKey("enter")}
                {[...row].map(renderKey)}
                {i === 2 && renderKey("back")}
              </div>
            ))}
          </div>

          <div className="rps-actions wordon-actions">
            {finished && (
              <button
                ref={primaryRef}
                type="button"
                className="activity-game-btn activity-game-btn--primary"
                onClick={game.mode === "daily" ? () => chooseMode("practice") : playAgain}
              >
                {game.mode === "daily" ? "Try Practice" : "Play again"}
              </button>
            )}
          </div>
        </>
      )}

      <p className="wordon-sr" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
