import React from "react";

/*
  Three hands in ONE style (your hand-open.svg): paper = your open hand
  (unchanged), rock = closed fist like the fist emoji, scissors = peace sign
  like the victory-hand emoji (no thumbs). Same stroke, same joins, same 32x32 grid.
  The standalone copies are in public/icons/ (hand-rock.svg, hand-scissors.svg).
  Colors come from CSS: brown by default, blue for You, orange for Akpos.
*/
const HANDS = {
  paper: (
    <>
      <path
        className="rps-hand-shape"
        d="M10.5 30 L8.2 24.5 Q5.6 21 3.7 16.2 Q2.7 13.7 4.8 13.1 Q6.4 12.8 7.6 15 L9.4 17.8 L9.4 7.4 Q9.4 5.5 11.3 5.5 Q13.2 5.5 13.2 7.4 L13.2 5.4 Q13.2 3.5 15.1 3.5 Q17 3.5 17 5.4 L17 6.9 Q17 5 18.9 5 Q20.8 5 20.8 6.9 L20.8 9.9 Q20.8 8 22.5 8 Q24.2 8 24.2 9.9 L24.2 18 Q24.2 22 22.6 25 L21.4 30 Z"
      />
      <path className="rps-hand-line" d="M13.2 7.4 V15 M17 6.9 V15 M20.8 9.9 V15" />
    </>
  ),
  rock: (
    <>
      <path className="rps-hand-shape" d="M10.5 30 L8.6 26.2 Q6.0 23.2 6.0 18 L6 12.8 Q6 10.2 8.25 10.2 Q10.5 10.2 10.5 12.6 L10.5 11.4 Q10.5 8.8 12.75 8.8 Q15 8.8 15 11.2 L15 12.2 Q15 9.6 17.25 9.6 Q19.5 9.6 19.5 12 L19.5 13.8 Q19.5 11.2 21.75 11.2 Q24 11.2 24 13.6 L24.0 19.2 Q24.0 23.6 22.6 26.2 L21.4 30 Z" />
      <path className="rps-hand-line" d="M10.5 12.6 V17.6 M15 11.2 V17.6 M19.5 12 V17.6" />
    </>
  ),
  scissors: (
    <>
      <path className="rps-hand-shape" d="M10.5 30 L8.8 26.2 Q6.4 23.2 6.4 18.4 L6.48 16.76 L4.77 5.99 Q4.41 3.72 6.69 3.36 Q8.96 3 9.32 5.27 L11.02 16.04 Q11.1 17.6 11.18 16.04 L13.04 4.29 Q13.4 2.02 15.67 2.37 Q17.94 2.73 17.58 5.01 L15.72 16.76 L16.2 16.4 Q16.2 15 18.2 15 Q20.2 15 20.2 16.6 L20.2 16.9 Q20.2 16 22.2 16 Q24 16 24 17.8 L24 19.6 Q24 23.8 22.4 26.2 L21.4 30 Z" />
      <path className="rps-hand-line" d="M11.1 17.3 V19 M16.2 16.4 V19 M20.2 16.6 V19" />
    </>
  ),
};

export default function HandIcon({ choice, className = "", title }) {
  const hand = HANDS[choice];
  if (!hand) return null;
  return (
    <svg
      viewBox="0 0 32 32"
      className={`rps-hand ${className}`.trim()}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {hand}
    </svg>
  );
}
