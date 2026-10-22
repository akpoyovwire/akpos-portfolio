import React, { useMemo, useState } from "react";
import ActivityModal from "../ActivityModal";
import GameShell from "../GameShell";
import { LISTENING_ROOM_INFO } from "../gameInfo";
import SnippetPlayer from "./SnippetPlayer";
import { ACTIVITY_LOGO } from "../activityData";
import data from "../../../../data/listeningRoom.json";
import { formatMonth, listMonths, tracksForMonth } from "./listeningRoomLogic";

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

function ArtistLine({ artist, image }) {
  const [broken, setBroken] = useState(false);
  return (
    <p className="listening-room-artist">
      {image && !broken && <img src={image} alt="" aria-hidden="true" loading="lazy" className="listening-room-artist-img" onError={() => setBroken(true)} />}
      <span>{artist}</span>
    </p>
  );
}

// Opened from the "Listening Room" card (registered in ActivityCenter's MODALS).
// Same screen as the games: the name on the right with its "i" button, the list scrolling in the middle.
export default function ListeningRoomModal({ activity, onClose }) {
  const months = useMemo(() => listMonths(data.tracks), []);
  const [month, setMonth] = useState(months[0]);
  const [activeId, setActiveId] = useState(null); // the one clip allowed to play
  const tracks = useMemo(() => tracksForMonth(data.tracks, month), [month]);

  return (
    <ActivityModal title={activity?.name || "Listening Room"} onClose={onClose} closeSide="left" level={1} variant="game" showHeader={false}>
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
                <li key={t.id} className="listening-room-track">
                  <span className="listening-room-pos" aria-label={`Number ${t.position}`}>
                    {t.position}
                  </span>
                  <Artwork src={t.artwork} title={t.title} />
                  <div className="listening-room-info">
                    <h3 className="listening-room-title">{t.title}</h3>
                    <ArtistLine artist={t.artist} image={t.artistImage} />
                    {t.commentary && <p className="listening-room-commentary">{t.commentary}</p>}
                    {t.audio ? (
                      <SnippetPlayer src={t.audio} title={t.title} active={activeId === t.id} onActivate={() => setActiveId(t.id)} />
                    ) : (
                      <p className="listening-room-nosnippet">Snippet coming soon.</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      </GameShell>
    </ActivityModal>
  );
}