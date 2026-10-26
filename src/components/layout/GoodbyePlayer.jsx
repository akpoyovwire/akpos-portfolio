import React, { useEffect, useRef, useState } from "react";
import { ACTIVITY_LOGO } from "../sections/ActivityCenter/activityData";

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

// The goodbye song: artwork, title, artist, a progress bar and one play/pause button.
// No skip, no favourite. `active` is false while the footer panel is closed, which pauses the clip.
export default function GoodbyePlayer({ song, active = true }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [artBroken, setArtBroken] = useState(false);
  const [failed, setFailed] = useState(false);

  const hasAudio = Boolean(song.audio) && !failed;

  useEffect(() => {
    if (!active) audioRef.current?.pause();
  }, [active]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !hasAudio) return;
    if (a.paused) a.play().catch(() => setFailed(true));
    else a.pause();
  };

  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div className="goodbye">
      <div className="goodbye-top">
        {song.artwork && !artBroken ? (
          <img className="goodbye-art" src={song.artwork} alt={`${song.title} artwork`} loading="lazy" decoding="async" onError={() => setArtBroken(true)} />
        ) : (
          <div className="goodbye-art goodbye-art--fallback">
            <img src={ACTIVITY_LOGO} alt="" aria-hidden="true" />
          </div>
        )}
        <div className="goodbye-text">
          <p className="goodbye-title">{song.title}</p>
          <p className="goodbye-artist">{song.artist}</p>
        </div>
      </div>

      <div className="goodbye-scrub">
        <span className="goodbye-time">{fmt(cur)}</span>
        <input
          type="range"
          className="goodbye-seek"
          min="0"
          max={dur || 0}
          step="0.1"
          value={cur}
          disabled={!hasAudio || !dur}
          style={{ "--fill": `${pct}%` }}
          aria-label="Song progress"
          onChange={(e) => {
            const t = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = t;
            setCur(t);
          }}
        />
        <span className="goodbye-time">{fmt(dur)}</span>
      </div>

      <div className="goodbye-controls">
        <button type="button" className="goodbye-play" onClick={toggle} disabled={!hasAudio} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="5" height="18" rx="1.2" /><rect x="14" y="3" width="5" height="18" rx="1.2" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.8v16.4a1 1 0 0 0 1.5.86l13.3-8.2a1 1 0 0 0 0-1.72L8.5 2.94A1 1 0 0 0 7 3.8z" /></svg>
          )}
        </button>
      </div>
      {!hasAudio && <p className="goodbye-note">{failed ? "Could not play the clip." : "Clip coming soon."}</p>}

      {song.audio && (
        <audio
          ref={audioRef}
          src={song.audio}
          preload="metadata"
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setCur(0); }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}