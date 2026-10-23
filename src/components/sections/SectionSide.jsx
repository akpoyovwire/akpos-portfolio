import React from "react";
import { motion } from "framer-motion";
import "./section-side.css";

// The short text on the LEFT of a section (Expertise, Works, Activity Center).
// Edit the words here, in one place. It never changes the section's own content:
//   Works + Activity Center: put <SectionSide> beside the carousel inside a .section-side-row (see Works.jsx / ActivityCenter.jsx).
//   Expertise: put it inside the section root (which must be position: relative) and pass hidden={true}
//   while a discipline is open, so it fades away.
// Phones: hidden by CSS (under 900px, and under 1100px for Expertise).
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

export default function SectionSide({ section, hidden = false, variants }) {
  const c = SECTION_SIDE[section];
  if (!c) return null;
  return (
    <div className={`section-side section-side--${section}${hidden ? " is-hidden" : ""}`} aria-hidden={hidden || undefined}>
      <motion.aside variants={variants} className="section-side-inner" aria-label={`About ${c.label}`}>
        <span className="section-side-num" aria-hidden="true">{c.num}</span>
        <p className="section-side-label">{c.label}</p>
        <p className="section-side-text">{c.text}</p>
      </motion.aside>
    </div>
  );
}