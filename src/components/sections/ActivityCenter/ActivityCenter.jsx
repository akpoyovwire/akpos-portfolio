import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ActivityModal from "./ActivityModal";
import PlayModal from "./PlayModal";
import useCarousel from "./useCarousel";
import { ACTIVITIES, ACTIVITY_LOGO } from "./activityData";
import "../../../styles/activity-center.css"; // all Activity Center + game styles live here
import ListeningRoomModal from "./ListeningRoom/ListeningRoomModal";
import MonIAModal from "./MyAI/MonIAModal";

// Listening Room and Mon IA get their real interfaces in later steps.
function ComingSoonModal({ activity, onClose }) {
  return (
    <ActivityModal title={activity.name} onClose={onClose} level={1}>
      <p className="activity-modal-intro">This is being built next.</p>
    </ActivityModal>
  );
}

// Add a modal here as each activity is built.
const MODALS = { play: PlayModal, "listening-room": ListeningRoomModal, "mon-ia": MonIAModal };

function useTyping(text, active, speed = 80) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!active) {
      setShown("");
      return;
    }
    let i = 0;
    const timer = setInterval(() => {
      setShown(text.slice(0, i + 1));
      i += 1;
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, active]);
  return shown;
}

// Used when App doesn't pass its own sectionFade
const DEFAULT_FADE = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.12 } },
};

export default function ActivityCenter({ sectionFade = DEFAULT_FADE }) {
  const [inView, setInView] = useState(false);
  const [openId, setOpenId] = useState(null);
  const heading = useTyping("Activity Center", inView);
  const c = useCarousel();

  const close = useCallback(() => setOpenId(null), []);
  const open = ACTIVITIES.find((a) => a.id === openId);
  const Modal = open ? MODALS[open.id] || ComingSoonModal : null;

  return (
    <motion.section
      className="activity-center"
      variants={sectionFade}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount: 0.3 }}
      onViewportEnter={() => setInView(true)}
    >
      <motion.h3 variants={sectionFade} className="activity-center-heading">
        {heading}
      </motion.h3>

      <div className="activity-center-stage">
        {!c.atStart && (
          <button type="button" onClick={() => c.scrollByPage(-1)} aria-label="Previous activity" className="activity-center-arrow activity-center-arrow--prev">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}

        <div ref={c.trackRef} className="activity-center-track">
          {ACTIVITIES.map((a) => (
            <div key={a.id} className="activity-center-card-wrap">
              <p className="activity-center-card-label">{a.name}</p>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Open ${a.name}`}
                onClick={() => setOpenId(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(a.id);
                  }
                }}
                className="activity-center-card"
              >
                <span className="activity-center-card-fallback">{a.name}</span>
                <img
                  src={a.image}
                  alt={a.name}
                  loading="lazy"
                  decoding="async"
                  className="activity-center-card-img"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="activity-center-card-top">
                  <img src={ACTIVITY_LOGO} alt="" aria-hidden="true" className="activity-center-card-logo" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!c.atEnd && (
          <button type="button" onClick={() => c.scrollByPage(1)} aria-label="Next activity" className="activity-center-arrow activity-center-arrow--next">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}
      </div>

      <div
        ref={c.sliderRef}
        onMouseDown={c.onSliderMouseDown}
        onTouchStart={c.onSliderTouchStart}
        className={`activity-center-scrubber${c.overflowing ? "" : " activity-center-scrubber--hidden"}`}
      >
        <div ref={c.knobRef} className="activity-center-scrubber-knob" />
      </div>

      <AnimatePresence>{open && <Modal key={open.id} activity={open} onClose={close} />}</AnimatePresence>
    </motion.section>
  );
}
