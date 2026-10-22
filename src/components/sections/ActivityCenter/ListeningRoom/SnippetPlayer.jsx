import React, { useEffect, useRef, useState } from "react";
import { formatTime, MAX_SNIPPET_SECONDS } from "./listeningRoomLogic";

// Custom player for ONE of your <=60 s clips: play/pause, progress, duration, volume.
// Only one clip plays at a time: the parent passes `active` and `onActivate`.
export default function SnippetPlayer({ src, title, active, onActivate }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  // another clip started: stop this one
  useEffect(() => {
    if (!active) audioRef.current?.pause();
  }, [active]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.volume = volume;
      a.muted = muted;
    }
  }, [volume, muted]);

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
  const silent = muted || volume === 0;

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
        aria-label={`${playing ? "Pause" : "Play"} ${title}`}
        className="listening-room-play"
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
          </svg>
        )}
      </button>

      {failed ? (
        <span className="listening-room-player-error" role="status">
          This snippet could not be loaded.
        </span>
      ) : (
        <>
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
            className="listening-room-range listening-room-seek"
            style={{ "--fill": `${pct}%` }}
          />
          <span className="listening-room-time">{formatTime(duration)}</span>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={silent ? "Unmute" : "Mute"}
            aria-pressed={silent}
            className="listening-room-mute"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              {silent ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />}
            </svg>
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setMuted(false);
            }}
            aria-label="Volume"
            className="listening-room-range listening-room-volume"
            style={{ "--fill": `${(muted ? 0 : volume) * 100}%` }}
          />
        </>
      )}
    </div>
  );
}