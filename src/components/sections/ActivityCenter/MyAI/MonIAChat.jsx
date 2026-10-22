import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../../../styles/mon-ia.css";
import RichText from "./RichText";
import { PRIVACY_VERSION } from "./privacyPolicy";
import { AI_NAME, ACTIVITY_LOGO } from "../activityData";
import { MAX_CHARS, SUGGESTIONS, WELCOME, THINKING_PHRASES, THINKING_MS, SHARD_COLS, shardRows, makeShards, buildRequestBody, describeApiError, newConversationId } from "./monIaClient";

// The tiny scraps of paper a new bubble is built from. They fly in, settle, melt into the glass, then remove themselves.
function Shards({ seed, length }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const shards = useMemo(() => makeShards(seed, SHARD_COLS, shardRows(length)), [seed, length]);
  if (done) return null;
  return (
    <span className="mon-ia-shards" aria-hidden="true">
      {shards.map((p) => (
        <span
          key={p.id}
          className="mon-ia-shard"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `calc(${p.w}% + 0.5px)`,
            height: `calc(${p.h}% + 0.5px)`,
            "--sx": `${p.sx}px`,
            "--sy": `${p.sy}px`,
            "--sr": `${p.sr}deg`,
            "--d": `${p.d}ms`,
          }}
        />
      ))}
    </span>
  );
}

// While Mon IA works, its bubble says things like "Thinking…" and changes the phrase every few seconds.
function ThinkingBubble() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, THINKING_PHRASES.length - 1)), THINKING_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mon-ia-msg mon-ia-msg--bot mon-ia-msg--in" role="status" aria-label={`${AI_NAME} is thinking`}>
      <div className="mon-ia-bubble">
        <div className="mon-ia-text">
          <span key={i} className="mon-ia-thinking-text" aria-hidden="true">{THINKING_PHRASES[i]}</span>
        </div>
      </div>
    </div>
  );
}

// The "Ask Away" chat card. onOpenPrivacy opens the Privacy Policy screen.
export default function MonIAChat({ onOpenPrivacy }) {
  const [messages, setMessages] = useState([]); // [{ id, role: "user" | "assistant", content }]
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const conversationRef = useRef(newConversationId());
  const abortRef = useRef(null);
  const counterRef = useRef(0);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // keep the newest message in view (there is no visible scrollbar)
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, error]);

  // put the cursor back in the box after each answer
  useEffect(() => {
    if (!loading) inputRef.current?.focus({ preventScroll: true });
  }, [loading]);

  const ask = async (history) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mon-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(history, conversationRef.current, PRIVACY_VERSION)),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw { status: res.status, message: data?.error };
      if (!data?.reply) throw { status: 502 };
      if (controller.signal.aborted) return;
      counterRef.current += 1;
      setMessages((m) => [...m, { id: counterRef.current, role: "assistant", content: data.reply }]);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(describeApiError(err));
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const send = (text) => {
    const question = text.trim();
    if (!question || loading) return;
    if (question.length > MAX_CHARS) {
      setError(`Please keep your message under ${MAX_CHARS} characters.`);
      return;
    }
    counterRef.current += 1;
    const history = [...messages, { id: counterRef.current, role: "user", content: question }];
    setMessages(history);
    setInput("");
    ask(history);
  };

  const newConversation = () => {
    abortRef.current?.abort();
    conversationRef.current = newConversationId(); // a fresh, unconnected conversation number
    setMessages([]);
    setError("");
    setLoading(false);
    setInput("");
    inputRef.current?.focus({ preventScroll: true });
  };

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <div className="mon-ia-stage">
      <section className="mon-ia" aria-labelledby="mon-ia-heading">
        <header className="mon-ia-head">
          <img src={ACTIVITY_LOGO} alt="" aria-hidden="true" className="mon-ia-logo" />
          <h3 id="mon-ia-heading" className="mon-ia-heading">
            Ask Away
          </h3>
          <span className="mon-ia-status">
            <span className="mon-ia-dot" aria-hidden="true" />
            {AI_NAME} online
          </span>
          {messages.length > 0 && (
            <button type="button" className="mon-ia-iconbtn mon-ia-new" onClick={newConversation} aria-label="New conversation" title="New conversation">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
              </svg>
              <span className="mon-ia-new-label">New</span>
            </button>
          )}
        </header>

        <div className="mon-ia-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions" tabIndex={0}>
          <div className="mon-ia-msg mon-ia-msg--bot">
            <div className="mon-ia-bubble">
              <div className="mon-ia-text">
                <p>{WELCOME}</p>
              </div>
            </div>
          </div>

          {messages.length === 0 && !loading && (
            <ul className="mon-ia-suggestions" aria-label="Suggested questions">
              {SUGGESTIONS.map((q) => (
                <li key={q}>
                  <button type="button" className="mon-ia-chip" onClick={() => send(q)}>
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`mon-ia-msg mon-ia-msg--${m.role === "user" ? "user" : "bot"} mon-ia-msg--in`}>
              <div className="mon-ia-bubble">
                <Shards seed={m.id} length={m.content.length} />
                <div className="mon-ia-text">
                  <RichText text={m.content} />
                </div>
              </div>
            </div>
          ))}

          {loading && <ThinkingBubble />}

          {error && (
            <div className="mon-ia-error" role="alert">
              <p>{error}</p>
              {lastIsUser && !loading && (
                <button type="button" className="activity-game-btn" onClick={() => ask(messages)}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mon-ia-compose">
          <label className="mon-ia-sr" htmlFor="mon-ia-input">
            Your question for {AI_NAME}
          </label>
          <input
            id="mon-ia-input"
            ref={inputRef}
            className="mon-ia-input"
            type="text"
            value={input}
            maxLength={MAX_CHARS}
            placeholder="Ask about Akpos…"
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button type="button" className="mon-ia-send" onClick={() => send(input)} disabled={loading || !input.trim()}>
            Submit
          </button>
        </div>

        <p className="mon-ia-consent">
          By clicking Submit you accept my{" "}
          <button type="button" className="mon-ia-link" onClick={onOpenPrivacy}>
            Privacy Policy
          </button>
          . Conversations are recorded and emailed to Akpos. Please don't share sensitive personal information.
        </p>
      </section>
    </div>
  );
}