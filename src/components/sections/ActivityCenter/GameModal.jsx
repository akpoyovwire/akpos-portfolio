import React from "react";
import ActivityModal from "./ActivityModal";
import GameShell from "./GameShell";
import { getGameInfo } from "./gameInfo";
import { GAME_COMPONENTS } from "./games/registry";

// Shown (in the same style as a game's intro line) until a game is built.
const COMING_SOON = "All work and no play makes Akpos a dull boy. This game is being built next.";

// Second-level modal showing ONE game. Close button is on the LEFT on purpose,
// there is no big header (the game uses the whole screen). The game's name
// animates in on the right and the intro line fades in on the left (see GameShell).
export default function GameModal({ game, onClose }) {
  const Game = GAME_COMPONENTS[game.id];
  return (
    <ActivityModal title={game.name} onClose={onClose} closeSide="left" level={2} variant="game" showHeader={false}>
      <GameShell title={game.name} tagline={Game ? game.tagline : COMING_SOON} info={Game ? getGameInfo(game.name) : null}>
        {Game ? <Game /> : null}
      </GameShell>
    </ActivityModal>
  );
}