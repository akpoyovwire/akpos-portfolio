// The text of each game's "i" panel. Edit freely: it is just words.
// Matching is by the game's NAME (spaces and capitals ignored), so it works with whatever ids registry.js uses.
// The Listening Room has its own screen: use LISTENING_ROOM_INFO there (see ListeningRoomModal.jsx).

const BUILT = (extra) => [
  "React draws the screen and handles every click.",
  "GSAP animates the title when the screen opens.",
  "Plain CSS for the look, with no game engine or heavy library.",
  ...extra,
];

export const LISTENING_ROOM_INFO = {
  title: "About the Listening Room",
  intro: "My top five songs of the month, with a short clip of each so you can hear what I have been playing on repeat.",
  sections: [
    {
      heading: "How it works",
      list: [
        "Each song shows its artwork, the artist and a line from me about why I love it.",
        "Press play to hear a clip of up to 60 seconds. Drag the bar to jump around, and use the speaker to change the volume or mute.",
        "Only one clip plays at a time: start another and the first one stops.",
        "When there is more than one month, pick a month from the list to see that month's five.",
      ],
    },
    {
      heading: "Built with",
      list: BUILT([
        "A custom audio player made from the browser's own audio element, so there is no music-player library.",
        "The songs live in one data file (listeningRoom.json), so I can add a new month without touching the code.",
        "If a piece of artwork or a clip fails to load, the screen shows a friendly fallback instead of breaking.",
        "The month and time logic is in listeningRoomLogic.js, with automated tests.",
      ]),
    },
  ],
};

export const GAME_INFO = {
  tictactoe: {
    title: "About Tic Tac Toe",
    intro: "The classic 3 by 3 game, played against me.",
    sections: [
      { heading: "How to play", list: ["You are X (blue). I am O (orange).", "Tap an empty square to place your mark.", "Get three in a row, across, down or diagonally, to win.", "If the board fills up with no line, it is a draw. Press the button to play again."] },
      { heading: "Built with", list: BUILT(["All the rules and my moves live in one logic file (tictactoeLogic.js), separate from the screen, with automated tests."]) },
    ],
  },
  wordon: {
    title: "About Wordon",
    intro: "A word-guessing game in the style of Wordle: find the hidden word before you run out of tries.",
    sections: [
      { heading: "How to play", list: ["Type a real word and submit it.", "Each letter is coloured to tell you how close it is: right letter in the right place, right letter in the wrong place, or not in the word at all.", "Use those hints to narrow down the hidden word.", "Words that are not in the dictionary are rejected."] },
      { heading: "Built with", list: BUILT(["Word lists for the possible answers and the accepted guesses. They load only when you open the game, so the rest of the site stays fast.", "The guess-checking rules are in wordonLogic.js, with automated tests."]) },
    ],
  },
  rockpaperscissors: {
    title: "About Rock Paper Scissors",
    intro: "Rock, paper, scissors against me, with a running scoreboard.",
    sections: [
      { heading: "How to play", list: ["Choose rock, paper or scissors.", "I choose at the same time.", "Rock beats scissors, scissors beats paper, paper beats rock. The same pick is a draw.", "The scoreboard keeps count of You, Akpos and Draws."] },
      { heading: "Built with", list: BUILT(["The hands are my own icon designs (blue is you, orange is me).", "The winner is decided in rpsLogic.js, with automated tests."]) },
    ],
  },
  quiz: {
    title: "About the Quiz",
    intro: "A short quiz to test yourself and see how you score.",
    sections: [
      { heading: "How to play", list: ["Read each question and pick the answer you think is right.", "You see how you did when you finish.", "Play again for another go."] },
      { heading: "Built with", list: BUILT(["The questions are kept in a data file (quizQuestions.js), so adding more never touches the screen code.", "Scoring is in quizLogic.js, with automated tests."]) },
    ],
  },
};

// Finds the panel for a game by its name, or returns null.
export function getGameInfo(name) {
  const key = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const found = Object.keys(GAME_INFO).find((k) => key.includes(k));
  return found ? GAME_INFO[found] : null;
}