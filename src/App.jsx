import React, { useState, useEffect, useRef } from "react"
import { Home, Folder, Database, Pencil, } from "lucide-react"
import { FaReact } from "react-icons/fa"
import { motion, useScroll, useTransform } from "framer-motion"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
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
import Intro from "./components/Intro"

gsap.registerPlugin(ScrollTrigger)

/*
  SectionStack / StackLayer
  Scroll-driven reveal transition between Tools -> Expertise -> Works: each
  section holds a full-screen spot and the next one slides up and covers
  it as the user scrolls, instead of the two simply stacking one after
  another. Driven directly by scroll position via Framer Motion's
  useScroll/useTransform (a MotionValue read from real scrollY), not
  whileInView and not a timed animation - so scrolling slowly plays the
  reveal progressively, and scrolling fast just lands on the result.

  About isn't in this stack. It needs real, tall document height so its own
  GSAP ScrollTrigger has scroll distance to pin against (see About.jsx) -
  a fixed 100vh transformed layer here can't provide that - so it lives
  just above this stack as its own block, and Tools (now index 0 of this
  stack) slides up to cover it exactly the same way Expertise covers Tools.

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

function StackLayer({ id, index, total, progress, style, children }) {
  const slot = 1 / total
  const transitionFraction = 1 - HOLD_FRACTION

  // Tools (index 0) has no previous layer to slide over inside this stack -
  // About lives outside it, in real document flow. Giving Tools a slide-up
  // entrance here carves out a window where About has already scrolled
  // away and Tools hasn't arrived yet: nothing on screen - that's the black
  // gap. So index 0 just sits static at y:0 the whole time; the hand-off
  // still works because this stack's sticky stage snaps into place the
  // instant About's own pin releases, with Tools already sitting there.
  const enterStart = index === 0 ? 0 : index * slot - transitionFraction * slot
  const enterEnd = index === 0 ? 1 : index * slot
  const y = useTransform(progress, [enterStart, enterEnd], index === 0 ? ["0%", "0%"] : ["100%", "0%"])

  // A subtle settle-back (scale + dim) on THIS layer, timed to the exact
  // window the NEXT layer spends sliding over it - a secondary depth cue,
  // not the transition mechanism itself (that's the y transform above).
  const isLast = index === total - 1
  const coverStart = isLast ? 0 : (index + 1) * slot - transitionFraction * slot
  const coverEnd = isLast ? 1 : (index + 1) * slot
  const coverRange = isLast ? [0, 1] : [coverStart, coverEnd]
  const scale = useTransform(progress, coverRange, isLast ? [1, 1] : [1, 0.94])
  // Dim the covered layer with an overlay's opacity instead of a CSS
  // brightness() filter. A filter on a full-screen layer is re-rendered on
  // every scroll frame and is a common cause of choppy scrolling; an opacity
  // change is nearly free.
  const dim = useTransform(progress, coverRange, isLast ? [0, 0] : [0, 0.45])

  return (
    <motion.div
      className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden"
      style={{ ...style, zIndex: index, y, scale, willChange: "transform" }}
    >
      {/*
        A plain, un-animated wrapper around the actual content, purely so
        the arrival-settle effect in App's onAnchorClick has something safe
        to target. The motion.div above has its own y/scale/opacity fully
        owned by Framer Motion every frame via useTransform - having GSAP
        ALSO write transform/opacity directly to that same node would fight
        it. This inner div is never touched by Framer Motion, so GSAP can
        animate it freely without any conflict.
      */}
      <div data-section={id} className="w-full h-full flex items-center justify-center">
        {children}
      </div>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: dim }}
      />
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
  // Use the raw scroll progress directly. Lenis already smooths the scroll,
  // so a spring on top just added a third layer of lag.
  const progress = scrollYProgress

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
          <StackLayer key={s.id} id={s.id} index={i} total={total} progress={progress} style={s.style}>
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
const [worksInView, setworksInView] = useState(false)
const [expertiseInView, setExpertiseInView] = useState(false)
const [toolsInView, setToolsInView] = useState(false)
const [introDone, setIntroDone] = useState(false)
const lenisRef = useRef(null)

const pageBg = "linear-gradient(135deg, #1F1E24, #23241E)"

// Shared full-bleed backdrop for every content section (previously painted
// by FlipStack's FlipPage wrapper - now just a plain style object applied
// to each section's own wrapper div).
const sectionBgStyle = {
  background: `url(/section-map-bg.svg) center/cover no-repeat, ${pageBg}`,
}

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

  // Always start at the top so the intro sits over the hero, not mid-page
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual"
    window.scrollTo(0, 0)
  }, [])

  // Intro finished: unlock scrolling and re-measure the pinned About section
  useEffect(() => {
    if (introDone && lenisRef.current) {
      lenisRef.current.start()
      ScrollTrigger.refresh()
    }
  }, [introDone])

  /*
    NEW: re-measure again once EVERYTHING has actually finished loading.
    The refresh above (tied to introDone) fires as soon as the intro's text
    animation completes - which has nothing to do with whether the hero
    video, the About images, or any webfont have actually finished loading
    yet. ScrollTrigger's pin/scroll-distance math is built from whatever
    the DOM measures as at the moment it's calculated; if that happens
    before a late-loading asset shifts the layout, the math is stale until
    something forces a recompute. `window.load` fires only once every
    resource on the page (images, video metadata, stylesheets) has
    finished, so this is the actual "everything has settled" signal -
    distinct from, and in addition to, the introDone refresh above.
  */
  useEffect(() => {
    const onLoad = () => ScrollTrigger.refresh()
    if (document.readyState === "complete") {
      // already fully loaded by the time this effect ran
      ScrollTrigger.refresh()
    } else {
      window.addEventListener("load", onLoad)
    }
    return () => window.removeEventListener("load", onLoad)
  }, [])

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
      lerp: 0.12,          // 0-1: lower = floatier, higher = snappier
      wheelMultiplier: 1.2, // each trackpad/wheel movement travels further
      touchMultiplier: 1.5,
      smoothWheel: true,
    })
    lenisRef.current = lenis
    lenis.stop() // locked while the intro plays; released when it finishes

    // Feed Lenis's smoothed scroll straight into ScrollTrigger, and drive
    // Lenis off GSAP's own ticker instead of a separate requestAnimationFrame
    // loop. This is the standard, officially-recommended Lenis+GSAP pairing
    // (confirmed against Lenis's own docs) - without it, About's
    // ScrollTrigger reads native scroll position directly, which lags a
    // frame or two behind what Lenis is actually showing on screen.
    // `lagSmoothing(0)` here is also the documented recommendation for this
    // exact pairing, not a stray setting - leave it as-is.
    lenis.on("scroll", ScrollTrigger.update)
    const onTick = (time) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    // NAV-LINK ARRIVAL SETTLE
    // `immediate: true` below has to stay a hard, instant jump - About's
    // GSAP pin and the SectionStack's scroll-linked transforms both read
    // real scroll position every frame, and giving Lenis an eased scroll
    // duration here would animate THROUGH their scroll ranges and trigger
    // their own transitions on the way past (confirmed unsafe - a short
    // duration was already tried). So the jump itself can't get a
    // transition. This fakes the missing motion instead: right after the
    // instant jump, a quick opacity dip-and-recover plays on the actual
    // destination content.
    //
    // This ONLY fires here, inside the click handler below - ordinary
    // wheel/touch scrolling through the site never touches this code path
    // at all, so it can't interfere with that.
    //
    // Opacity only - deliberately no scale/translate. About's section pins
    // an inner child with GSAP (the pinned element briefly becomes
    // position:fixed); a transform on an ANCESTOR of that pinned child
    // would change its containing block and visibly glitch the pin for a
    // frame. Opacity never does that, so one effect is safe for every
    // destination, About included.
    //
    // For "tools"/"expertise"/"works", the element with that id is a 1x1px
    // invisible scroll-position marker (see SectionStack above) - fading
    // that would be invisible. `[data-section="id"]` (added in StackLayer)
    // is the actual visible content instead. "home"/"about"/"footer" have
    // no such marker - their id already sits on the real, visible element,
    // so the querySelector falls through to `target` for those.
    const onAnchorClick = (e) => {
      const link = e.target.closest('a[href^="#"]')
      if (!link) return
      const id = link.getAttribute("href").slice(1)
      const target = document.getElementById(id)
      if (!target) return
      e.preventDefault()
      lenis.scrollTo(target, { immediate: true })

      const settleTarget = document.querySelector(`[data-section="${id}"]`) || target
      gsap.fromTo(
        settleTarget,
        { opacity: 0.35 },
        { opacity: 1, duration: 0.4, ease: "power2.out", overwrite: "auto" }
      )
    }
    document.addEventListener("click", onAnchorClick)

    return () => {
      gsap.ticker.remove(onTick)
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
{!introDone && <Intro onDone={() => setIntroDone(true)} />}
<Ripple />
<WaterTrail />
<CustomCursor />

<main className="min-h-screen voltaire-regular text-[#EDEDF2] relative" style={{ background: pageBg }}>
<Header 
backdropVariants={backdropVariants}
isOpen={isOpen}
sidebarVariants={sidebarVariants}
toggleMenu={toggleMenu}
tapEffect={tapEffect}
setIsOpen={setIsOpen}
/>

<Hero />

{/* About pins itself and reveals its own four parts as you scroll through
    it (see About.jsx) - it needs real document height for that, so it's
    a normal block here, not one of the stacked layers below. */}
<About />

{/* Scroll-driven reveal: Tools -> Expertise -> Works, each one sliding up
    and covering the previous as the user scrolls. Tools sliding up to
    cover About (above) uses the same mechanism, just anchored to the
    start of this stack's own scroll range - see the StackLayer comment. */}
<SectionStack
  sections={[
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
