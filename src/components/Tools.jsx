import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Database } from "lucide-react"
import { FaHtml5, FaCss3Alt, FaJsSquare, FaReact } from "react-icons/fa"

const TOOLS = [
  {
    icon: <FaHtml5 size={30} color="#E34F26" />,
    shadow: "rgba(227, 79, 38, 0.6)",
    border: "#E34F26",
    desc: "I use HTML to craft clean, accessible structure for modern, user-friendly websites.",
  },
  {
    icon: <FaCss3Alt size={30} color="#1572B6" />,
    shadow: "rgba(21, 114, 182, 0.6)",
    border: "#1572B6",
    desc: "With the utilisation of CSS I am able to style interfaces with responsive, elegant, and engaging visuals.",
  },
  {
    icon: <FaJsSquare size={30} color="#F7DF1E" />,
    shadow: "rgba(247, 223, 30, 0.6)",
    border: "#F7DF1E",
    desc: "Using JavaScript, I bring pages to life with dynamic, interactive features.",
  },
  {
    icon: <FaReact size={30} color="#61DBFB" />,
    shadow: "rgba(97, 219, 251, 0.6)",
    border: "#61DBFB",
    desc: "React helps me build fast, scalable frontends with reusable components.",
  },
  {
    icon: <Database size={30} color="#43bc88" />,
    shadow: "rgba(91, 141, 184, 0.6)",
    border: "#43bc88",
    desc: "I connect secure backends with real-time data and auth.",
  },
]

export default function Tools(props) {
  const selected = props.toolDescription

  return (
    <motion.section
      variants={props.sectionFade}
      className="px-6 py-12 max-w-4xl mx-auto relative z-10"
    >
      <motion.h3
        variants={props.sectionFade}
        className="text-2xl bebas-neue-regular text-zinc-100 mb-8 text-center"
      >
        {props.typedToolsHeading}
      </motion.h3>

      {/* Spin + glow are pure CSS now (see .tool-icon in index.css), driven
          by :hover and a toggled class - not JS mouseenter/leave state.
          A real CSS :hover can never get "stuck" the way a JS-tracked
          hover flag can when enter/leave events race each other, which is
          what was leaving some icons glowing after the mouse had left. */}
      <div className="flex flex-row flex-wrap items-start justify-center gap-6 md:gap-10">
        {TOOLS.map(({ icon, shadow, border }, i) => (
          <a
            key={i}
            onClick={() => props.setToolDescription(i === selected ? null : i)}
            className={`tool-icon flex-shrink-0 inline-flex items-center justify-center w-16 h-16 rounded-full cursor-pointer ${
              selected === i ? "tool-active" : ""
            }`}
            style={{
              border: `2px solid ${border}`,
              backgroundColor: "#2C2F34",
              "--tool-glow": `drop-shadow(0 0 12px ${shadow})`,
            }}
          >
            {icon}
          </a>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {selected !== null && (
          <motion.div
            key={selected}
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="overflow-hidden mt-6"
          >
            <div className="relative mx-auto max-w-xl px-5 py-3 bg-white/10 backdrop-blur-md rounded-lg shadow-lg">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E4572E] rounded" />
              <p className="pl-4 pr-2 text-sm text-left">{TOOLS[selected].desc}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
