import React, { useEffect, useRef, useState } from "react";
import { formatTime, MAX_SNIPPET_SECONDS } from "./listeningRoomLogic";

// One <=60 s clip. Starts as a glassy "Preview" pill; the first press plays the clip and
// reveals the progress bar (blue-to-orange, draggable) with the clip length.
// Only one clip plays at a time: the parent passes `active` and `onActivate`.
export default function SnippetPlayer({ src, title, active, onActivate }) {
  const audioRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  // another clip started: stop this one
  useEffect(() => {
    if (!active) audioRef.current?.pause();
  }, [active]);

  // smooth progress while playing (timeupdate alone only fires ~4x a second)
  useEffect(() => {
    if (!playing) return undefined;
    let id;
    const tick = () => {
      const a = audioRef.current;
      if (a) {
        if (a.currentTime >= MAX_SNIPPET_SECONDS) {
          a.pause(); // hard stop at 60 s even if a longer file ever slipped through
          a.currentTime = 0;
          setTime(0);
          return;
        }
        setTime(a.currentTime);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || failed) return;
    if (a.paused) {
      setStarted(true);
      onActivate();
      a.play().catch((e) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    } else {
      a.pause();
    }
  };

  const seek = (e) => {
    const a = audioRef.current;
    const v = Number(e.target.value);
    if (a) a.currentTime = v;
    setTime(v);
  };

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className="listening-room-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(Math.min(e.currentTarget.duration || 0, MAX_SNIPPET_SECONDS))}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onError={() => setFailed(true)}
      />

      <button
        type="button"
        onClick={toggle}
        disabled={failed}
        aria-label={`${playing ? "Pause" : started ? "Play" : "Preview"} ${title}`}
        className={`listening-room-play${started ? " listening-room-play--round" : ""}`}
      >
        {/* both icons stay mounted and cross-fade, so play <-> pause is smooth */}
        <span className="listening-room-icon" aria-hidden="true">
          <svg className={playing ? "is-hidden" : ""} viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
          </svg>
          <svg className={playing ? "" : "is-hidden"} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        </span>
        <span className="listening-room-play-label" aria-hidden="true">Preview</span>
      </button>

      {started &&
        (failed ? (
          <span className="listening-room-player-error" role="status">
            This snippet could not be loaded.
          </span>
        ) : (
          <div className="listening-room-scrub">
            <span className="listening-room-time">{formatTime(time)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.1"
              value={Math.min(time, duration || 0)}
              onChange={seek}
              disabled={!duration}
              aria-label={`Seek ${title}`}
              aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
              className="listening-room-seek"
              style={{ "--fill": `${pct}%` }}
            />
            <span className="listening-room-time">{formatTime(duration)}</span>
          </div>
        ))}
    </div>
  );
}