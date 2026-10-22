import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import ActivityModal from "../ActivityModal";
import GameShell from "../GameShell";
import { LISTENING_ROOM_INFO } from "../gameInfo";
import SnippetPlayer from "./SnippetPlayer";
import { ACTIVITY_LOGO } from "../activityData";
import data from "../../../../data/listeningRoom.json";
import { formatMonth, listMonths, tracksForMonth } from "./listeningRoomLogic";
import "../../../../styles/listening-room.css"; // all Listening Room styles live here

// Album art; if it is missing or fails to load, the shared logo stands in.
function Artwork({ src, title }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="listening-room-art listening-room-art--fallback">
        <img src={ACTIVITY_LOGO} alt="" aria-hidden="true" />
      </div>
    );
  }
  return <img src={src} alt={`${title} artwork`} loading="lazy" decoding="async" className="listening-room-art" onError={() => setBroken(true)} />;
}

// Right end of the song bar: the artist's name and their cut-out picture (transparent PNG),
// like the names and faces at the end of the bars in a ranking chart.
function ArtistEnd({ artist, image }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="listening-room-end" aria-hidden="true">
      {/* the name only shows while there is no picture (or it failed to load) */}
      {(!image || broken) && <span className="listening-room-end-name">{artist}</span>}
      {image && !broken && <img src={image} alt="" loading="lazy" decoding="async" className="listening-room-cutout" onError={() => setBroken(true)} />}
    </div>
  );
}

// MORE / LESS only appears when the text really is cut off (measured, not guessed from the length).
function Commentary({ text }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [cutOff, setCutOff] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      if (!open) setCutOff(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    document.fonts?.ready?.then(measure);
    return () => ro?.disconnect();
  }, [text, open]);

  return (
    <div className="listening-room-about">
      <p ref={ref} className={`listening-room-commentary${open ? "" : " listening-room-commentary--clamped"}`}>
        {text}
      </p>
      {(cutOff || open) && (
        <button type="button" className="listening-room-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "LESS" : "MORE"}
        </button>
      )}
    </div>
  );
}

function Track({ t, monthLabel, active, onActivate }) {
  return (
    <li className="listening-room-track">
      <Artwork src={t.artwork} title={t.title} />
      <div className="listening-room-info">
        <p className="listening-room-eyebrow">
          No. {t.position} · {monthLabel}
        </p>
        <h3 className="listening-room-title">{t.title}</h3>
        <p className="listening-room-artist">{t.artist}</p>
        {t.commentary && <Commentary text={t.commentary} />}
        {t.audio ? (
          <SnippetPlayer src={t.audio} title={t.title} active={active} onActivate={onActivate} />
        ) : (
          <p className="listening-room-nosnippet">Snippet coming soon.</p>
        )}
      </div>
      <ArtistEnd artist={t.artist} image={t.artistImage} />
    </li>
  );
}

// Opened from the "Listening Room" card (registered in ActivityCenter's MODALS).
// Same screen as the games: the name on the right with its "i" button, the list scrolling on the left.
export default function ListeningRoomModal({ activity, onClose }) {
  const months = useMemo(() => listMonths(data.tracks), []);
  const [month, setMonth] = useState(months[0]);
  const [activeId, setActiveId] = useState(null); // the one clip allowed to play
  const tracks = useMemo(() => tracksForMonth(data.tracks, month), [month]);

  return (
    <ActivityModal title={activity?.name || "Listening Room"} onClose={onClose} closeSide="right" level={1} variant="game" showHeader={false}>
      <GameShell title={activity?.name || "Listening Room"} info={LISTENING_ROOM_INFO} mainClassName="activity-game-main--scroll">
        <div className="listening-room">
          {tracks.length === 0 ? (
            <p className="activity-modal-intro">My top five for this month is on its way. Check back soon.</p>
          ) : (
            <>
              <div className="listening-room-head">
                <img src={ACTIVITY_LOGO} alt="" aria-hidden="true" className="listening-room-logo" />
                <p className="listening-room-kicker">My top five songs of</p>
                {months.length > 1 ? (
                  <select
                    className="listening-room-month"
                    value={month}
                    onChange={(e) => {
                      setActiveId(null);
                      setMonth(e.target.value);
                    }}
                    aria-label="Choose a month"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {formatMonth(m)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="listening-room-month-label">{formatMonth(month)}</p>
                )}
              </div>

              <ol className="listening-room-list">
                {tracks.map((t) => (
                  <Track key={t.id} t={t} monthLabel={formatMonth(month)} active={activeId === t.id} onActivate={() => setActiveId(t.id)} />
                ))}
              </ol>
            </>
          )}
        </div>
      </GameShell>
    </ActivityModal>
  );
}