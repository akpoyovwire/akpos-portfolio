// Pure math for the Works "depth stage" carousel. No React, no DOM, no gsap -
// so it can be unit-tested on its own and tuned in one place.
//
// THE IDEA (taken from the reference video)
// Every card has a continuous signed distance from the focused position:
//     d = cardIndex - p        (p = the carousel's float position, 0 .. N-1)
// d = 0 is the card in focus. d = +1 is the next card, d = -1 the previous one.
// slotFor(d) turns that distance into where the card sits on the stage and what
// SHAPE it has. Because d is continuous, dragging the dial or swiping glides every
// card smoothly between slots instead of jumping.
//
// SHAPE: every card is a LANDSCAPE rectangle (long, not tall). Background cards are
// small versions of it - a small height (breadth), still long - and as a card comes
// into focus it grows into the big one. (A real resize, not a stretch: the picture
// inside is cropped to the new shape, never squashed.)
//
// Depth is SIMULATED with size + blur + opacity + stacking order.

export const MAX_D = 3;

//   x, y     centre offset from the stage centre, as a FRACTION of stage width / height
//   wf, hf   card width / height as a FRACTION of the focused card's width / height
//   radius   corner radius in px (background cards are rounder)
//   blur     blur radius in screen pixels
//   opacity  0 - 1
export const SLOT_TABLE = [
  /* d = -3 */ { x: -0.62, y: -0.08, wf: 0.24, hf: 0.23, radius: 14, blur: 12, opacity: 0 },
  /* d = -2 */ { x: -0.52, y: 0.14, wf: 0.32, hf: 0.31, radius: 15, blur: 9, opacity: 0.55 },
  /* d = -1 */ { x: -0.37, y: -0.16, wf: 0.43, hf: 0.42, radius: 16, blur: 5, opacity: 0.9 },
  /* d =  0 */ { x: 0, y: 0, wf: 1, hf: 1, radius: 14, blur: 0, opacity: 1 },
  /* d = +1 */ { x: 0.37, y: 0.16, wf: 0.43, hf: 0.42, radius: 16, blur: 5, opacity: 0.9 },
  /* d = +2 */ { x: 0.52, y: -0.14, wf: 0.32, hf: 0.31, radius: 15, blur: 9, opacity: 0.55 },
  /* d = +3 */ { x: 0.62, y: 0.08, wf: 0.24, hf: 0.23, radius: 14, blur: 12, opacity: 0 },
];

export const STEP_X = SLOT_TABLE[MAX_D + 1].x;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (k) => k * k * (3 - 2 * k); // smoothstep on 0..1

const catmull = (p0, p1, p2, p3, t) =>
  0.5 *
  (2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

export function slotFor(d) {
  const x = clamp(d, -MAX_D, MAX_D);
  const f = Math.floor(x);
  const t = x - f;
  const i = f + MAX_D;
  const last = SLOT_TABLE.length - 1;
  const row = (k) => SLOT_TABLE[clamp(k, 0, last)];
  const a = row(i - 1);
  const b = row(i);
  const c = row(i + 1);
  const e = row(i + 2);
  const mix = (key) => catmull(a[key], b[key], c[key], e[key], t);
  return {
    x: mix("x"),
    y: mix("y"),
    wf: Math.max(0.05, mix("wf")),
    hf: Math.max(0.05, mix("hf")),
    radius: Math.max(0, mix("radius")),
    blur: Math.max(0, mix("blur")),
    opacity: clamp(mix("opacity"), 0, 1),
  };
}

// ---------------------------------------------------------------------------
// FLOATING. Every background card roams the WHOLE stage on its own - left edge to
// right edge, top to bottom - not just around its slot. Each one travels in straight
// DIAGONAL legs (x and y run their own triangle waves, matched in pixels so every leg
// is a true diagonal) and turns softly when it reaches the edge of the stage. A small
// circular swirl (a 360 orbit, either direction) is added on top. Speed, heading and
// starting point differ per card, derived from its index so they are stable.
// Amplitudes are FRACTIONS of stage width / height, measured from the stage centre.
export const WANDER_SPEED = 1.8; // 1 = the original pace. Was 1.7; x1.5 on top of that = 2.55 (all of it: legs and swirl)
export const WANDER = {
  range: { x: 0.56, y: 0.44 }, // how far from the centre a card travels, each way (0.5 = the stage edge, so cards slide partly off and back)
  orbit: { x: 0.07, y: 0.09 }, // radius of the small circular swirl
};

const rnd = (index, k) => {
  const v = Math.sin(index * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const softTriangle = (x) =>
  ((0.8106 * (Math.sin(x) - Math.sin(3 * x) / 9 + Math.sin(5 * x) / 25)) / 0.933);

// How much a card follows its own wander (1) versus its slot (0): 0 exactly at focus,
// 1 from one slot away, so the focused card sits still and incoming cards glide in.
export const roamWeight = (d) => smooth(Math.min(1, Math.abs(d)));

// Where card `index` is at `time`, in px from the stage centre.
export function wander(index, rawTime, stageW, stageH, amp = WANDER) {
  const time = rawTime * WANDER_SPEED;
  const ax = amp.range.x * stageW;
  const ay = amp.range.y * stageH;
  const fx = 0.12 + 0.06 * rnd(index, 4); // rad/s: a there-and-back in ~35 - 52 s
  const fy = (fx * ax) / ay * (0.8 + 0.4 * rnd(index, 5));
  const rx = softTriangle(time * fx + rnd(index, 6) * Math.PI * 2) * ax;
  const ry = softTriangle(time * fy + rnd(index, 7) * Math.PI * 2) * ay;
  const spin = (rnd(index, 1) < 0.5 ? -1 : 1) * (0.1 + 0.08 * rnd(index, 2));
  const a = time * spin + rnd(index, 3) * Math.PI * 2;
  return {
    x: rx + Math.cos(a) * amp.orbit.x * stageW + 0,
    y: ry + Math.sin(a) * amp.orbit.y * stageH + 0,
  };
}

// ---------------------------------------------------------------------------
// SCOPE VIEW: what the picture inside the focused card does.
//
// ZOOM. It zooms IN on a spot, zooms back OUT to the whole picture and rests there for
// about a second, then zooms in on the next spot - middle, upper left, lower right,
// upper right, lower left - and so on while the card is in focus.
//   zoom      how far in it goes (0.75 = 1.75x)
//   zoomIn / holdIn / zoomOut / holdOut   seconds: zoom in, stay in, zoom out, rest.
//   holdOut is shorter than the pause you see: the zoom eases slowly at both ends, so
//   a bit of the "rest" is the last / first moments of the zoom. 0.6 reads as ~1 s.
//
// SCROLL. The picture is laid out to COVER the card (like object-fit: cover) but is not
// cropped to the middle: whichever way it is longer than the card (a tall page
// screenshot, a wide banner, anything), the view slowly scrolls along that length and
// back, so every part of the picture gets shown. It scrolls while the zoom is moving
// and stands still during the rest. Picture the same shape as the card: no scroll, the
// zoom spots do all the moving.
// The view never goes past the picture's edge, whatever the zoom or the size.
export const KB = { zoom: 0.75, zoomIn: 1.2, holdIn: 0.4, zoomOut: 1.0, holdOut: 0.6 };
export const KB_ACTIVE = KB.zoomIn + KB.holdIn + KB.zoomOut; // the part of a cycle that moves
export const KB_CYCLE = KB_ACTIVE + KB.holdOut;
export const KB_DIRS = [
  [0, 0], //   the middle
  [-1, -1], // upper left
  [1, 1], //   lower right
  [1, -1], //  upper right
  [-1, 1], //  lower left
];
// scrolling pace: seconds of moving time to scroll one card-length of picture
const SCROLL_SECS_PER_CARD = 2.5;
const SCROLL_MIN_SECS = 4; //  a one-way scroll never faster than this
const SCROLL_MAX_SECS = 16; // ... or slower than this

const easeInOut = (k) => 0.5 - 0.5 * Math.cos(Math.PI * k); // gentle sine ease

// natW/natH = the picture's own size; cardW/cardH = the card's current size (px)
// elapsed   = seconds since this card started coming into focus
// weight    = 0 (not in focus) .. 1 (fully in focus); fades the effect in and out
// Returns the size to give the <img> (iw x ih, px) and its transform, applied with
// transform-origin 0 0:  translate(tx, ty) scale(scale)
export function scopeView({ natW, natH, cardW, cardH, dirIndex, elapsed, weight }) {
  const cover = Math.max(cardW / natW, cardH / natH);
  const iw = natW * cover;
  const ih = natH * cover;
  const ovX = iw - cardW;
  const ovY = ih - cardH;
  const over = ovY > 0.5 && ovY >= ovX ? "y" : ovX > 0.5 ? "x" : null; // which way it is longer

  // where in the zoom cycle we are (k: 0 whole picture .. 1 fully zoomed in)
  const n = KB_DIRS.length;
  const cycle = Math.floor(elapsed / KB_CYCLE);
  const t = elapsed - cycle * KB_CYCLE;
  let k;
  if (t < KB.zoomIn) k = easeInOut(t / KB.zoomIn);
  else if (t < KB.zoomIn + KB.holdIn) k = 1;
  else if (t < KB_ACTIVE) k = 1 - easeInOut((t - KB.zoomIn - KB.holdIn) / KB.zoomOut);
  else k = 0;
  const [dx, dy] = KB_DIRS[(((dirIndex + cycle) % n) + n) % n];
  const z = 1 + KB.zoom * k * weight;

  // scroll progress 0 -> 1 -> 0 along the long way, counted in moving time only
  const moving = cycle * KB_ACTIVE + Math.min(t, KB_ACTIVE);
  const span = over === "y" ? ovY / cardH : over === "x" ? ovX / cardW : 0;
  const oneWay = Math.min(SCROLL_MAX_SECS, Math.max(SCROLL_MIN_SECS, span * SCROLL_SECS_PER_CARD));
  const scroll = 0.5 - 0.5 * Math.cos((Math.PI * moving) / oneWay);

  // position along each axis, 0 .. 1 of the room the zoom leaves. At rest: the top (or
  // left) of the long way, the middle of the other. In focus: the scroll on the long
  // way, the chosen spot on the other.
  const fx = (over === "x" ? 0 : 0.5) + ((over === "x" ? scroll : (dx + 1) / 2) - (over === "x" ? 0 : 0.5)) * weight;
  const fy = (over === "y" ? 0 : 0.5) + ((over === "y" ? scroll : (dy + 1) / 2) - (over === "y" ? 0 : 0.5)) * weight;

  // view centre (in the picture's own px) kept so the picture always covers the card
  const loX = cardW / (2 * z);
  const loY = cardH / (2 * z);
  const vx = loX + (iw - 2 * loX) * fx;
  const vy = loY + (ih - 2 * loY) * fy;
  return { iw, ih, scale: z, tx: cardW / 2 - vx * z + 0, ty: cardH / 2 - vy * z + 0 };
}

export const focusWeight = (d) => smooth(1 - Math.min(1, Math.abs(d)));
export const zFor = (d) => 100 - Math.round(Math.abs(d) * 20);

export const positionFromRatio = (ratio, count) => clamp(ratio, 0, 1) * (count - 1);
export const ratioFromPosition = (p, count) => (count > 1 ? clamp(p / (count - 1), 0, 1) : 0);
export const nearestIndex = (p, count) => clamp(Math.round(p), 0, count - 1);