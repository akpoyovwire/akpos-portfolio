import React, { useState, useEffect, useRef } from "react"
import { Home, Folder, Database, Pencil, } from "lucide-react"
import { FaReact } from "react-icons/fa"
import { motion, useScroll, useTransform, useSpring } from "framer-motion"
import Lenis from "lenis"
import "lenis/dist/lenis.css"
import Ripple from "./components/Ripple"
import Footer from "./components/Footer"
import Works from "./components/Works"
import Expertise from "./components/Expertise"
import Tools from "./components/Tools"
import About from "./components/About"
import Hero from "./components/Hero"
import Header from "./components/Header"
import ScrollArrow from "./components/ScrollArrow"
import WaterTrail from "./components/WaterTrail"
import CustomCursor from "./components/CustomCursor"

/*
  SectionStack / StackLayer
  Scroll-driven reveal transition between About -> Tools -> Expertise ->
  Works: each section holds a full-screen spot and the next one slides up
  and covers it as the user scrolls, instead of the two simply stacking one
  after another. This is driven directly by scroll position via Framer
  Motion's useScroll/useTransform (a MotionValue read from real scrollY),
  not whileInView and not a timed animation - so scrolling slowly plays the
  reveal progressively, and scrolling fast just lands on the result.

  Layout: one tall wrapper (N sections * 100vh of scroll distance) holds a
  position:sticky, full-viewport "stage." Every section lives inside that
  stage as an absolutely-positioned layer, stacked in DOM/z-index order.
  Each layer's position is a transform, not a layout change, so all N
  sections stay mounted the whole time - which is also why each section's
  own onViewportEnter/typing effects keep working unmodified:
  IntersectionObserver still reports a layer as off-screen while it sits
  translated below the viewport, and in-view once it slides to rest.

  Small invisible markers sit at the real (never-transformed) scroll offset
  for each id, so the existing #anchor nav links, Lenis's anchor-click
  smoothing, and the scroll-arrow's getElementById("expertise") check all
  keep working exactly as before - nothing else in the app needs to change.
*/
const HOLD_FRACTION = 0.6 // portion of each section's slot spent fully settled before the next one starts covering it

function StackLayer({ index, total, progress, style, children }) {
  const slot = 1 / total
  const transitionFraction = 1 - HOLD_FRACTION

  // This layer's own entrance: slides up from below (100% -> 0%) during the
  // tail end of the PREVIOUS layer's slot, so the two visibly overlap.
  const enterStart = index === 0 ? 0 : index * slot - transitionFraction * slot
  const enterEnd = index === 0 ? 1 : index * slot
  const y = useTransform(
    progress,
    index === 0 ? [0, 1] : [enterStart, enterEnd],
    index === 0 ? [0, 0] : ["100%", "0%"]
  )

  // A subtle settle-back (scale + dim) on THIS layer, timed to the exact
  // window the NEXT layer spends sliding over it - a secondary depth cue,
  // not the transition mechanism itself (that's the y transform above).
  const isLast = index === total - 1
  const coverStart = isLast ? 0 : (index + 1) * slot - transitionFraction * slot
  const coverEnd = isLast ? 1 : (index + 1) * slot
  const scale = useTransform(progress, isLast ? [0, 1] : [coverStart, coverEnd], isLast ? [1, 1] : [1, 0.94])
  const brightness = useTransform(progress, isLast ? [0, 1] : [coverStart, coverEnd], isLast ? [1, 1] : [1, 0.55])
  const filter = useTransform(brightness, (b) => `brightness(${b})`)

  return (
    <motion.div
      className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden"
      style={{ ...style, zIndex: index, y, scale, filter }}
    >
      {children}
    </motion.div>
  )
}

function SectionStack({ sections }) {
  const containerRef = useRef(null)
  const total = sections.length
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  })
  // Springing the raw scroll progress takes the edge off fast flicks/trackpad
  // jitter without decoupling the effect from scroll itself - it still only
  // moves because scrollYProgress moved.
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })

  return (
    <div ref={containerRef} className="relative" style={{ height: `${total * 100}vh` }}>
      {sections.map((s, i) => (
        <div
          key={`${s.id}-anchor`}
          id={s.id}
          aria-hidden="true"
          className="absolute left-0 top-0 w-px h-px"
          style={{ top: `${(i * 100) / total}%` }}
        />
      ))}

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {sections.map((s, i) => (
          <StackLayer key={s.id} index={i} total={total} progress={progress} style={s.style}>
            {s.node}
          </StackLayer>
        ))}
      </div>
    </div>
  )
}

export default function App() {
const [isOpen, setIsOpen] = useState(false)
const [scrollTarget, setScrollTarget] = useState("#footer")
const [toolDescription, setToolDescription] = useState(null);
const [time, setTime] = useState("")
const [aboutInView, setAboutInView] = useState(false)
const [worksInView, setworksInView] = useState(false)
const [expertiseInView, setExpertiseInView] = useState(false)
const [toolsInView, setToolsInView] = useState(false)

const pageBg = "linear-gradient(135deg, #1F1E24, #23241E)"

// Shared full-bleed backdrop for every content section (previously painted
// by FlipStack's FlipPage wrapper - now just a plain style object applied
// to each section's own wrapper div).
const sectionBgStyle = {
  background: `url(/section-map-bg.svg) center/cover no-repeat, ${pageBg}`,
}

// ABOUT
const typedAboutHeading = useTypingEffect("About Me", 80, aboutInView)
const typedAboutContent = useTypingEffect(
  "I build secure, modern web apps with React, Supabase, OWASP best practices, Wireshark & Burp Suite.",
  6,
  aboutInView
)

// WORKS
const typedworksHeading = useTypingEffect("works", 80, worksInView)

// EXPERTISE
const typedExpertiseHeading = useTypingEffect("Expertise", 80, expertiseInView)

// TOOLS
const typedToolsHeading = useTypingEffect("Tools & Stack", 80, toolsInView)

useEffect(() => {
  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    setTime(`${hours}:${minutes}:${seconds}`);
  };

updateClock();
  const interval = setInterval(updateClock, 1000);

  return () => clearInterval(interval);
}, []);

  const toggleMenu = () => setIsOpen(!isOpen);

  /*
    SMOOTH SCROLL - Lenis
    This replaces FlipStack's whole gesture/step/idle-snap system. There is
    no dead-zone threshold to cross, no forced-duration animation that owns
    the scrollbar, no idle timer waiting to decide anything. Lenis just
    lerps the real scroll position toward wherever the wheel/touch input is
    pointing, every single frame - so the page always tracks the user's
    input immediately, and "smoothness" comes from that per-frame easing
    instead of from a queued transition the user has to wait out.

    It also intercepts #anchor clicks (Header nav, Footer nav, ScrollArrow)
    so those get the same smoothing instead of an instant native jump.
  */
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,           // 0-1: lower = smoother/more trailing, higher = snappier
      smoothWheel: true,
      touchMultiplier: 1.5,
    })

    let rafId
    const raf = (time) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    const onAnchorClick = (e) => {
      const link = e.target.closest('a[href^="#"]')
      if (!link) return
      const id = link.getAttribute("href").slice(1)
      const target = document.getElementById(id)
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target, { duration: 1.2 })
    }
    document.addEventListener("click", onAnchorClick)

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener("click", onAnchorClick)
      lenis.destroy()
    }
  }, [])

 useEffect(() => {
  let ticking = false
  const computeScrollTarget = () => {
    ticking = false
    const expertiseSection = document.getElementById("expertise");
    const expertisePosition = expertiseSection
  ? expertiseSection.getBoundingClientRect().top + window.scrollY
  : 0;
    const scrollY = window.scrollY || window.pageYOffset;

    // If we haven't scrolled PAST expertise, arrow goes down to #contact
    if (scrollY + window.innerHeight / 2 < expertisePosition) {
      setScrollTarget("#footer");
    } else {
      // If we are PAST expertise, arrow goes back to top (#home)
      setScrollTarget("#home");
    }
  };
  const handleScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(computeScrollTarget) }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => window.removeEventListener("scroll", handleScroll);
}, []);

function useTypingEffect(text, speed = 50, active = true) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      return;
    }

    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, active]);

  return displayed;
}

  const sectionFade = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.12 },
    },
  };

  const tapEffect = { scale: 0.95, rotate: -2 };

  const sidebarVariants = {
    hidden: { x: "-100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 70 } },
    exit: { x: "-100%", opacity: 0, transition: { duration: 0.3 } },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 0.4, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3 } },
  };


  const expertiseList = [
    { icon: <FaReact />, label: "Frontend Development", desc: "Modern, responsive interfaces with React and friends." },
    { icon: <Database />, label: "Backend Integration", desc: "Connecting frontend to secure backend services like Supabase." },
    { icon: <Pencil />, label: "Design Customization", desc: "Unique, user-focused designs directed to the last detail." },
    { icon: <Folder />, label: "Project Planning", desc: "Research-driven project setup, clear user flows & structure." },
    { icon: <Home />, label: "SEO & Visibility", desc: "Making your site discoverable and visible to the world." },
  ];


return (
<>
<Ripple />
<WaterTrail />
<CustomCursor />

<main className="min-h-screen voltaire-regular text-[#EDEDF2] scroll-smooth relative" style={{ background: pageBg }}>
<Header 
backdropVariants={backdropVariants}
isOpen={isOpen}
sidebarVariants={sidebarVariants}
toggleMenu={toggleMenu}
tapEffect={tapEffect}
setIsOpen={setIsOpen}
/>

<Hero />

{/* Scroll-driven reveal: About -> Tools -> Expertise -> Works, each one
    sliding up and covering the previous as the user scrolls. */}
<SectionStack
  sections={[
    {
      id: "about",
      style: sectionBgStyle,
      node: (
        <About
          typedAboutContent={typedAboutContent}
          typedAboutHeading={typedAboutHeading}
          setAboutInView={setAboutInView}
          sectionFade={sectionFade}
        />
      ),
    },
    {
      id: "tools",
      style: sectionBgStyle,
      node: (
        <Tools
          setToolDescription={setToolDescription}
          toolDescription={toolDescription}
          typedToolsHeading={typedToolsHeading}
          setToolsInView={setToolsInView}
          sectionFade={sectionFade}
        />
      ),
    },
    {
      id: "expertise",
      style: sectionBgStyle,
      node: (
        <Expertise
          expertiseList={expertiseList}
          sectionFade={sectionFade}
          typedExpertiseHeading={typedExpertiseHeading}
          setExpertiseInView={setExpertiseInView}
        />
      ),
    },
    {
      id: "works",
      style: sectionBgStyle,
      node: (
        <Works
          sectionFade={sectionFade}
          typedworksHeading={typedworksHeading}
          setworksInView={setworksInView}
        />
      ),
    },
  ]}
/>

<Footer time={time} />
</main>

<ScrollArrow scrollTarget={scrollTarget}/>
</>
);}
