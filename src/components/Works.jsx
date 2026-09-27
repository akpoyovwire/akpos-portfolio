import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

// The first entry is real. The other four are placeholders until you have
// screenshots and logos for them — set "image" to a real src and the
// "Coming soon" placeholder disappears automatically.
const WORKS = [
  {
    name: "DuetDays",
    desc: "A productivity tracker built with React & Supabase. Includes user auth, real-time tasks, SEO indexing.",
    link: "https://duet-days.lovable.app/",
    image: "/duetdays.jpg",
  },
  { name: "#2", desc: "Patience is a Virtue.", link: null, image: null },
  { name: "#3", desc: "Patience is a Virtue.", link: null, image: null },
  { name: "#4", desc: "Patience is a Virtue.", link: null, image: null },
  { name: "#5", desc: "Patience is a Virtue.", link: null, image: null },
];

export default function Works(props) {
  const trackRef = useRef(null);
  const sliderRef = useRef(null);
  const dragging = useRef(false);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1, drives the volume-dial knob

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

  return (
    <motion.section variants={props.sectionFade} className="relative w-full py-8 z-10">
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

              <div className="group relative h-[58vh] max-h-[560px] overflow-hidden bg-[#2C2F34]">
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

                {/* narration overlaid on the image itself, bottom edge */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-10">
                  <p className="text-sm text-zinc-100">{p.desc}</p>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#E4572E] hover:underline text-sm inline-block mt-1"
                    >
                      View Live
                    </a>
                  )}
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
    </motion.section>
  );
}
