import React, { useState } from "react"
import { motion } from "framer-motion"
import { Mail, Github, Linkedin } from "lucide-react"
import { FaMedium } from "react-icons/fa"
import WaterRipple from "../effects/WaterRipple"

/*
  Hero animations - why they are CSS keyframes now

  1) AKPOYOVWIRE typing. Before, Framer Motion animated the heading's WIDTH
     from 0 to "fit-content" and its border colour forever. Width forces the
     browser to re-do layout on every frame, and the colour blink repaints
     forever - all on the main thread, right next to a playing video and the
     water ripple. Now the text is revealed with TRANSFORMS ONLY: a clipping
     window slides in from the left while the text inside slides the opposite
     way by exactly the same amount, so the text stays put and the window
     uncovers it left to right. Transforms run on the compositor, so the
     reveal stays smooth even when the main thread is busy.
     The caret rides on the window's right edge and blinks with opacity.

  2) profile.jpg is assembled like a jigsaw puzzle. The photo is cut into 8
     real jigsaw-shaped pieces (4 columns x 2 rows, with tabs and sockets).
     Each piece is the full photo clipped by a static SVG path. The pieces
     simply appear in their own slots one after another (a quick fade with a
     tiny pop), like a jigsaw being fitted together piece by piece.
     Only transform and opacity are animated, so it stays on the compositor.
     Every piece is also trimmed by a static circle clip on its image, so the
     outer edge of each piece is already an arc of the final 360 circle (no
     square corners while flying in). When the last piece locks, the pieces
     are swapped for one plain round image so there are no hairline seams,
     then the gentle pulse starts.
*/
const HERO_CSS = `
.hero-name-window {
  position: relative;
  display: inline-block;
  overflow: hidden;
  will-change: transform;
    padding-bottom: 0.25em;   /* gives the Y's tail room inside the clipping window */
  margin-bottom: -0.25em;   /* cancels the extra height so nothing else shifts */
  animation: hero-name-window 2s cubic-bezier(0.65, 0, 0.35, 1) both;
}
.hero-name-text {
  display: inline-block;
  padding-right: 0.4rem; /* room for the caret */
  will-change: transform;
  animation: hero-name-text 2s cubic-bezier(0.65, 0, 0.35, 1) both;
}
.hero-name-caret {
  position: absolute;
  top: 0;
  right: 0;

  width: 4px;
  bottom: 0.25em;
  background: #E4572E;
  animation: hero-caret-blink 1s linear 2s infinite;
}
@keyframes hero-name-window { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes hero-name-text   { from { transform: translateX(100%);  } to { transform: translateX(0); } }
@keyframes hero-caret-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

/* ---- profile: 8 jigsaw pieces locking together ---- */
.hero-puzzle {
  position: relative;
  width: 100%;
  height: 100%;
}
.hero-piece {
  position: absolute;
  inset: 0;
  transform-origin: var(--ox) var(--oy);
  will-change: transform, opacity;
  animation: hero-piece-in 0.45s ease-out both;
  animation-delay: calc(0.3s + var(--d));
}
.hero-piece img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  pointer-events: none;
  /* the jigsaw clip is on .hero-piece; this circle trims the outer edge so
     every piece carries the round corner of the final 360 circle */
  clip-path: circle(50% at 50% 50%);
}
/* each piece simply appears in its own slot: a quick fade with a tiny pop. Transform + opacity only. */
@keyframes hero-piece-in {
  0%   { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1);   opacity: 1; }
}

/* gentle breathing once assembled; starts right after the last piece appears (0.3s + 1.75s delay + 0.45s) */
.hero-pulse { animation: hero-pulse 1.6s ease-in-out 2.5s infinite; }
@keyframes hero-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(0.85); } }

@media (prefers-reduced-motion: reduce) {
  .hero-name-window, .hero-name-text, .hero-name-caret,
  .hero-piece, .hero-puzzle, .hero-pulse { animation: none !important; }
}
`

const PROFILE_SRC = "/images/profile.jpg"

// 4 columns x 2 rows = 8 pieces. Shapes are drawn in 0..1 units so they scale with the box.
const COLS = 4, ROWS = 2, S = 0.8
const f = (n) => +n.toFixed(4)

// one edge of a piece; s = +1 tab out, -1 socket in, 0 = straight (outer border)
function edge(px, py, qx, qy, s) {
  if (!s) return `L${f(qx)} ${f(qy)} `
  const len = Math.hypot(qx - px, qy - py)
  const ux = (qx - px) / len, uy = (qy - py) / len
  const nx = uy, ny = -ux
  const mx = (px + qx) / 2, my = (py + qy) / 2
  const p = (u, v) => `${f(mx + ux * u * S + nx * s * v * S)} ${f(my + uy * u * S + ny * s * v * S)}`
  return (
    `L${p(-0.04, 0)} ` +
    `C${p(-0.03, 0.03)} ${p(-0.07, 0.04)} ${p(-0.065, 0.08)} ` +
    `C${p(-0.06, 0.115)} ${p(-0.02, 0.12)} ${p(0, 0.12)} ` +
    `C${p(0.02, 0.12)} ${p(0.06, 0.115)} ${p(0.065, 0.08)} ` +
    `C${p(0.07, 0.04)} ${p(0.03, 0.03)} ${p(0.04, 0)} ` +
    `L${f(qx)} ${f(qy)} `
  )
}

function piecePath(c, r) {
  const x0 = c / COLS, x1 = (c + 1) / COLS, y0 = r / ROWS, y1 = (r + 1) / ROWS
  const bottomOf = (cc) => (cc % 2 ? 1 : -1)              // edge between row 0 and row 1
  const rightOf = (cc, rr) => ((cc + rr) % 2 ? 1 : -1)    // edge between col cc and cc+1
  const top = r === 0 ? 0 : -bottomOf(c)
  const bottom = r === ROWS - 1 ? 0 : bottomOf(c)
  const right = c === COLS - 1 ? 0 : rightOf(c, r)
  const left = c === 0 ? 0 : -rightOf(c - 1, r)
  return (
    `M${f(x0)} ${f(y0)} ` +
    edge(x0, y0, x1, y0, top) +
    edge(x1, y0, x1, y1, right) +
    edge(x1, y1, x0, y1, bottom) +
    edge(x0, y1, x0, y0, left) +
    "Z"
  )
}

// The order the pieces appear in: [col, row]. Scattered on purpose so it reads like
// someone fitting a jigsaw together piece by piece.
const PIECES = [
  [1, 0],
  [2, 1],
  [0, 0],
  [3, 1],
  [2, 0],
  [0, 1],
  [3, 0],
  [1, 1], // keep LAST: it is the final piece and triggers the swap to the plain image
].map(([c, r], i) => ({
  c, r,
  d: i * 0.25,
  path: piecePath(c, r),
  ox: ((c + 0.5) / COLS) * 100,
  oy: ((r + 0.5) / ROWS) * 100,
}))

export default function Hero(){
    // true once the puzzle has finished assembling: swap the 8 pieces for one plain image
    const [unfolded, setUnfolded] = useState(
  () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
)

    return(
        <>
<style>{HERO_CSS}</style>

{/* minHeight is 100vh, NOT 100dvh, on purpose. On a phone 100dvh changes
    whenever the browser's address bar hides/shows (~56px), so this section
    changed height after About's pin had already been measured. About then
    pinned ~56px too early and its transparent stage showed the bottom of
    this hero behind it. 100vh is the fixed large-screen height on mobile, so
    the hero never resizes while scrolling and the pin lines up exactly. */}
<motion.section
  id="home"
  initial="hidden"
  animate="visible"
    style={{ minHeight: "100vh" }}
  className="relative px-6 py-48 text-center flex flex-col items-center justify-center overflow-hidden"
>
 
     {/* VIDEO BACKGROUND with water ripples */}
   <WaterRipple src="/videos/herovid2.mp4" />

  {/* Overlay for darkness */}
  <div className="absolute inset-0 bg-black/40"></div>
   {/* PROFILE PICTURE (bottom left) - assembled like a jigsaw puzzle */}
  <motion.a
    href="https://www.linkedin.com/in/akpoyovwire"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Akpoyovwire on LinkedIn"
    className="absolute bottom-6 left-6 z-10 block"
    whileTap={{ scale: 0.92 }}
  >
   <div className="hero-pulse w-20 h-20 md:w-28 md:h-28 cursor-pointer">
  {unfolded ? (
    <img
      src={PROFILE_SRC}
      alt="Akpoyovwire"
      className="w-full h-full rounded-full object-cover shadow-lg"
    />
  ) : (
    <div
      className="hero-puzzle"
      role="img"
      aria-label="Akpoyovwire"
      onAnimationEnd={(e) => {
        if (e.target.dataset.last) setUnfolded(true)
      }}
    >
      {/* jigsaw outlines. Don't use display:none here, some browsers then ignore the clip paths */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          {PIECES.map((p, i) => (
            <clipPath key={i} id={`hero-jig-${i}`} clipPathUnits="objectBoundingBox">
              <path d={p.path} />
            </clipPath>
          ))}
        </defs>
      </svg>

      {PIECES.map((p, i) => (
        <div
          key={i}
          className="hero-piece"
          data-last={i === PIECES.length - 1 ? "1" : undefined}
          style={{
            clipPath: `url(#hero-jig-${i})`,
            "--ox": `${p.ox}%`,
            "--oy": `${p.oy}%`,
            "--d": `${p.d}s`,
          }}
        >
          <img src={PROFILE_SRC} alt="" draggable="false" />
        </div>
      ))}
    </div>
  )}
</div>
  </motion.a>

<h2
  aria-label="AKPOYOVWIRE"
  className="text-4xl sm:text-6xl md:text-8xl over-the-rainbow-regular mb-4 pb-8 leading-[1.35] overflow-hidden whitespace-nowrap relative text-[#EDEDF2]"
>
  <span className="hero-name-window" aria-hidden="true">
    <span className="hero-name-text">AKPOYOVWIRE</span>
    <span className="hero-name-caret" />
  </span>
</h2>

  {/* Added mb-12 for spacing below this line */}
  <motion.p
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 2, duration: 1 }}
className="text-lg relative text-[#EDEDF2] mb-12 bebas-neue-regular -mt-5"
  >
    Build. Secure. Innovate. Educate.
  </motion.p>

  {/* Floating Contact Icons with entrance */}
  <motion.div className="flex gap-6">
    {[
      {
        icon: <Mail size={20} color="#D14836" />,
        href: "mailto:ogbontheakpos@gmail.com",
        slideFrom: "top",
      },
      {
        icon: <Github size={20} color="#FFFFFF" />,
        href: "https://github.com/akpoyovwire",
        slideFrom: "bottom",
      },
      {
        icon: <Linkedin size={20} color="#0A66C2" />,
        href: "https://www.linkedin.com/in/akpoyovwire",
        slideFrom: "top",
      },
      {
        icon: <FaMedium size={22} color="#000000" />,
        href: "https://medium.com/@dahgrate",
        slideFrom: "bottom",
      },
    ].map((link, idx) => (
      <motion.a
        key={idx}
        href={link.href}
        target="_blank"
        initial={{ opacity: 0, y: link.slideFrom === "top" ? -50 : 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        viewport={{ once: false, amount: 0.4 }}
        whileHover={{ scale: 1.1 }}
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          {link.icon}
        </motion.div>
      </motion.a>
    ))}
  </motion.div>
</motion.section>

        </>
    )
}
