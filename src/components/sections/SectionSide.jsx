import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import "./section-side.css";

// The short text on the LEFT of a section (Expertise, Works, Activity Center).
// Edit the words here, in one place. It never changes the section's own content:
//   Works + Activity Center: put <SectionSide> beside the carousel inside a .section-side-row (see Works.jsx / ActivityCenter.jsx).
//   Expertise: put it inside the section root (which must be position: relative) and pass hidden={true}
//   while a discipline is open, so it fades away.
// Phones: hidden by CSS (under 900px, and under 1100px for Expertise).
//
// SCROLL-LINKED UNSCRAMBLE
// Every letter starts shuffled: swapped into another letter's slot on its line, and a few
// letters also drift, tilt and blur. Scrolling the section into view glides them home
// (scrub), scrolling back up scatters them again. Nothing plays on its own.
// Tune the feel with the SCRAMBLE constants below.
export const SECTION_SIDE = {
  expertise: {
    num: "00", // the big grey number behind the text: change it per section here
    label: "Expertise",
    text: "Development, security, AI, research and rhetoric. Pick an icon to see what I do in each one and the tools I use.",
  },
  works: {
    num: "00",
    label: "Works",
    text: "Things I have designed and built, from first sketch to shipped. Scroll sideways or use the arrows, and open any project for the full story.",
  },
  activity: {
    num: "00",
    label: "Activity Center",
    text: "Part playground, part showroom. Play a game against me, hear my top five songs of the month in the Listening Room, or ask Mon IA anything about me.",
  },
};

const SCRAMBLE = {
  enterFrom: 0.9,     // scrambled while the block's centre is below this height of the screen (0 = top, 1 = bottom)
  readableAt: 0.7,    // fully readable once its centre has risen to this height
  leaveAt: 0.4,       // scrambles again once its centre rises above this height (going out the top)
  coverDone: 0.6,     // fully scrambled once the next section has covered this much of the way (0-1)
  glide: 0.14,        // 0-1 catch-up per frame (lower = floatier, 1 = locked to the scrollbar)
  flyers: 0.22,       // share of letters that also drift / tilt / blur
  spread: 0.4,        // 0-1: how staggered the letters are as they settle
};

// App.jsx's StackLayer dims a section with a black overlay (opacity 0 -> DIM_MAX) while the
// next section slides over it. That overlay is the "being covered" signal for Expertise and
// Works, whose own position never changes (only Activity Center slides). Keep in sync with App.jsx.
const DIM_MAX = 0.45;

// ONE shared loop for every SectionSide on the page: all the measuring (reads) happens first,
// then all the animating (writes), so three instances never cause layout thrashing, and the
// loop is removed from GSAP's ticker when none are mounted.
const instances = new Set();
function loop() {
  const vh = window.innerHeight;
  const maxScroll = document.documentElement.scrollHeight - vh;
  const scrollY = window.scrollY;
  instances.forEach((i) => i.measure(vh, maxScroll, scrollY));
  instances.forEach((i) => i.apply());
}
function register(inst) {
  if (!instances.size) gsap.ticker.add(loop);
  instances.add(inst);
}
function unregister(inst) {
  instances.delete(inst);
  if (!instances.size) gsap.ticker.remove(loop);
}

const rand = (a, b) => a + Math.random() * (b - a);

// text -> words -> letters. Words never break across lines; letters are inline-blocks we can move.
function Letters({ text }) {
  return text.split(" ").map((word, w, all) => (
    <React.Fragment key={w}>
      <span className="ss-word" aria-hidden="true">
        {[...word].map((ch, i) => (
          <span className="ss-char" key={i}>{ch}</span>
        ))}
      </span>
      {w < all.length - 1 ? " " : null}
    </React.Fragment>
  ));
}

export default function SectionSide({ section, hidden = false }) {
  const c = SECTION_SIDE[section];
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !c) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tl = null;
    let dead = false;
    let want = 0; // where the block should be: 0 scrambled .. 1 readable
    let cur = 0;  // where it is now (glides toward `want`)
    const parts = () => Array.from(root.querySelectorAll(".ss-char, .ss-line"));
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const layer = root.closest("[data-section]");

    // READ phase. Where is the block, and is another section sliding over it?
    const measure = (vh, maxScroll, scrollY) => {
      const r = root.getBoundingClientRect();
      const half = r.height / 2;
      const centre = (r.top + half) / vh;
      // at the very end of the page it can't rise any further: be readable by then
      const centreAtEnd = (r.top + half - (maxScroll - scrollY)) / vh;
      const readable = Math.min(SCRAMBLE.enterFrom - 0.05, Math.max(SCRAMBLE.readableAt, centreAtEnd));
      const enter = clamp((SCRAMBLE.enterFrom - centre) / (SCRAMBLE.enterFrom - readable));
      const leave = clamp(centre / SCRAMBLE.leaveAt);
      // covered by the next section (App.jsx's dim overlay is the layer's next sibling)
      const dim = layer?.nextElementSibling;
      const covered = dim ? clamp((parseFloat(dim.style.opacity) || 0) / DIM_MAX / SCRAMBLE.coverDone) : 0;
      want = Math.min(enter, leave, 1 - covered);
    };
    // WRITE phase.
    const apply = () => {
      if (!tl) return;
      cur += (want - cur) * SCRAMBLE.glide;
      if (Math.abs(want - cur) < 0.0005) cur = want;
      if (Math.abs(tl.progress() - cur) > 0.0002) tl.progress(cur);
    };
    const inst = { measure, apply };

    const teardown = () => {
      unregister(inst);
      if (tl) { tl.kill(); tl = null; }
      gsap.set(parts(), { clearProps: "all" });
    };

    const build = () => {
      teardown();
      if (dead) return;
      if (!root.offsetParent && getComputedStyle(root).position !== "fixed") return; // display:none on phones
      const all = Array.from(root.querySelectorAll(".ss-char"));
      if (!all.length) return;

      // measure every letter's home slot, grouped by line
      const info = all.map((el) => ({ el, x: el.offsetLeft, y: el.offsetTop }));
      const lines = new Map();
      info.forEach((o) => {
        const k = Math.round(o.y);
        if (!lines.has(k)) lines.set(k, []);
        lines.get(k).push(o);
      });

      tl = gsap.timeline({ paused: true });

      // the little line before the label draws from nothing
      const line = root.querySelector(".ss-line");
      if (line) tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.out", immediateRender: true }, 0);

      lines.forEach((row) => {
        // a random permutation of the slots on this line: letters land in each other's places
        const slots = row.map((o) => ({ x: o.x, y: o.y }));
        for (let i = slots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        row.forEach((o, i) => {
          const fly = Math.random() < SCRAMBLE.flyers;
          const from = {
            x: slots[i].x - o.x,
            y: slots[i].y - o.y + (fly ? rand(-70, 70) : 0),
            rotation: fly ? rand(-80, 80) : 0,
            opacity: fly ? 0.25 : 1,
          };
          const to = { x: 0, y: 0, rotation: 0, opacity: 1, ease: "power2.out", duration: 1 - SCRAMBLE.spread, immediateRender: true };
          if (fly) {
            from.filter = "blur(6px)";
            to.filter = "blur(0px)";
          }
          tl.fromTo(o.el, from, to, rand(0, SCRAMBLE.spread));
        });
      });

      measure(window.innerHeight, document.documentElement.scrollHeight - window.innerHeight, window.scrollY);
      cur = want;
      tl.progress(cur);
      register(inst);
    };

    let timer;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(build, 200); };
    window.addEventListener("resize", onResize);
    // the page above can still change height (images, typed headings): re-sync once it settles
    let rt;
    const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (tl) { measure(window.innerHeight, document.documentElement.scrollHeight - window.innerHeight, window.scrollY); cur = want; } }, 150); });
    ro.observe(document.body);
    // measure after the web fonts (Bebas Neue / Voltaire) are in, or the slots are wrong
    (document.fonts?.ready ?? Promise.resolve()).then(build);

    return () => {
      dead = true;
      clearTimeout(timer);
      clearTimeout(rt);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      teardown();
    };
  }, [c]);

  if (!c) return null;
  return (
    <div className={`section-side section-side--${section}${hidden ? " is-hidden" : ""}`} aria-hidden={hidden || undefined}>
      <aside ref={rootRef} className="section-side-inner" aria-label={`About ${c.label}`}>
        <span className="section-side-num" aria-hidden="true">{c.num}</span>
        <p className="section-side-label" aria-label={c.label}><span className="ss-line" aria-hidden="true" /><Letters text={c.label} /></p>
        <p className="section-side-text" aria-label={c.text}><Letters text={c.text} /></p>
      </aside>
    </div>
  );
}