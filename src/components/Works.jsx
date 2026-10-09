import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { SiTypescript, SiReact, SiSupabase, SiPostgresql, SiVercel } from "react-icons/si";

gsap.registerPlugin(SplitText);

// Card layout (same on every card):
//   top-left      the work's own logo ("appLogo")
//   top-right     your akpos logo (MY_LOGO), same size the old redirect icon was
//   everywhere    clicking the card opens the details overlay
// There are no redirect links on the cards anymore.
//
// Placeholder works: set "image" to a real src and the "Coming soon" panel
// disappears automatically. Fill in the detail fields to replace the "---".
const MY_LOGO = "/logo.svg";
const PLACEHOLDER_LOGO = "/app-placeholder.png";

// Two-finger trackpad swipe over the carousel:
//   WHEEL_SPEED  how far it travels per swipe (1 = exactly the finger distance)
//   WHEEL_GLIDE  0-1, how quickly it catches up to where the swipe is heading.
//                Lower = longer, floatier glide (Lenis on the page uses 0.12).
const WHEEL_SPEED = 5;
const WHEEL_GLIDE = 0.12;

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
    image: "/duetdays.jpg",
    appLogo: "/duetdays-logo.png",
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

export default function Works(props) {
  const trackRef = useRef(null);
  const sliderRef = useRef(null);
  const knobRef = useRef(null); // the dial knob; moved directly, not through React state
  const dragging = useRef(false);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const sectionRef = useRef(null);
  const [active, setActive] = useState(null); // { work, fontFamily } while details are open

  const openDetails = (work) => {
    const fontFamily = sectionRef.current ? getComputedStyle(sectionRef.current).fontFamily : undefined;
    setActive({ work, fontFamily });
  };

  // The knob position used to be React state (setProgress), which re-rendered
  // this whole component - the section, all five cards - on every single
  // scroll frame while swiping. It's now written straight to the knob's
  // style. setAtStart / setAtEnd only cause a re-render when they actually
  // flip (React skips a set to the same value).
  const syncFromScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
    const p = max > 0 ? el.scrollLeft / max : 0;
    if (knobRef.current) knobRef.current.style.left = `calc(${p * 100}% - 8px)`;
  };

  // Batched via requestAnimationFrame, same pattern as the rest of the
  // site's scroll listeners. A raw "scroll" event can fire dozens of times
  // per second while dragging - reading scrollWidth/clientWidth (a layout
  // read) on every single one of those, unthrottled, adds needless layout
  // work exactly while the carousel is being actively dragged, which is
  // when it's most likely to be felt as stiffness (touch drag especially).
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; syncFromScroll(); }); }
    };
    syncFromScroll();
    const el = trackRef.current;
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // TWO-FINGER TRACKPAD SWIPE (and shift+wheel) over the carousel.
  // Two things were going on:
  //  1) Lenis listens for wheel on window and, for any swipe with even a tiny
  //     vertical part (every real swipe has one), cancels the browser's
  //     native scroll and moves the PAGE instead - so the carousel only got
  //     the rare perfectly-horizontal events.
  //  2) The browser's own trackpad scrolling also adds MOMENTUM: a short flick
  //     keeps coasting after your fingers lift. The moment we take the swipe
  //     over (preventDefault) that built-in momentum is gone, so the
  //     carousel stopped dead when your fingers did and felt slow.
  // So: a mostly-horizontal swipe is stopped before Lenis, and instead of
  // jumping scrollLeft, it moves a TARGET that the carousel glides toward
  // every frame (same idea Lenis uses for the page). Mostly-vertical swipes
  // are left alone, so scrolling the page over the carousel still works.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let target = el.scrollLeft;
    let pos = el.scrollLeft;
    let running = false;

    const tick = () => {
      pos += (target - pos) * WHEEL_GLIDE;
      if (Math.abs(target - pos) < 0.5) {
        pos = target;
        running = false;
        gsap.ticker.remove(tick);
      }
      el.scrollLeft = pos;
    };

    const onWheel = (e) => {
      const horizontalIntent = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontalIntent) return;
      e.preventDefault();
      e.stopPropagation();

      // if something else moved the carousel (arrows, dial), start from there
      if (!running) target = pos = el.scrollLeft;

      const raw = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
      const max = el.scrollWidth - el.clientWidth;
      target = Math.min(max, Math.max(0, target + raw * unit * WHEEL_SPEED));

      if (!running) {
        running = true;
        gsap.ticker.add(tick);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      gsap.ticker.remove(tick);
    };
  }, []);

  // Netflix-style arrows: only show the ones that would actually do something
  const scrollByPage = (dir) => {
    const el = trackRef.current;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  // dragging the volume-dial knob scrubs the carousel directly
  const setFromClientX = (clientX) => {
    const rect = sliderRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const el = trackRef.current;
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  };

  useEffect(() => {
    const onMove = (e) => dragging.current && setFromClientX(e.clientX);
    const onUp = () => (dragging.current = false);
    const onTouchMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      setFromClientX(e.touches[0].clientX);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // passive:false so we can preventDefault - otherwise the page itself
    // tries to scroll vertically while a finger is dragging the knob
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

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

      <div className="relative">
        {!atStart && (
          <button
            onClick={() => scrollByPage(-1)}
            aria-label="Previous work"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}

        {/* the name label sits in normal flow above the image and never
            moves on its own - only the image below scales on hover, so
            nothing can climb up into the heading above the carousel */}
        <div
          ref={trackRef}
          className="flex overflow-x-auto scrollbar-none gap-1 px-1"
          style={{ scrollBehavior: "auto" }}
        >
          {WORKS.map((p, i) => (
            <div key={i} className="shrink-0 w-[46vw] sm:w-[420px]">
              <p className="text-xs tracking-widest uppercase text-zinc-300 mb-2 px-1">
                {p.name}
              </p>

              {/* clicking anywhere on the card opens the details overlay */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`Open details for ${p.name}`}
                onClick={() => openDetails(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetails(p);
                  }
                }}
                className="group relative h-[58vh] max-h-[560px] overflow-hidden bg-[#2C2F34] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4FA3D1]"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xl atma-semibold text-[#E4572E] text-center px-4">
                      COMING SOON
                    </span>
                  </div>
                )}

                {/* top bar: the work's own logo (left), my logo (right, same
                    40px box the redirect icon used). A soft dark fade keeps
                    both readable on bright screenshots. Purely decorative,
                    so it ignores clicks and they fall through to the card. */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 pb-10 bg-gradient-to-b from-black/45 to-transparent">
                  <img
                    src={p.appLogo}
                    alt={`${p.name} logo`}
                    className="h-10 w-10 rounded-[10px] object-cover "
                  />
                  <div className="flex h-10 w-10 items-center justify-center">
                    <img
                      src={MY_LOGO}
                      alt=""
                      aria-hidden="true"
                      className="h-7 w-7 object-contain select-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!atEnd && (
          <button
            onClick={() => scrollByPage(1)}
            aria-label="Next work"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>

      {/* custom scrubber replacing the native scrollbar entirely: cold blue
          (left) to hot orange (right). A plain div + drag handlers, not a
          native <input>, so nothing here can ever show the OS cursor. */}
      <div
        ref={sliderRef}
        onMouseDown={(e) => {
          dragging.current = true;
          setFromClientX(e.clientX);
        }}
        onTouchStart={(e) => {
          dragging.current = true;
          setFromClientX(e.touches[0].clientX);
        }}
        className="relative mx-auto mt-4 h-3 w-72 max-w-[85vw] rounded-full touch-none"
        style={{ background: "linear-gradient(to right, #4FA3D1, #E4572E)" }}
      >
        <div
          ref={knobRef}
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#1F1E24] border border-[#6d697e] shadow"
        />
      </div>

      {/* rendered into document.body so the overlay covers the whole page and
          isn't affected by this section's transforms / z-index */}
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
