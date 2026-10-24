import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { SiTypescript, SiReact, SiSupabase, SiPostgresql, SiVercel } from "react-icons/si";
import SectionSide from "./SectionSide";
import WorksArrows from "./WorksArrows";
import {
  slotFor, wander, roamWeight, scopeView, focusWeight, zFor, clamp, STEP_X,
  positionFromRatio, ratioFromPosition, nearestIndex,
} from "./worksStageLogic";

gsap.registerPlugin(SplitText);

// Card layout (same on every card):
//   top-left      the work's own logo ("appLogo")
//   top-right     your akpos logo (MY_LOGO), same size the old redirect icon was
//   everywhere    clicking the card opens the details overlay
// There are no redirect links on the cards anymore.
//
// Placeholder works: set "image" to a real src and the "Coming soon" panel
// disappears automatically. Fill in the detail fields to replace the "---".
const MY_LOGO = "/logos/logo.svg";
const PLACEHOLDER_LOGO = "/logos/app-placeholder.png";

// Two-finger trackpad swipe over the carousel:
//   WHEEL_SPEED  how far it travels per swipe (1 = a swipe as long as the gap
//                between two cards moves the carousel by exactly one card)
//   WHEEL_GLIDE  0-1, how quickly it catches up to where the swipe is heading.
//                Lower = longer, floatier glide (Lenis on the page uses 0.12).
const WHEEL_SPEED = 5;
const WHEEL_GLIDE = 0.12;

//   WHEEL_SETTLE_MS  quiet time after the last swipe event before it eases onto
//                    the nearest card (trackpad momentum keeps events coming, so
//                    this waits for the coast to finish)
const WHEEL_SETTLE_MS = 140;

// Dragging the stage with a mouse or finger:
//   DRAG_THRESHOLD  px of movement before a press stops being a click
//   FLICK_MS        a fast release carries on as if the pointer kept its speed
//                   for this long (bigger = flicks travel further)
const DRAG_THRESHOLD = 8;
const FLICK_MS = 120;
const FLICK_IDLE_MS = 80; // if the pointer sat still this long before release, there is no flick

// Size of the focused card:
//   FOCUS_MAX     never wider than this many px
//   FOCUS_ASPECT  width / height. A landscape rectangle: 1.8 = long, not tall.
//   FOCUS_H_MAX   never taller than this share of the screen height (and 440px)
//   STAGE_EXTRA   room above / below the focused card for the floating cards. Smaller
//                 = the stage is shorter, so the dial underneath sits higher.
const FOCUS_MAX = 780;
const FOCUS_ASPECT = 1.8;
const FOCUS_H_MAX = 0.42;
const STAGE_EXTRA = "8rem";

const NO_DRIFT = { x: 0, y: 0 };

// Tool icons for the details overlay. Add a key here, then use it in a
// work's "tools" array. Supabase and PostgreSQL are separate entries, each
// with their own icon - previously PostgreSQL was bundled in brackets
// inside Supabase's label with no icon of its own.
const TOOLS = {
  typescript: { label: "TypeScript", Icon: SiTypescript },
  react: { label: "React", Icon: SiReact },
  supabase: { label: "Supabase", Icon: SiSupabase },
  postgresql: { label: "PostgreSQL", Icon: SiPostgresql },
  vercel: { label: "Vercel", Icon: SiVercel },
};

// Default detail fields for works that aren't ready yet
const EMPTY = {
  title: "Coming soon",
  details: "Patience is a Virtue",
  period: "---",
  role: "---",
  sector: "---",
  team: "---",
  tools: [],
};

const WORKS = [
  {
    name: "DuetDays",
    link: "https://duet-days.lovable.app/",
    image: "/images/duetdays.jpg",
    appLogo: "/logos/duetdays-logo.png",
    title: "DuetDays",
    details:
      "DuetDays is a productivity tracker built around one simple idea: compare two days side by side. Pick any two consecutive days within a week and see how many tasks were completed, missed or still pending, so you can spot how your habits shift from one day to the next. Designed, built and shipped end to end as a solo project.",
    period: "2025",
    role: "Design, Frontend, Backend, Database & SEO",
    sector: "Productivity",
    team: "Solo",
    tools: ["typescript", "react", "supabase", "postgresql", "vercel"],
  },
  { name: "#2", link: null, image: null, appLogo: PLACEHOLDER_LOGO, ...EMPTY },
  { name: "#3", link: null, image: null, appLogo: PLACEHOLDER_LOGO, ...EMPTY },
  { name: "#4", link: null, image: null, appLogo: PLACEHOLDER_LOGO, ...EMPTY },
  { name: "#5", link: null, image: null, appLogo: PLACEHOLDER_LOGO, ...EMPTY },
];

/*
  Details overlay. A modal on top of the current page (not a route).
  Its content plays About's reveal on its own as soon as it opens: title
  words rise in with the same rotate/scale/stagger, the description comes in
  line by line, and the detail rows follow. Same easing and offsets as About.
  Closing plays that same timeline backwards, then the backdrop fades out.

  "fontFamily" is read from the Works section when the overlay is opened and
  applied here, because the overlay is portaled to document.body and would
  otherwise lose the font the rest of the site inherits.

  STRUCTURE (why the close button is NOT inside the blurred layer)
  `backdrop-filter` (the blur) on an element creates a new containing block
  for any `position: fixed` descendant - the same way `transform` does. So
  the blur lives on its own inner layer, and the close button is a sibling of
  that layer in a plain (non-filtered) wrapper - it has nothing but the real
  viewport to be fixed against.

  SCROLL
  The blurred layer IS the scroller (overflow-y: auto), with its scrollbar
  hidden, so wheel / touch / arrow keys / Space / PageDown all scroll the
  pop-up content. The page behind is locked: body overflow, Lenis stopped
  ("lenis:stop"), the main-page scrollbar hides and ignores the pointer on the
  same event (CustomScrollbar.jsx), and wheel/touch events over the pop-up are
  stopped from reaching window so nothing can move the page behind it.

  TEXT STYLE
  Every piece of text in here other than the title and the link now shares
  one style (LABEL_STYLE, the same small tracked caps the "Period"/"Role"
  labels already used) - the description, the row values, and the tool
  names all inherit it. The link keeps its own orange.
*/
const CLOSE_SPEED = 1.8; // how fast the reveal plays backwards (1 = same speed as opening)
const LABEL_STYLE = "text-xs tracking-widest uppercase text-zinc-400";
const LABEL_SHAPE = "text-xs tracking-widest uppercase"; // same shape, no color - for elements that need a different color (the link)

function WorkDetails({ work, onClose, fontFamily }) {
  const tlRef = useRef(null);
  const closingRef = useRef(false);
  const rootRef = useRef(null);
  const titleRef = useRef(null);
  const ruleRef = useRef(null);
  const bodyRef = useRef(null);
  const closeRef = useRef(null);
  const scrollerRef = useRef(null);

  // Wheel / touch over the pop-up must never reach window (Lenis and any other
  // page-scroll code listen there). Nothing is prevented, so the pop-up still
  // scrolls natively; the events just stop here.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const stop = (e) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("touchmove", stop, { passive: true });
    return () => {
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchmove", stop);
    };
  }, []);

  // play the reveal backwards, then unmount
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const tl = tlRef.current;
    // reduced motion, or closed before the reveal even started: nothing to reverse
    if (!tl || tl.progress() === 0) return onClose();
    tl.eventCallback("onReverseComplete", onClose);
    tl.timeScale(CLOSE_SPEED).reverse();
  }, [onClose]);

  // lock page scroll while open, close on Escape
  useEffect(() => {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    // Fully pause Lenis for as long as this is open - belt-and-suspenders
    // with the body-overflow lock above, so there's no path left (wheel,
    // touch, or Lenis's own virtual scroll state) for scroll input to leak
    // through to the page behind. App.jsx listens for these two events; the
    // main-page scrollbar listens too, to hide itself and ignore the
    // pointer while this is open.
    window.dispatchEvent(new CustomEvent("lenis:stop"));

    const onKey = (e) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    scrollerRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
      window.removeEventListener("keydown", onKey);
      window.dispatchEvent(new CustomEvent("lenis:start"));
    };
  }, [requestClose]);

  // the reveal, same moves as About, but on a timer instead of scroll
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const rows = rootRef.current.querySelectorAll(".detail-row");
      const titleSplit = new SplitText(titleRef.current, { type: "words" });
      const bodySplit = new SplitText(bodyRef.current, { type: "lines" });

      gsap.set(titleSplit.words, {
        yPercent: 120,
        rotate: 8,
        scale: 1.4,
        autoAlpha: 0,
        transformOrigin: "left bottom",
      });
      gsap.set(bodySplit.lines, { autoAlpha: 0, y: 24 });
      gsap.set(rows, { autoAlpha: 0, y: 24 });
      gsap.set(ruleRef.current, { scaleX: 0, transformOrigin: "left center" });

      tlRef.current = gsap
        .timeline({ delay: 0.15 })
        .to(titleSplit.words, {
          yPercent: 0,
          rotate: 0,
          scale: 1,
          autoAlpha: 1,
          stagger: 0.06,
          duration: 1,
          ease: "power3.out",
        })
        .to(ruleRef.current, { scaleX: 1, duration: 0.8, ease: "power2.out" }, "<0.2")
        .to(bodySplit.lines, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08 }, "<0.1")
        .to(rows, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.07 }, "<0.15");
    }, rootRef);

    return () => ctx.revert();
  }, [work]);

  const linkText = work.link ? work.link.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;

  const rows = [
    { label: "Period", value: work.period },
    { label: "Role", value: work.role },
    { label: "Sector", value: work.sector },
    { label: "Team", value: work.team },
    {
      label: "Link",
      value: linkText ? (
        <a
          href={work.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`${LABEL_SHAPE} text-[#E4572E] hover:underline break-all`}
        >
          {linkText}
        </a>
      ) : (
        "---"
      ),
    },
    {
      label: "Tools",
      value:
        work.tools.length > 0 ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-3">
            {work.tools.map((key) => {
              const t = TOOLS[key];
              if (!t) return null;
              return (
                <li key={key} className="flex items-center gap-2">
                  <t.Icon size={20} aria-hidden="true" />
                  <span>{t.label}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          "---"
        ),
    },
  ];

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${work.title} details`}
      className="fixed inset-0 z-[100]"
      style={{ fontFamily }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* BLUR + SCROLL LAYER - the glass background lives here, and nowhere
          else, on purpose (see the containing-block note above). It scrolls,
          with its scrollbar hidden. data-lenis-prevent tells Lenis to leave
          scrolling over it alone. */}
      <div
        ref={scrollerRef}
        tabIndex={-1}
        data-lenis-prevent
        className="absolute inset-0 overflow-y-auto overscroll-contain bg-[#17161b]/90 backdrop-blur-[6px] outline-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div ref={rootRef} className="mx-auto w-full max-w-6xl px-6 pt-24 pb-16 md:pt-28">
          <h2
            ref={titleRef}
            className="bebas-neue-regular text-zinc-100 text-6xl sm:text-8xl md:text-[9rem] leading-[0.95] pb-2 overflow-hidden"
          >
            {work.title}
          </h2>

          <div ref={ruleRef} className="h-px w-full bg-white/15 mt-6" />

          <div className="mt-10 grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-10 md:gap-16">
            <p ref={bodyRef} className={`${LABEL_STYLE} leading-relaxed max-w-md`}>
              {work.details}
            </p>

            <dl>
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="detail-row grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr] gap-4 py-3 border-b border-white/10"
                >
                  <dt className={`${LABEL_STYLE} pt-1`}>{r.label}</dt>
                  <dd className={LABEL_STYLE}>{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* CLOSE BUTTON - a sibling of the blur layer above, not a child of
          it, so it's genuinely fixed to the viewport. */}
      <button
        ref={closeRef}
        onClick={requestClose}
        aria-label="Close details"
        className="fixed top-5 right-5 md:top-8 md:right-10 z-10 w-11 h-11 flex items-center justify-center rounded-full text-zinc-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4FA3D1]"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
    </motion.div>
  );
}

/*
  THE DEPTH STAGE (replaces the old scrolling row of cards)

  All cards live on one stage. Each frame, every card is placed and SHAPED by
  slotFor(d) (see worksStageLogic.js), where d is how far it is from the focused
  position p:
      d = 0   -> centre, the big landscape rectangle, sharp, still  (the card in focus)
      d = +-1 -> a small landscape rectangle, blurred
      d = +-2 -> smaller and blurrier
      d >= 3  -> gone
  p is a float. The arrows tween it, the dial scrubs it, a swipe / drag glides it,
  the left / right arrow keys step it - and the cards simply follow.

  BACKGROUND FLOAT: every card not in focus roams the WHOLE stage (edge to edge) on its
  own diagonal path with a small 360 swirl (wander() in the logic file).
  SCOPE VIEW: the focused card's picture zooms in on a spot and out again, and scrolls
  through its whole length (scopeView() in the logic file).

  Positions are written straight to each card's style from one gsap ticker - React
  never re-renders per frame. The ticker pauses when the section is off screen.
  Floating, Ken Burns and tweening are skipped for prefers-reduced-motion.

  CLICKING: the focused card opens the details overlay; any other card comes into
  focus first (one more click opens it).
*/
export default function Works(props) {
  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const faceRefs = useRef([]);
  const imgRefs = useRef([]);
  const natRefs = useRef([]); // each picture's own size, once loaded
  const sliderRef = useRef(null);
  const knobRef = useRef(null);
  const dragging = useRef(false);
  const cardDrag = useRef(null);
  const endCardDragRef = useRef(null);
  const detailsOpen = useRef(false);

  const [focusIndex, setFocusIndex] = useState(0);
  const sectionRef = useRef(null);
  const [active, setActive] = useState(null);
  detailsOpen.current = !!active;

  const eng = useRef({
    pos: { p: 0 },
    dest: 0,
    glide: false,
    glideTarget: 0,
    settleTimer: 0,
    w: 0,
    h: 0,
    cardW: 0,
    cardH: 0,
    t: 0,
    visible: true,
    reduce: false,
    suppressClick: false,
    last: [],
    flags: { focus: 0 },
  });

  const COUNT = WORKS.length;

  const openDetails = (work) => {
    const fontFamily = sectionRef.current ? getComputedStyle(sectionRef.current).fontFamily : undefined;
    setActive({ work, fontFamily });
  };

  // ---- drawing -----------------------------------------------------------

  const renderStage = useCallback((time) => {
    const e = eng.current;
    const p = e.pos.p;
    for (let i = 0; i < COUNT; i++) {
      const wrap = cardRefs.current[i];
      const face = faceRefs.current[i];
      if (!wrap || !face) continue;
      const d = i - p;
      const s = slotFor(d);
      const c = e.last[i] || (e.last[i] = {});

      // position: the slot next to focus, handing over to the card's own wander
      // across the whole stage as it moves away from focus
      const f = e.reduce ? 0 : roamWeight(d);
      const r = f > 0 ? wander(i, time, e.w, e.h) : NO_DRIFT;
      const px = s.x * e.w * (1 - f) + r.x * f;
      const py = s.y * e.h * (1 - f) + r.y * f;
      c.px = px; c.py = py; c.op = s.opacity; // remembered for the up / down keys
      wrap.style.transform =
        `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0) translate(-50%, -50%)`;

      // a real resize: width on the wrapper, height + corners on the face
      const cw = Math.round(e.cardW * s.wf * 10) / 10;
      const ch = Math.round(e.cardH * s.hf * 10) / 10;
      const rad = Math.round(s.radius * 10) / 10;
      if (c.cw !== cw) { wrap.style.width = `${cw}px`; c.cw = cw; }
      if (c.ch !== ch) { face.style.height = `${ch}px`; c.ch = ch; }
      if (c.rad !== rad) { face.style.borderRadius = `${rad}px`; c.rad = rad; }

      const blur = s.blur < 0.05 ? 0 : Math.round(s.blur * 4) / 4;
      if (c.blur !== blur) { wrap.style.filter = blur ? `blur(${blur}px)` : "none"; c.blur = blur; }
      const opacity = Math.round(s.opacity * 100) / 100;
      if (c.opacity !== opacity) { wrap.style.opacity = String(opacity); c.opacity = opacity; }
      const visibility = opacity > 0.01 ? "visible" : "hidden";
      if (c.visibility !== visibility) { wrap.style.visibility = visibility; c.visibility = visibility; }
      const z = zFor(d);
      if (c.z !== z) { wrap.style.zIndex = String(z); c.z = z; }
      // every visible card can be clicked, however far back it is (hidden ones can't be)
      const pe = Math.abs(d) < 3 ? "auto" : "none";
      if (c.pe !== pe) { wrap.style.pointerEvents = pe; c.pe = pe; }

      // Scope view (scopeView in the logic file): the picture zooms in on a spot and
      // out again, and scrolls through its whole length whatever its shape. Restarts
      // every time the card comes within one slot of focus, and fades in with how close.
      const img = imgRefs.current[i];
      const nat = natRefs.current[i];
      if (img && nat) {
        const near = Math.abs(d) < 1;
        if (near && !c.kbOn) { c.kbOn = true; c.kbStart = time; c.kbVisits = (c.kbVisits || 0) + 1; }
        else if (!near && c.kbOn) c.kbOn = false;
        const live = c.kbOn && !e.reduce;
        const v = scopeView({
          natW: nat.w,
          natH: nat.h,
          cardW: cw,
          cardH: ch,
          dirIndex: i + (c.kbVisits || 0) * 3,
          elapsed: live ? time - c.kbStart : 0,
          weight: live ? focusWeight(d) : 0,
        });
        const size = `${v.iw.toFixed(1)}px ${v.ih.toFixed(1)}px`;
        if (c.imgSize !== size) {
          img.style.width = `${v.iw.toFixed(1)}px`;
          img.style.height = `${v.ih.toFixed(1)}px`;
          c.imgSize = size;
        }
        const tf = `translate3d(${v.tx.toFixed(2)}px, ${v.ty.toFixed(2)}px, 0) scale(${v.scale.toFixed(4)})`;
        if (c.imgTf !== tf) { img.style.transform = tf; c.imgTf = tf; }
      }
    }
  }, [COUNT]);

  const syncUi = useCallback(() => {
    const e = eng.current;
    const p = e.pos.p;
    if (knobRef.current) {
      knobRef.current.style.left = `calc(${ratioFromPosition(p, COUNT) * 100}% - 8px)`;
    }
    const focus = nearestIndex(p, COUNT);
    if (focus !== e.flags.focus) { e.flags.focus = focus; setFocusIndex(focus); }
  }, [COUNT]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const e = eng.current;
    e.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => {
      e.w = stage.clientWidth;
      e.h = stage.clientHeight;
      // focused card: a landscape rectangle, as wide as FOCUS_MAX / the stage allows
      // (wider share of the stage on a phone) but never taller than FOCUS_H_MAX
      const hMax = Math.min(window.innerHeight * FOCUS_H_MAX, 440);
      e.cardW = Math.min(e.w * (e.w < 600 ? 0.8 : 0.62), hMax * FOCUS_ASPECT, FOCUS_MAX);
      e.cardH = e.cardW / FOCUS_ASPECT;
      // phones: the stage is only as tall as the focused card plus a little float room
      // (see .works-stage in section-side.css)
      stage.style.setProperty("--works-card-h", `${e.cardH.toFixed(1)}px`);
      renderStage(e.t);
      syncUi();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [renderStage, syncUi]);

  useEffect(() => {
    const e = eng.current;
    const frame = (time) => {
      const dt = Math.min(0.1, Math.max(0, time - e.t));
      e.t = time;
      if (!e.visible) return;
      if (e.glide) {
        const k = 1 - Math.pow(1 - WHEEL_GLIDE, dt * 60);
        e.pos.p += (e.glideTarget - e.pos.p) * k;
        if (Math.abs(e.glideTarget - e.pos.p) < 0.001) {
          e.pos.p = e.glideTarget;
          e.glide = false;
        }
      }
      renderStage(time);
      syncUi();
    };
    gsap.ticker.add(frame);

    const io = new IntersectionObserver(
      ([entry]) => { e.visible = entry.isIntersecting; },
      { rootMargin: "200px 0px" }
    );
    io.observe(stageRef.current);

    return () => {
      gsap.ticker.remove(frame);
      io.disconnect();
      gsap.killTweensOf(e.pos);
      clearTimeout(e.settleTimer);
    };
  }, [renderStage, syncUi]);

  // ---- moving ------------------------------------------------------------

  const heading = useCallback(() => {
    const e = eng.current;
    return nearestIndex(e.glide ? e.glideTarget : e.dest, COUNT);
  }, [COUNT]);

  const goTo = useCallback((target, snap = false) => {
    const e = eng.current;
    const to = nearestIndex(target, COUNT);
    e.dest = to;
    e.glide = false;
    clearTimeout(e.settleTimer);
    gsap.killTweensOf(e.pos);
    if (e.reduce) { e.pos.p = to; return; }
    const dist = Math.abs(to - e.pos.p);
    gsap.to(
      e.pos,
      snap
        ? { p: to, duration: 0.5, ease: "power3.out" }
        : { p: to, duration: Math.min(1.3, 0.75 + 0.15 * dist), ease: "power3.inOut" }
    );
  }, [COUNT]);

  // arrows wrap round: Next on the last work goes to the first, Previous on the first
  // goes to the last. (The dial does not wrap.)
  const step = useCallback((dir) => goTo((heading() + dir + COUNT) % COUNT), [goTo, heading, COUNT]);

  // LEFT / RIGHT ARROW KEYS move the carousel from anywhere on the page while the
  // Works section is on screen. Ignored while typing in a field, with a modifier key
  // held, while the details overlay (or any modal that locks page scroll) is open,
  // and when the carousel is mostly off screen.
  useEffect(() => {
    const onKey = (ev) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
      const t = ev.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (detailsOpen.current || document.body.style.overflow === "hidden") return;
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (shown < r.height * 0.4) return;
      ev.preventDefault();
      let next;
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
        next = (heading() + (ev.key === "ArrowRight" ? 1 : -1) + COUNT) % COUNT; // wraps round
      } else {
        // UP / DOWN: bring the closest floating card into focus. Up prefers the closest
        // one that is above the focused card, Down the closest below; if none is on that
        // side, the closest of all.
        const L = eng.current.last;
        const from = heading();
        const fc = L[from] || { px: 0, py: 0 };
        let near = -1, nearD = Infinity, any = -1, anyD = Infinity;
        for (let i = 0; i < COUNT; i++) {
          const c = L[i];
          if (i === from || !c || c.op < 0.3) continue;
          const dist = Math.hypot(c.px - fc.px, c.py - fc.py);
          if (dist < anyD) { any = i; anyD = dist; }
          const sideOk = ev.key === "ArrowUp" ? c.py < fc.py : c.py > fc.py;
          if (sideOk && dist < nearD) { near = i; nearD = dist; }
        }
        next = near >= 0 ? near : any;
        if (next < 0) return;
      }
      goTo(next);
      if (stage.contains(document.activeElement)) faceRefs.current[next]?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [COUNT, goTo, heading]);

  // TWO-FINGER TRACKPAD SWIPE (and shift+wheel) over the stage: stopped before Lenis
  // and moves a target the carousel glides toward; mostly-vertical swipes are left
  // alone so the page still scrolls. After WHEEL_SETTLE_MS of quiet it eases onto
  // the nearest card.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const e = eng.current;

    const onWheel = (ev) => {
      const horizontalIntent = ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY);
      if (!horizontalIntent) return;
      ev.preventDefault();
      ev.stopPropagation();

      if (!e.glide) e.glideTarget = e.pos.p;
      gsap.killTweensOf(e.pos);

      const raw = ev.shiftKey ? ev.deltaY || ev.deltaX : ev.deltaX;
      const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? stage.clientWidth : 1;
      const cardPx = STEP_X * (e.w || stage.clientWidth);
      e.glideTarget = clamp(e.glideTarget + (raw * unit * WHEEL_SPEED) / cardPx, 0, COUNT - 1);
      e.glide = true;

      clearTimeout(e.settleTimer);
      e.settleTimer = setTimeout(() => {
        e.glideTarget = nearestIndex(e.glideTarget, COUNT);
        e.dest = e.glideTarget;
        e.glide = true;
      }, WHEEL_SETTLE_MS);
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [COUNT]);

  // DRAG (mouse or finger) on the stage. Under DRAG_THRESHOLD px it is still a click.
  const onStagePointerDown = (ev) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    cardDrag.current = {
      id: ev.pointerId,
      x0: ev.clientX,
      p0: eng.current.pos.p,
      moved: false,
      vx: 0,
      lx: ev.clientX,
      lt: ev.timeStamp,
    };
  };

  const onStagePointerEnd = (ev) => {
    const d = cardDrag.current;
    if (!d || (ev.pointerId !== undefined && ev.pointerId !== d.id)) return;
    cardDrag.current = null;
    if (!d.moved) return;
    const e = eng.current;
    e.suppressClick = true;
    setTimeout(() => { e.suppressClick = false; }, 60);
    const vx = ev.timeStamp - d.lt > FLICK_IDLE_MS ? 0 : d.vx;
    const carry = clamp(-(vx * FLICK_MS) / (STEP_X * e.w), -1, 1);
    goTo(e.pos.p + carry, true);
  };
  endCardDragRef.current = onStagePointerEnd;

  const onStagePointerMove = (ev) => {
    const d = cardDrag.current;
    if (!d || ev.pointerId !== d.id) return;
    if (ev.pointerType === "mouse" && ev.buttons === 0) return onStagePointerEnd(ev);
    const e = eng.current;
    const dx = ev.clientX - d.x0;
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      d.moved = true;
      stageRef.current.setPointerCapture(ev.pointerId);
      e.glide = false;
      clearTimeout(e.settleTimer);
      gsap.killTweensOf(e.pos);
    }
    const dt = Math.max(1, ev.timeStamp - d.lt);
    d.vx = 0.8 * d.vx + 0.2 * ((ev.clientX - d.lx) / dt);
    d.lx = ev.clientX;
    d.lt = ev.timeStamp;
    e.pos.p = clamp(d.p0 - dx / (STEP_X * e.w), 0, COUNT - 1);
  };

  const activateCard = (i) => {
    if (eng.current.suppressClick) return;
    if (i === heading()) openDetails(WORKS[i]);
    else goTo(i);
  };

  // ---- the dial ----------------------------------------------------------

  const setFromClientX = (clientX) => {
    const rect = sliderRef.current.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const e = eng.current;
    e.glide = false;
    clearTimeout(e.settleTimer);
    gsap.killTweensOf(e.pos);
    e.pos.p = positionFromRatio(ratio, COUNT);
    e.dest = nearestIndex(e.pos.p, COUNT);
  };

  // STUCK-DIAL FIX. The old dial listened for a window "mouseup", which is never
  // delivered if the button is released outside the window, if the browser starts a
  // native text / image drag, or if the window loses focus - the knob then kept
  // following the cursor with no button held. Now the dial CAPTURES the pointer (its
  // release is always delivered to it), any move with no button held counts as a
  // release, losing the window also releases, and native drag-start is cancelled.
  const releaseDial = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    goTo(eng.current.pos.p, true);
  }, [goTo]);

  useEffect(() => {
    const onBlur = () => releaseDial();
    const onUp = (ev) => {
      releaseDial();
      endCardDragRef.current?.(ev);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [releaseDial]);

  const closeDetails = useCallback(() => setActive(null), []);

  return (
    <motion.section
      ref={sectionRef}
      variants={props.sectionFade}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.3 }}
      onViewportEnter={() => props.setworksInView?.(true)}
      className="relative w-full py-8 z-10"
    >
      <motion.h3
        variants={props.sectionFade}
        className="text-2xl bebas-neue-regular text-zinc-100 mb-6 text-center px-6"
      >
        {props.typedworksHeading}
      </motion.h3>

      <div className="section-side-row">
      <SectionSide
        section="works"
        variants={props.sectionFade}
        counter={{
          n: focusIndex + 1,
          total: COUNT,
          // only finished works show their name; the placeholders show just the number
          name: WORKS[focusIndex].image ? WORKS[focusIndex].name : "",
        }}
      >
        {/* the arrow pair lives in the left column, under the section words */}
        <WorksArrows
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />
      </SectionSide>
      <div className="relative section-side-main">
        {/* The stage. "isolate" keeps the cards' z-index (up to 100) from climbing
            above anything outside it. touch-pan-y: a finger can still scroll the page
            vertically, a horizontal drag is ours. */}
        <div
          ref={stageRef}
          className="works-stage relative isolate w-full overflow-hidden select-none touch-pan-y"
          style={{ "--stage-extra": STAGE_EXTRA }}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerEnd}
          onPointerCancel={onStagePointerEnd}
        >
          {WORKS.map((p, i) => (
            <div
              key={i}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="absolute left-1/2 top-1/2"
              style={{ willChange: "transform, filter, opacity" }}
            >
              <div className="tilt-wrap">
                <div className="tilt-inner">
                <div
                  ref={(el) => { faceRefs.current[i] = el; }}
                  role="button"
                  tabIndex={focusIndex === i ? 0 : -1}
                  aria-label={focusIndex === i ? `Open details for ${p.name}` : `Show ${p.name}`}
                  onClick={() => activateCard(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activateCard(i);
                    }
                  }}
                  className="group relative w-full overflow-hidden bg-[#2C2F34] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4FA3D1]"
                >
                  {p.image ? (
                    <img
                      ref={(el) => {
                        imgRefs.current[i] = el;
                        if (el && el.complete && el.naturalWidth) natRefs.current[i] = { w: el.naturalWidth, h: el.naturalHeight };
                      }}
                      onLoad={(ev) => { natRefs.current[i] = { w: ev.currentTarget.naturalWidth, h: ev.currentTarget.naturalHeight }; }}
                      src={p.image}
                      alt={p.name}
                      draggable={false}
                      className="absolute left-0 top-0 object-cover will-change-transform"
                      /* sized and moved every frame by renderStage() once the picture's own
                         size is known; max-width none, or Tailwind's img reset would stop it
                         being wider than the card */
                      style={{ transformOrigin: "0 0", width: "100%", height: "100%", maxWidth: "none" }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xl atma-semibold text-[#E4572E] text-center px-4">
                        COMING SOON
                      </span>
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 pb-10 bg-gradient-to-b from-black/45 to-transparent">
                    <img
                      src={p.appLogo}
                      alt={`${p.name} logo`}
                      draggable={false}
                      className="h-10 w-10 rounded-[10px] object-cover "
                    />
                    <div className="flex h-10 w-10 items-center justify-center">
                      <img
                        src={MY_LOGO}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        className="h-7 w-7 object-contain select-none"
                      />
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Phones (under 900px): no slider. The arrows sit under the cards and the section
            words come under the arrows (the left column itself is hidden on phones).
            Both are hidden by CSS from 900px up. */}
        <div className="works-arrows-mobile px-6 pt-5">
          <WorksArrows
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
        </div>
        <SectionSide
          section="works"
          phone
          counter={{
            n: focusIndex + 1,
            total: COUNT,
            name: WORKS[focusIndex].image ? WORKS[focusIndex].name : "",
          }}
        />
      </div>
      </div>

      {/* custom scrubber, blue (left) to orange (right). Captures the pointer while
          pressed, so releasing it can never be missed. */}
      <div
        ref={sliderRef}
        onPointerDown={(ev) => {
          if (ev.pointerType === "mouse" && ev.button !== 0) return;
          ev.preventDefault();
          dragging.current = true;
          sliderRef.current.setPointerCapture(ev.pointerId);
          setFromClientX(ev.clientX);
        }}
        onPointerMove={(ev) => {
          if (!dragging.current) return;
          if (ev.pointerType === "mouse" && ev.buttons === 0) return releaseDial();
          setFromClientX(ev.clientX);
        }}
        onPointerUp={releaseDial}
        onPointerCancel={releaseDial}
        onLostPointerCapture={releaseDial}
        onDragStart={(ev) => ev.preventDefault()}
        className="works-dial relative mx-auto mt-4 h-3 w-72 max-w-[85vw] rounded-full touch-none select-none section-side-scrubber"
        style={{ background: "linear-gradient(to right, #4FA3D1, #E4572E)" }}
      >
        <div
          ref={knobRef}
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#1F1E24] border border-[#6d697e] shadow"
        />
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {active && (
              <WorkDetails
                key={active.work.name}
                work={active.work}
                fontFamily={active.fontFamily}
                onClose={closeDetails}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </motion.section>
  );
}