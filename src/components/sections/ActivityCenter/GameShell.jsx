import React, { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import InfoDialog from "./InfoDialog";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Layout every game shares: the game fills the screen, the game's name sits on
// the RIGHT and animates in like the "Play" title, and an optional intro line
// (the game's `tagline`) fades in on the LEFT. On phones both go above the game.
// A tagline can have two sentences; each one sits on its own line.
// Optional `info` (see InfoDialog.jsx) adds an "i" button right after the title that opens an About panel.
export default function GameShell({ title, tagline, info, mainClassName = "", children }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const titleRef = useRef(null);
  const taglineRef = useRef(null);

  // title: same entrance as the "Play" title, each word rises in with a twist
  useLayoutEffect(() => {
    if (!titleRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray(".activity-game-title-word", titleRef.current);
      gsap.set(words, { yPercent: 120, rotate: 8, scale: 1.4, autoAlpha: 0, transformOrigin: "right bottom" });
      gsap.to(words, { yPercent: 0, rotate: 0, scale: 1, autoAlpha: 1, stagger: 0.06, duration: 1, ease: "power3.out", delay: 0.15 });
    }, titleRef);
    return () => ctx.revert();
  }, [title]);

  // tagline: a plain fade-in, just after the title lands
  useLayoutEffect(() => {
    const el = taglineRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out", delay: 0.6 });
    }, el);
    return () => ctx.revert();
  }, [tagline]);

  const lines = tagline ? tagline.match(/[^.?!]+[.?!]+/g) || [tagline] : [];

  return (
    <div className="activity-game-layout">
      <aside className="activity-game-side">
        <h2 ref={titleRef} className="activity-game-title">
          {title.split(" ").map((word, i) => (
            <span key={i} className="activity-game-title-word">
              {word}{" "}
            </span>
          ))}
        </h2>
        {info && (
          <button type="button" className="activity-info-btn" onClick={() => setInfoOpen(true)} aria-label={`About ${title}`} title={`About ${title}`} aria-haspopup="dialog">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
          </button>
        )}
      </aside>

      {tagline && (
        <p ref={taglineRef} className="activity-game-tagline">
          {lines.map((line, i) => (
            <span key={i} className="activity-game-tagline-line">
              {line.trim()}
            </span>
          ))}
        </p>
      )}

      <div className={`activity-game-main ${mainClassName}`.trim()}>{children}</div>
      {info && <InfoDialog open={infoOpen} info={info} onClose={() => setInfoOpen(false)} />}
    </div>
  );
}