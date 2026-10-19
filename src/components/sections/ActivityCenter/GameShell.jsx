import React, { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Layout every game shares: the game fills the screen, the game's name sits on
// the RIGHT and animates in like the "Play" title, and an optional intro line
// (the game's `tagline`) fades in on the LEFT. On phones both go above the game.
// A tagline can have two sentences; each one sits on its own line.
export default function GameShell({ title, tagline, children }) {
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

      <div className="activity-game-main">{children}</div>
    </div>
  );
}
