import React, { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useTransform } from "framer-motion"

/*
  FlipStack
  A tall "runway" holds one sticky, screen-sized stage. As you scroll through
  the runway, each page after the first swings up from the bottom edge and
  lands over the previous page. Scrolling up plays it in reverse.

  At most two pages are ever rendered at once: the page currently settled
  flat underneath (the "backdrop"), and the one page currently flipping in
  on top of it. Earlier fix attempts left every already-passed page shown
  and flat forever (its rotation math clamps to fully-open once you scroll
  past it, and nothing ever told it to hide again), so pages two or more
  steps behind the current one stayed visible and showed through the gaps
  around whatever was mid-flip. This version derives which page is the
  current backdrop directly from scroll position and only shows that one
  plus the one flipping in - everything else is display:none.

  Rotation tracks real scroll position directly, one-to-one, every frame -
  no artificial easing layer on top of it, since that doubles up with the
  browser's own scrolling and makes it feel delayed.

  Snap-on-idle: while actively scrolling, a page can sit at any partial
  angle, scrubbing live with your input. Once scrolling stops (~140ms of no
  scroll events) and you're not sitting exactly on a page boundary, this
  finishes the job for you: past the halfway mark of that page's own
  transition, it completes the flip forward; short of halfway, it retreats
  back to the page you were already on, fully clear. This works by moving
  the real scroll position with window.scrollTo - the browser's own smooth
  scroll then drives the rotation, so there's no second animation system to
  fight with it.

  pages = [{ id, content, onActiveChange? }]
*/

const PERSPECTIVE = 2400
const START_ANGLE = -90
const SNAP_IDLE_MS = 140
const SNAP_THRESHOLD = 0.05 // commit past this fraction of a transition, retreat under it

const clamp01 = (n) => Math.min(1, Math.max(0, n))
const smooth = (t) => t * t * (3 - 2 * t)

function FlipPage({ index, count, progress, background, mapBg, onActiveChange, children }) {
  const seg = 1 / (count - 1)
  const start = (index - 1) * seg
  const open = index * seg

  const [shown, setShown] = useState(index === 0)
  const state = useRef({ shown: index === 0, active: false })

  useEffect(() => {
    const update = (v) => {
      const s = state.current

      // which page is the current flat backdrop right now
      const activeIndex = Math.min(count - 1, Math.max(0, Math.floor(v / seg + 1e-9)))
      // only the backdrop page and the one flipping in on top of it are ever shown
      const nextShown = index === activeIndex || index === activeIndex + 1

      if (index > 0) {
        let nextActive = s.active
        if (!s.active && v > start + seg * 0.4) nextActive = true
        if (s.active && v < start + seg * 0.2) nextActive = false
        if (nextActive !== s.active) { s.active = nextActive; onActiveChange?.(nextActive) }
      }

      if (nextShown !== s.shown) { s.shown = nextShown; setShown(nextShown) }
    }
    update(progress.get())
    return progress.on("change", update)
  }, [progress, index, count, seg, start, onActiveChange])

  const rotateX = useTransform(progress, (v) =>
    index === 0 ? 0 : START_ANGLE * (1 - smooth(clamp01((v - start) / seg)))
  )

  const shade = useTransform(progress, (v) => {
    let s = 0
    if (index > 0) s += 0.55 * (1 - clamp01((v - start) / seg))
    if (index < count - 1) s += 0.6 * clamp01((v - open) / seg)
    return Math.min(s, 0.95)
  })

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        rotateX,
        originX: 0.5,
        originY: 1,
        zIndex: index,
        background: mapBg ? `url(${mapBg}) center/cover no-repeat, ${background}` : background,
        display: shown ? "block" : "none",
        willChange: "transform",
        backfaceVisibility: "hidden",
      }}
    >
      <div className="h-full overflow-y-auto scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="min-h-full w-full">{children}</div>
      </div>
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: shade }}
      />
    </motion.div>
  )
}

export default function FlipStack({ pages, background = "#1F1E24", mapBg }) {
  const runwayRef = useRef(null)
  const stageRef = useRef(null)
  const count = pages.length
  const progress = useMotionValue(0)

  useEffect(() => {
    let ticking = false
    const compute = () => {
      ticking = false
      const runway = runwayRef.current
      const stage = stageRef.current
      if (!runway || !stage) return
      const distance = stage.offsetHeight * (count - 1)
      progress.set(clamp01(-runway.getBoundingClientRect().top / distance))
    }
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(compute) }
    }
    compute()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [count, progress])

  // Snap-on-idle, in three zones: inside the flip stack (page to page),
  // and at the two edges where it meets plain-scrolling content - Hero
  // above and Footer below. Hero/Footer have no rotation to track, so
  // there "10% into the transition" means 10% of one screen height past
  // the boundary, which lines up with where the sticky stage naturally
  // engages/releases.
  useEffect(() => {
    let idleTimer
    const trySnap = () => {
      const runway = runwayRef.current
      const stage = stageRef.current
      if (!runway || !stage) return
      const seg = 1 / (count - 1)
      const distance = stage.offsetHeight * (count - 1)
      const runwayTop = window.scrollY + runway.getBoundingClientRect().top
      const runwayHeight = runway.offsetHeight
      const vh = window.innerHeight

      // zone 1: between two flip pages
      const v = clamp01(-runway.getBoundingClientRect().top / distance)
      if (v > 0.001 && v < 0.999) {
        const segIndex = Math.min(count - 2, Math.max(0, Math.floor(v / seg + 1e-6)))
        const local = (v - segIndex * seg) / seg
        if (local >= 0.02 && local <= 0.98) {
          const targetV = local > SNAP_THRESHOLD ? (segIndex + 1) * seg : segIndex * seg
          window.scrollTo({ top: runwayTop + targetV * distance, behavior: "smooth" })
          return
        }
      }

      // zone 2: Hero <-> first flip page (top of the runway)
      const heroLow = runwayTop - vh // Hero fills the screen
      const heroLocal = (window.scrollY - heroLow) / vh
      if (heroLocal > 0.02 && heroLocal < 0.98) {
        window.scrollTo({
          top: heroLocal > SNAP_THRESHOLD ? runwayTop : heroLow,
          behavior: "smooth",
        })
        return
      }

      // zone 3: last flip page <-> Footer (bottom of the runway)
      const projLow = runwayTop + runwayHeight - vh // last page fills the screen
      const projLocal = (window.scrollY - projLow) / vh
      if (projLocal > 0.02 && projLocal < 0.98) {
        window.scrollTo({
          top: projLocal > SNAP_THRESHOLD ? projLow + vh : projLow,
          behavior: "smooth",
        })
      }
    }
    const onScroll = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(trySnap, SNAP_IDLE_MS)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      clearTimeout(idleTimer)
    }
  }, [count])

  return (
    <div ref={runwayRef} className="relative" style={{ height: `${count * 100}vh` }}>
      {pages.map((page, i) => (
        <div
          key={page.id}
          id={page.id}
          aria-hidden="true"
          className="absolute left-0 w-px h-px pointer-events-none"
          style={{ top: `${i * 100}vh` }}
        />
      ))}

      <div
        ref={stageRef}
        className="sticky top-0 overflow-hidden"
        style={{ perspective: `${PERSPECTIVE}px`, height: "100dvh" }}
      >
        {pages.map((page, i) => (
          <FlipPage
            key={page.id}
            index={i}
            count={count}
            progress={progress}
            background={background}
            mapBg={mapBg}
            onActiveChange={page.onActiveChange}
          >
            {page.content}
          </FlipPage>
        ))}
      </div>
    </div>
  )
}
