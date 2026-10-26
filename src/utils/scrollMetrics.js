// src/utils/scrollMetrics.js
// Cached scroll numbers for the Expertise -> Works -> Activity stack (see SectionStack in App.jsx).
// Before, several parts of the site called getBoundingClientRect() on every scroll event just to learn
// "is Works covering Expertise yet?". Each call forces the browser to re-layout the page, and they all
// ran right after the stack had moved its layers - on every frame. Here the position of the stack is
// measured only when the page size changes, and everything else is plain arithmetic on window.scrollY.

const SECTIONS = 3; // expertise, works, activity (same as sections.length in App.jsx)
let stackTop = 0;
let vh = 0;
let ready = false;
let wired = false;

function measure() {
  const marker = document.getElementById("expertise"); // the invisible marker at the top of the stack
  if (!marker) return;
  stackTop = marker.getBoundingClientRect().top + window.scrollY;
  vh = window.innerHeight;
  ready = true;
}

function wire() {
  if (wired) return;
  wired = true;
  window.addEventListener("resize", measure);
  new ResizeObserver(measure).observe(document.body); // pins being built, images loading ...
}

function ensure() {
  if (!wired) wire();
  if (!ready) measure();
  return ready;
}

/** Y position (in page px) where the stack starts. */
export function stackTopY() {
  ensure();
  return stackTop;
}

/** 0 .. 1 progress through the stack, the same number App.jsx's useScroll gives the layers. */
export function stackProgress() {
  if (!ensure()) return 0;
  const p = (window.scrollY - stackTop) / ((SECTIONS - 1) * vh);
  return Math.min(1, Math.max(0, p));
}

/** True while the Works layer is sliding over (or sitting on) Expertise. */
export function worksCovering() {
  if (!ensure()) return false;
  // Works' layer starts entering at 0.2 of the stack and its top edge is 4px above the screen bottom a hair later
  return stackProgress() > 0.2 + 0.5333 / vh;
}