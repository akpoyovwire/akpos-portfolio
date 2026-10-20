// One place for every Activity Center name, image path and the shared logo.
// Images live in public/images/, so the paths start with /images/.
export const ACTIVITY_LOGO = "/logos/logo.png"; // shared logo for every game and application
export const AI_NAME = "Mon IA";

export const ACTIVITIES = [
  { id: "play", name: "Play", image: "/images/play.jpg" },
  { id: "listening-room", name: "Listening Room", image: "/images/listen.jpg" },
  { id: "mon-ia", name: AI_NAME, image: "/images/ai.jpg" },
];

// tools = extra tools worth showing as logos on the card (React is left out on
// purpose: the whole site is React). nodejs = used to run that game's tests.
// tagline = optional line written out on the left of the game screen.
// python = used for the build script that makes the word lists / question bank.
// db + api = the Quiz pulls themed questions live from Open Trivia DB.
// Add "gemini" to the Quiz once the AI quiz really works.
export const GAMES = [
  { id: "tictactoe", name: "Tic-Tac-Toe", image: "/images/tictac.jpg", tools: ["javascript", "nodejs"], tagline: "Let's play X and O. Should I go easy or lock in?" },
  { id: "rps", name: "Rock Paper Scissors", image: "/images/rps.jpg", tools: ["javascript", "nodejs"], tagline: "Play rock paper scissors against me. Think you can win?" },
  { id: "wordon", name: "Wordon", image: "/images/wordon.jpg", tools: ["javascript", "nodejs", "python"], tagline: "Guess my secret four-letter word. You get six tries." },
  { id: "quiz", name: "Quiz", image: "/images/quiz.jpg", tools: ["javascript", "nodejs", "python", "db", "api", "gemini"], tagline: "Ten questions. How many can you get right?" },
];
