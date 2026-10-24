import React from "react";

// The Works previous / next pair, styled after alejandroha.com: two rounded-SQUARE
// buttons side by side.
//
// Each button has a faint full border, plus an extra BRIGHT border drawn on top of it
// that is NOT closed. On hover that bright border lifts away from the button (grows
// outward and turns a little) and fades.
//
// The bright border is one SVG rounded rect with pathLength="100", so the numbers in
// RING_STYLES are percentages of the whole perimeter:
//   "arcs"    two arcs of 40% each with a 10% gap between them (what you described)
//   "corners" four short pieces, one per corner (what your screenshot looks like)
// Switch with RING_STYLE below. Nothing else needs to change.

const RING_STYLE = "arcs"; // "arcs" | "corners"
const RING_STYLES = {
  arcs: { dash: "40 10", offset: 0 },
  corners: { dash: "14 11", offset: 0 },
};

const SIZE = 56; // px, the button
const RING = 72; // px, the bright border's box (floats 8px outside the button)

function Arrow({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "prev" ? <path d="M19 12H5M11 6l-6 6 6 6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

function ArrowButton({ dir, onClick, disabled, label, accent }) {
  const ring = RING_STYLES[RING_STYLE];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{ width: SIZE, height: SIZE, borderColor: `${accent}73` }}
      className="works-arrow group relative flex items-center justify-center rounded-[14px] border text-zinc-100 transition-opacity duration-300 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/60"
    >
      <svg
        viewBox={`0 0 ${RING} ${RING}`}
        width={RING}
        height={RING}
        fill="none"
        aria-hidden="true"
        className="works-arrow-ring pointer-events-none absolute transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.22] group-hover:rotate-[8deg] group-hover:opacity-60"
        style={{ left: "50%", top: "50%", marginLeft: -RING / 2, marginTop: -RING / 2, color: accent }}
      >
        <rect
          x="8"
          y="8"
          width={RING - 16}
          height={RING - 16}
          rx="14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={ring.dash}
          strokeDashoffset={ring.offset}
        />
      </svg>
      <Arrow dir={dir} />
    </button>
  );
}

// Previous is orange, Next is blue (the site's two colours). Both are always usable:
// Works wraps round at either end.
const ORANGE = "#E4572E";
const BLUE = "#4FA3D1";

export default function WorksArrows({ onPrev, onNext, canPrev = true, canNext = true, className = "" }) {
  return (
    <div className={`flex items-center gap-6 ${className}`} role="group" aria-label="Browse works">
      <ArrowButton dir="prev" label="Previous work" onClick={onPrev} disabled={!canPrev} accent={ORANGE} />
      <ArrowButton dir="next" label="Next work" onClick={onNext} disabled={!canNext} accent={BLUE} />
    </div>
  );
}