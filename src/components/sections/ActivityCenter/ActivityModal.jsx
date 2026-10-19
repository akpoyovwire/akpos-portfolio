import React, { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useIsPresent } from "framer-motion";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

/*
  Shared Activity Center modal (same glass look and close behaviour as the
  Works details overlay). Used by Play, Listening Room, Mon IA and every game.

  NESTED MODALS
  - openModals is a stack: only the TOPMOST modal reacts to Escape / Tab.
  - lockCount: page scroll is locked by the first modal and released only when
    the last one closes, so closing a game never unlocks the page while the
    Play modal is still open.

  closeSide="left" puts the close button on the left (used by game modals).
  level={2} stacks the modal above a level-1 modal.
*/
const openModals = [];
let lockCount = 0;
let savedOverflow = "";
let savedPadding = "";

function lockPage() {
  if (lockCount === 0) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    savedOverflow = document.body.style.overflow;
    savedPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    window.dispatchEvent(new CustomEvent("lenis:stop"));
  }
  lockCount += 1;
}

function unlockPage() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPadding;
    window.dispatchEvent(new CustomEvent("lenis:start"));
  }
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export default function ActivityModal({ title, onClose, closeSide = "right", level = 1, variant = "page", showHeader = true, children }) {
  const id = useId();
  const isPresent = useIsPresent();
  const dialogRef = useRef(null);
  const scrollerRef = useRef(null);
  const rootRef = useRef(null);
  const titleRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // wheel / touch over the modal must never reach the page (Lenis listens on window)
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

  // scroll lock, modal stack, Escape, Tab trap, focus restore
  useEffect(() => {
    if (!isPresent) return; // already closing: release everything right away
    const previouslyFocused = document.activeElement;
    openModals.push(id);
    lockPage();

    const onKey = (e) => {
      if (openModals[openModals.length - 1] !== id) return; // not the topmost modal
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === scrollerRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    // focus the modal itself, unless a child (e.g. a game's first button) already took focus
    if (dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
      scrollerRef.current?.focus({ preventScroll: true });
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      const i = openModals.indexOf(id);
      if (i !== -1) openModals.splice(i, 1);
      unlockPage();
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isPresent, id]);

  // title reveal: same move as the Works overlay and About
  useLayoutEffect(() => {
    if (!titleRef.current) return; // game modals have no big header
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const split = new SplitText(titleRef.current, { type: "words" });
      gsap.set(split.words, { yPercent: 120, rotate: 8, scale: 1.4, autoAlpha: 0, transformOrigin: "left bottom" });
      gsap.to(split.words, { yPercent: 0, rotate: 0, scale: 1, autoAlpha: 1, stagger: 0.06, duration: 1, ease: "power3.out", delay: 0.15 });
    }, rootRef);
    return () => ctx.revert();
  }, [title]);

  return createPortal(
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`activity-modal activity-modal--level-${level}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* blur + scroll layer; the close button is a SIBLING so backdrop-filter
          can't turn it into a non-viewport-fixed element (same reason as Works) */}
      <div ref={scrollerRef} tabIndex={-1} data-lenis-prevent className="activity-modal-scroll">
        <div ref={rootRef} className={`activity-modal-inner activity-modal-inner--${variant}${showHeader ? "" : " activity-modal-inner--bare"}`}>
          {showHeader && (
            <>
              <h2 ref={titleRef} className="activity-modal-title">
                {title}
              </h2>
              <div className="activity-modal-rule" />
            </>
          )}
          <div className="activity-modal-body">{children}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={`Close ${title}`}
        className={`activity-modal-close activity-modal-close--${closeSide}`}
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
    </motion.div>,
    document.body
  );
}
