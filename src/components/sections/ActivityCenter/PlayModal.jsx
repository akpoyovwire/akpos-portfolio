import React, { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ActivityModal from "./ActivityModal";
import GameModal from "./GameModal";
import ToolBadges from "./ToolBadges";
import { GAMES, ACTIVITY_LOGO } from "./activityData";

// Level-1 modal with the four game cards. Clicking a card opens GameModal on top.
export default function PlayModal({ activity, onClose }) {
  const [gameId, setGameId] = useState(null);
  const game = GAMES.find((g) => g.id === gameId);
  const closeGame = useCallback(() => setGameId(null), []);

  return (
    <>
      <ActivityModal title={activity.name} onClose={onClose} level={1}>
        <p className="activity-modal-intro">Pick a game.</p>
        <div className="activity-game-grid">
          {GAMES.map((g) => (
            <button key={g.id} type="button" className="activity-game-card" onClick={() => setGameId(g.id)} aria-label={`Play ${g.name}`}>
              <span className="activity-game-card-fallback">{g.name}</span>
              <img
                src={g.image}
                alt=""
                decoding="async"
                className="activity-game-card-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="activity-game-card-top">
                <ToolBadges tools={g.tools} />
                <img src={ACTIVITY_LOGO} alt="" aria-hidden="true" className="activity-game-card-logo" />
              </span>
              <span className="activity-game-card-name">{g.name}</span>
            </button>
          ))}
        </div>
      </ActivityModal>

      <AnimatePresence>{game && <GameModal key={game.id} game={game} onClose={closeGame} />}</AnimatePresence>
    </>
  );
}
