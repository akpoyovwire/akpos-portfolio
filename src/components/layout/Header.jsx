import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import "../../styles/header-nav.css"

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const ORANGE = "#E4572E"
const BLUE = "#4A78A3"
const BLACK = "#1F1E24"

const SPIN = 1.1 // seconds: colour change and the label spin run together

const NAV = [
  { id: "about", en: "About", fr: "A-propos", ur: "Kpahen ",
    blurb: "Get to know who I am, what I do, and how I do it." },
  { id: "expertise", en: "Expertise", fr: "Competences", ur: "Orianrien",
    blurb: "See the areas I specialise in and the skills behind the work." },
  { id: "works", en: "Works", fr: "Realisations", ur: "Owia",
    blurb: "Browse the projects I've built and open any to see how it came together." },
  { id: "activity", en: "Activity", fr: "Activites", ur: "Iruo",
    blurb: "Step into my Activity Center: play games, listen in, and chat with my AI." },
  { id: "footer", en: "Goodbye", fr: "Au-revoir", ur: "Tode",
    blurb: "Say goodbye, find where to reach me, and get in touch." },
]

// The side stack (after the hero) leaves out Goodbye: the footer has its own links.
const SIDE_NAV = NAV.filter((n) => n.id !== "footer")

// A section becomes "current" once its top passes this fraction of the viewport height.
const ACTIVE_RULES = [
  ["expertise", 0.5],
  ["works", 0.25],
  ["activity", 0.25],
  ["footer", 0.5],
]

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function useTypedCount(text, speed = 22) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    setCount(0)
    let i = 0
    const t = setInterval(() => {
      i += 1
      setCount(i)
      if (i >= text.length) clearInterval(t)
    }, speed)
    return () => clearInterval(t)
  }, [text, speed])
  return count
}

/* English -> French -> Urhobo -> English, scrolling like a slot reel. */
function SlotText({ item, spinning }) {
  const words = [item.en, item.fr, item.ur, item.en]
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "")
  return (
    <span className="nav-slot">
      <span className="nav-slot-sizer" aria-hidden="true">{longest}</span>
      <motion.span
        className="nav-slot-reel"
        initial={false}
        animate={
          spinning
            ? { y: ["0%", "-25%", "-50%", "-75%"] }
            : { y: "0%" }
        }
        transition={
          spinning
            ? { duration: SPIN, times: [0, 0.33, 0.66, 1], ease: "easeOut" }
            : { duration: 0 }
        }
      >
        {words.map((w, i) => (
          <span key={i} className="nav-slot-word" aria-hidden={i > 0}>{w}</span>
        ))}
      </motion.span>
    </span>
  )
}

function DropPanel({ item }) {
  const count = useTypedCount(item.blurb)
  const done = count >= item.blurb.length
  return (
    <motion.div
      className="nav-drop"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
    >
      <div className="nav-drop-top">
        <span>english - urhobo - french</span>
        <span className="nav-dots" aria-hidden="true">
          <i style={{ background: ORANGE }} />
          <i style={{ background: BLUE }} />
          <i style={{ background: BLACK }} />
        </span>
      </div>
      <p className="nav-drop-text">
        <span>{item.blurb.slice(0, count)}</span>
        {!done && <span className="nav-caret" />}
        {/* the untyped rest is invisible but reserves space, so the panel doesn't grow while typing */}
        <span style={{ visibility: "hidden" }}>{item.blurb.slice(count)}</span>
      </p>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Hero bar: transparent boxes, colour + language spin + drop panel    */
/* ------------------------------------------------------------------ */

function BarItem({ item, index, hovered, setHovered }) {
  const isHover = hovered === item.id
  return (
    <motion.li
      className="nav-bar-item"
      exit={{ opacity: 0, x: 32, transition: { duration: 0.3, delay: index * 0.04 } }}
      onMouseEnter={() => setHovered(item.id)}
    >
      <motion.a
        href={`#${item.id}`}
        className="nav-bar-link"
        onFocus={() => setHovered(item.id)}
        onBlur={() => setHovered(null)}
        initial={false}
        animate={{
          backgroundColor: isHover
            ? ["rgba(228,87,46,0)", ORANGE, BLUE, BLACK]
            : "rgba(31,30,36,0)",
        }}
        transition={
          isHover
            ? { duration: SPIN, times: [0, 0.2, 0.6, 1], ease: "easeInOut" }
            : { duration: 0.25 }
        }
      >
        <SlotText item={item} spinning={isHover} />
      </motion.a>
      <AnimatePresence>{isHover && <DropPanel item={item} />}</AnimatePresence>
    </motion.li>
  )
}

function BarList({ hovered, setHovered }) {
  return (
    <motion.ul className="nav-bar" onMouseLeave={() => setHovered(null)}>
      {NAV.map((item, i) => (
        <BarItem key={item.id} item={item} index={i} hovered={hovered} setHovered={setHovered} />
      ))}
    </motion.ul>
  )
}

/* ------------------------------------------------------------------ */
/* Vertical list: used by the side nav and the mobile menu             */
/* ------------------------------------------------------------------ */

function VerticalList({ items = NAV, pointer, hovered, setHovered, onNavigate, large }) {
  const listRef = useRef(null)
  const linkRefs = useRef({})
  const [y, setY] = useState(null)

  // Put the arrow level with the middle of the pointed-at link. Measured from the real link boxes
  // (not the <li>), and again whenever the list resizes or the web font finishes loading.
  const measure = useCallback(() => {
    const ul = listRef.current
    const a = pointer ? linkRefs.current[pointer] : null
    if (!ul || !a) { setY(null); return }
    const u = ul.getBoundingClientRect()
    const r = a.getBoundingClientRect()
    setY(r.top - u.top + r.height / 2)
  }, [pointer])

  useLayoutEffect(() => { measure() }, [measure, items])

  useEffect(() => {
    const ul = listRef.current
    if (!ul) return undefined
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null
    ro?.observe(ul)
    document.fonts?.ready?.then(measure)
    return () => ro?.disconnect()
  }, [measure])

  return (
    <ul
      ref={listRef}
      className={`nav-vlist${large ? " nav-vlist--lg" : ""}`}
      onMouseLeave={() => setHovered(null)}
    >
      {items.map((item, i) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 32 }}
          transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
          onMouseEnter={() => setHovered(item.id)}
        >
          <a
            ref={(el) => { linkRefs.current[item.id] = el }}
            href={`#${item.id}`}
            className={`nav-vlink${hovered && hovered !== item.id ? " is-dim" : ""}`}
            onClick={onNavigate}
            onFocus={() => setHovered(item.id)}
            onBlur={() => setHovered(null)}
          >
            {item.en}
          </a>
        </motion.li>
      ))}
      <motion.span
        className="nav-arrow"
        aria-hidden="true"
        initial={false}
        animate={{ y: (y ?? 0) - 9, opacity: y == null ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12H5" />
          <path d="M11 6l-6 6 6 6" />
        </svg>
      </motion.span>
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

export default function Header() {
  const [heroGone, setHeroGone] = useState(false)
  const [active, setActive] = useState("about")
  const [hovered, setHovered] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const mobileRef = useRef(null)

  // Which section is current, and has the hero fully left the screen?
  useEffect(() => {
    let raf = 0
    const compute = () => {
      raf = 0
      const vh = window.innerHeight
      const home = document.getElementById("home")
      setHeroGone(home ? home.getBoundingClientRect().bottom <= 0 : window.scrollY > vh)

      let current = "about"
      for (const [id, factor] of ACTIVE_RULES) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= vh * factor) current = id
      }
      setActive(current)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute) }
    compute()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  // At the footer the right-hand nav goes away (the footer has its own links).
  const stackVisible = heroGone && active !== "footer"

  // The bar and the stack swap places under the cursor; drop any stale hover.
  useEffect(() => { setHovered(null) }, [heroGone, stackVisible])

  // Mobile menu: close on outside tap or Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false) }
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const pointer = hovered ?? (heroGone ? active : null)

  return (
    <>
      {/* Logo: unchanged, scrolls away with the hero */}
      <div className="p-6 absolute top-0 left-0 w-full z-10 bg-transparent pointer-events-none">
        <h1 className="w-64 md:w-80">
          <svg
            viewBox="10 10 310 85"
            className="w-full h-auto overflow-visible"
            role="img"
            aria-label="Meet the Visionary"
          >
            <defs>
              <path id="header-arc" d="M 10 80 A 280 310 0 0 1 310 80" fill="none" />
            </defs>
            <text className="butcherman-regular" fill="#EDEDF2" fontSize="20" textAnchor="middle">
              <textPath href="#header-arc" startOffset="50%">MEET THE VISION</textPath>
            </text>
          </svg>
        </h1>
      </div>

      {/* Desktop: fixed top-right. Bar while the hero is on screen, vertical stack after. */}
      <nav className="hidden md:block fixed top-6 right-3 z-40" aria-label="Primary">
        <AnimatePresence mode="wait" initial={false}>
          {heroGone ? (
            stackVisible && (
              <VerticalList
                key="stack"
                items={SIDE_NAV}
                pointer={pointer}
                hovered={hovered}
                setHovered={setHovered}
              />
            )
          ) : (
            <BarList key="bar" hovered={hovered} setHovered={setHovered} />
          )}
        </AnimatePresence>
      </nav>

      {/* Mobile: two lines that become an X and open the vertical list */}
      <div ref={mobileRef} className="md:hidden fixed top-6 right-6 z-40">
        <button
          type="button"
          className="nav-burger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <motion.span animate={menuOpen ? { y: 4, rotate: 45 } : { y: 0, rotate: 0 }} transition={{ duration: 0.25 }} />
          <motion.span animate={menuOpen ? { y: -4, rotate: -45 } : { y: 0, rotate: 0 }} transition={{ duration: 0.25 }} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="nav-mobile-panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <VerticalList
                large
                pointer={pointer}
                hovered={hovered}
                setHovered={setHovered}
                onNavigate={() => setMenuOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}