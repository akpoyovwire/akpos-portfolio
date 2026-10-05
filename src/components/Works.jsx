import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { SiTypescript, SiReact, SiSupabase, SiPostgresql, SiVercel } from "react-icons/si";
import CustomScrollbar from "./CustomScrollbar";

gsap.registerPlugin(SplitText);

// Card layout (same on every card):
//   top-left      the work's own logo ("appLogo")
//   top-right     redirect icon (#4FA3D1). DuetDays -> its live site (new tab).
//                 Works that aren't ready yet -> your home page.
//   bottom-center your akpos logo (MY_LOGO)
//   anywhere else clicking the card opens the details overlay.
//
// Placeholder works: set "image" to a real src and the "Coming soon" panel
// disappears automatically. Fill in the detail fields to replace the "---".
const MY_LOGO = "/logo.svg";
const PLACEHOLDER_LOGO = "/app-placeholder.png";
const HOME = "/";
const BLUE = "#4FA3D1";

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
  details: "Coming soon",
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

// Redirect icon (the "arrow out of a box" from your image), redrawn as SVG so
// it takes the exact blue.
function RedirectIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke={BLUE}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

/*
  Details overlay. A modal on top of the current page (not a route).
  Its content plays About's reveal on its own as soon as it opens: title
  words rise in with the same rotate/scale/stagger, the description comes in
  line by line, and the detail rows follow. Same easing and offsets as About.
  Closing plays that same timeline backwards, then the backdrop fades out.

  "fontFamily" is read from the Works section when the overlay is opened and
  applied here, because the overlay is portaled to document.body and would
  otherwise lose the font the rest of the site inherits.

  STRUCTURE (why there are two layers now, not one)
  `backdrop-filter` (the blur) on an element creates a new containing block
  for any `position: fixed` descendant - the same way `transform` does. The
  close button used to live inside the same div that was BOTH the blurred
  backdrop AND the scroll container, so "fixed" was resolving against that
  div's own box, not the real viewport - meaning it scrolled away with
  everything else instead of staying put. Now the blur+scroll live on an
  inner layer (`scrollRef`), and the close button is a sibling of that
  layer, one level up, in a plain (non-filtered) wrapper - so it has
  nothing but the real viewport to be fixed against.

  SCROLLING + CUSTOM SCROLLBAR
  `scrollRef` is the actual scrolling box; `rootRef` is the inner content
  wrapper that grows with the title/description/rows. CustomScrollbar gets
  both: `containerRef={scrollRef}` for scrollTop/scrollTo, `contentRef=
  {rootRef}` so it notices when the content's height changes (the scroll
  box itself is a fixed, viewport-sized `absolute inset-0` - it never
  resizes on its own, only its content does). Passing `containerRef` at all
  is what tells CustomScrollbar this is a modal-scoped instance rather than
  the main-page one - see that file's header for what that changes.

  TEXT STYLE
  Every piece of text in here other than the title and the link now shares
  one style (LABEL_STYLE, the same small tracked caps the "Period"/"Role"
  labels already used) - the description, the row values, and the tool
  names all inherit it. The link keeps its own orange.
*/
const CLOSE_SPEED = 1.5; // how fast the reveal plays backwards (1 = same speed as opening)
const LABEL_STYLE = "text-xs tracking-widest uppercase text-zinc-400";
const LABEL_SHAPE = "text-xs tracking-widest uppercase"; // same shape, no color - for elements that need a different color (the link)

function WorkDetails({ work, onClose, fontFamily }) {
  const tlRef = useRef(null);
  const closingRef = useRef(false);
  const scrollRef = useRef(null);
  const rootRef = useRef(null);
  const titleRef = useRef(null);
  const ruleRef = useRef(null);
  const bodyRef = useRef(null);
  const closeRef = useRef(null);

  // play the reveal backwards, then unmount
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const tl = tlRef.current;
    if (!tl) return onClose(); // reduced motion: nothing to reverse
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
    // with the body-overflow lock above and the scroll div's
    // data-lenis-prevent, so there's no path left (wheel, touch, or
    // Lenis's own virtual scroll state) for scroll input to leak through
    // to the page behind. App.jsx listens for these two events; the
    // main-page CustomScrollbar instance also listens, to hide itself
    // while this is open.
    window.dispatchEvent(new CustomEvent("lenis:stop"));

    const onKey = (e) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();

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
      {/* SCROLL LAYER - the blur + the actual scrolling live here, and
          nowhere else, on purpose (see the containing-block note above). */}
      <div
        ref={scrollRef}
        data-lenis-prevent
        className="absolute inset-0 overflow-y-auto bg-[#17161b]/90 backdrop-blur-[6px] [&::-webkit-scrollbar]:hidden"
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

      {/* this overlay's own scrollbar, scoped to the scroll layer above -
          not the main page's (that one hides itself while this is open) */}
      <CustomScrollbar containerRef={scrollRef} contentRef={rootRef} />

      {/* CLOSE BUTTON - a sibling of the scroll layer above, not a child of
          it, so it's genuinely fixed to the viewport and never scrolls. */}
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
  const dragging = useRef(false);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1, drives the volume-dial knob
  const sectionRef = useRef(null);
  const [active, setActive] = useState(null); // { work, fontFamily } while details are open

  const openDetails = (work) => {
    const fontFamily = sectionRef.current ? getComputedStyle(sectionRef.current).fontFamily : undefined;
    setActive({ work, fontFamily });
  };

  const syncFromScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
    setProgress(max > 0 ? el.scrollLeft / max : 0);
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
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white text-xl flex items-center justify-center"
          >
            ‹
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

              {/* clicking anywhere on the card (except the redirect icon)
                  opens the details overlay */}
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

                {/* top bar: the work's own logo (left), redirect icon (right).
                    A soft dark fade keeps both readable on bright screenshots.
                    The bar ignores clicks so they fall through to the card;
                    only the redirect icon takes them. */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3 pb-10 bg-gradient-to-b from-black/45 to-transparent">
                  <img
                    src={p.appLogo}
                    alt={`${p.name} logo`}
                    className="h-10 w-10 rounded-[10px] object-cover "
                  />
                  <a
                    href={p.link ?? HOME}
                    {...(p.link ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    aria-label={p.link ? `Visit ${p.name}` : "Go to home page"}
                    className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-[10px] hover:scale-110 transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4FA3D1]"
                  >
                    <RedirectIcon />
                  </a>
                </div>

                {/* my logo, bottom-center */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-16 pb-4">
                  <img
                    src={MY_LOGO}
                    alt=""
                    aria-hidden="true"
                    className="h-10 sm:h-14 w-auto drop-shadow-lg select-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!atEnd && (
          <button
            onClick={() => scrollByPage(1)}
            aria-label="Next work"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white text-xl flex items-center justify-center"
          >
            ›
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
          className="absolute top-1/2 w-4 h-4 rounded-full bg-[#1F1E24] border border-[#6d697e] shadow"
          style={{ left: `calc(${progress * 100}% - 8px)`, transform: "translateY(-50%)" }}
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
