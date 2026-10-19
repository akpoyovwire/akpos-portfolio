// Each game plugs in here as it is built. Until a game has an entry, its
// modal shows a short "being built" message.
import RockPaperScissors from "./RockPaperScissors";
import TicTacToe from "./TicTacToe";
import Wordon from "./Wordon";
import Quiz from "./Quiz";

export const GAME_COMPONENTS = {
  rps: RockPaperScissors,
  tictactoe: TicTacToe,
  wordon: Wordon,
  quiz: Quiz,
};
