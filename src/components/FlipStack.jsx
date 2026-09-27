import React, { useEffect, useRef, useState } from "react"
import { motion, useMotionValue, useTransform } from "framer-motion"

/*
  FlipStack
  A tall "runway" holds one sticky, screen-sized stage. As you scroll through
  the runway, each page after the first swings up from the bottom edge and
  lands over the previous page. Scrolling up plays it in reverse.

  At most two pages are ever rendered at once: the page currently settled
  flat underneath (the "backdrop"), and the one page currently flipping in
  on top of it. Pages two or more steps behind the current one are
  display:none.

  --- Gesture-driven stepping (this revision) ---
  Previously, rotation tracked raw scroll position 1:1, every frame, with no
  easing of its own - which meant the flip was exactly as choppy as whatever
  the input device produced. There was also no notion of "one scroll
  movement = one page"; it was continuous scrubbing everywhere, including at
  the Hero<->page0 and lastPage<->Footer boundaries.

  This version adds a wheel/touch layer on `window` that takes over
  navigation through the whole stack - Hero, every flip page, and Footer are
  all just "stops" in one ordered list. For each gesture it asks: can the
  content currently on screen still scroll internally in this direction? If
  so, the event is left alone and the browser scrolls that content natively
  (so a page taller than the viewport scrolls through its own content
  before the stack advances). If not, the event is intercepted and its
  delta is accumulated; once the accumulation crosses a threshold, one step
  is committed and animated with a cubic ease. A hard or sustained gesture
  keeps enough left in the accumulator that, the moment one step's
  animation finishes, the next one fires immediately - so a big scroll
  chains through several pages the way a normal scroll would, while a light
  one just nudges forward or back by one.

  The old idle-snap system (scroll-linked, fires ~140ms after scrolling
  stops) is kept as a fallback for input that bypasses wheel/touch entirely
  - keyboard paging, scrollbar dragging, assistive tech - so those never
  get stranded mid-transition.

  pages = [{ id, content, onActiveChange? }]
*/

const PERSPECTIVE = 2400
const START_ANGLE = -90
const SNAP_IDLE_MS = 140
const SNAP_THRESHOLD = 0.05 // commit past this fraction of a transition, retreat under it

// gesture-stepping tuning
const STEP_PX = 90 // accumulated delta (px) needed to commit one step
const MAX_DELTA_PER_EVENT = 220 // cap one event's contribution (~2.4 steps), further chaining needs more events
const GESTURE_IDLE_MS = 220 // reset the accumulator if no wheel/touch input for this long
const STEP_DURATION_MS = 560

const clamp01 = (n) => Math.min(1, Math.max(0, n))
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const smooth = (t) => t * t * (3 - 2 * t)
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

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
      <div
        // gesture layer probes this node (by data-flip-page) to decide whether
        // the page's own content still has room to scroll before it steps away
        data-flip-page={index}
        className="h-full overflow-y-auto scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
      >
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

  // One shared eased-scroll animator, used by both the gesture stepper and
  // the idle-snap fallback below. Replaces window.scrollTo({behavior:
  // "smooth"}) - the browser's own "smooth" scroll is close to
  // constant-speed in most engines, which reads as rigid rather than a real
  // ease. This ramps up and back down (cubic ease-in-out) over a fixed
  // duration instead, and reports back whether it's currently running so
  // callers (the gesture stepper) can chain the next step once it's done.
  const animRaf = useRef(null)
  const animating = useRef(false)
  const animateScrollTo = (targetY, duration = STEP_DURATION_MS, onDone) => {
    if (animRaf.current) cancelAnimationFrame(animRaf.current)
    animating.current = true
    const startY = window.scrollY
    const delta = targetY - startY
    const startTime = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration)
      window.scrollTo(0, startY + delta * easeInOutCubic(t))
      if (t < 1) {
        animRaf.current = requestAnimationFrame(step)
      } else {
        animRaf.current = null
        animating.current = false
        onDone?.()
      }
    }
    animRaf.current = requestAnimationFrame(step)
  }

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

  // --- Gesture stepping: wheel + touch take over navigation ---
  // Stops, in order: Hero settled, page0 settled, page1 settled, ...,
  // last-page settled, Footer settled. Hero and Footer are assumed to be
  // exactly one viewport tall "slides" flanking the runway (matching the
  // zone-2/3 assumption the idle-snap fallback below already makes) - they
  // aren't rendered by this component, but their boundary positions fall
  // straight out of the runway's own layout.
  const getStops = () => {
    const runway = runwayRef.current
    const stage = stageRef.current
    if (!runway || !stage) return null
    const vh = window.innerHeight
    const runwayRect = runway.getBoundingClientRect()
    const runwayTop = window.scrollY + runwayRect.top
    const runwayHeight = runway.offsetHeight
    const distance = stage.offsetHeight * (count - 1)
    const seg = count > 1 ? 1 / (count - 1) : 0
    const stops = [runwayTop - vh] // Hero settled
    for (let i = 0; i < count; i++) stops.push(runwayTop + i * seg * distance) // each page settled
    stops.push(runwayTop + runwayHeight) // Footer settled
    return stops
  }

  const nearestStopIndex = (stops, y) => {
    let best = 0
    let bestD = Infinity
    stops.forEach((s, i) => {
      const d = Math.abs(s - y)
      if (d < bestD) { bestD = d; best = i }
    })
    return best
  }

  useEffect(() => {
    let stopsCache = null
    // the scrollable inner container of each flip page, looked up from the
    // DOM once and reused - these nodes are stable for the component's
    // lifetime, so a live querySelector on every wheel/touch tick (which can
    // fire at 60-120Hz during a gesture) was pure overhead
    let elsCache = null
    let accum = 0
    let idleTimer = null
    // touch tracking
    let touchY = null

    const invalidate = () => { stopsCache = null; elsCache = null }
    window.addEventListener("resize", invalidate)

    const stops = () => {
      if (!stopsCache) stopsCache = getStops()
      return stopsCache
    }

    const pageEls = () => {
      if (!elsCache) {
        const stage = stageRef.current
        elsCache = stage
          ? Array.from({ length: count }, (_, i) => stage.querySelector(`[data-flip-page="${i}"]`))
          : []
      }
      return elsCache
    }

    const resetAccum = () => { accum = 0 }
    const armIdleReset = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(resetAccum, GESTURE_IDLE_MS)
    }

    // is the page currently on screen able to keep scrolling internally,
    // in the direction of this gesture (dir > 0 == scrolling forward/down)?
    const canScrollInner = (curStopIndex, dir) => {
      const pageIndex = curStopIndex - 1 // stops[0] is Hero, stops[1..count] are pages 0..count-1
      if (pageIndex < 0 || pageIndex >= count) return false
      const el = pageEls()[pageIndex]
      if (!el) return false
      if (dir > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1
      return el.scrollTop > 1
    }

    const doStep = (dir) => {
      const s = stops()
      if (!s) return
      const cur = nearestStopIndex(s, window.scrollY)
      const next = clamp(cur + dir, 0, s.length - 1)
      accum -= dir * STEP_PX // consume one step's worth, keep the remainder for chaining
      if (next === cur) { accum = 0; return }
      animateScrollTo(s[next], STEP_DURATION_MS, () => {
        // if there's enough left over from a hard/sustained gesture, chain
        // straight into the next step rather than waiting for more input
        if (Math.abs(accum) >= STEP_PX) doStep(accum > 0 ? 1 : -1)
      })
    }

    const handleDelta = (rawDelta, e) => {
      const s = stops()
      if (!s) return
      const y = window.scrollY
      // outside the managed band entirely (deep in Hero above, or deep in
      // Footer's own content below) - leave scrolling native
      if (y < s[0] - 1 || y > s[s.length - 1] + 1) { resetAccum(); return }

      const dir = rawDelta > 0 ? 1 : -1
      const cur = nearestStopIndex(s, y)

      if (!animating.current && canScrollInner(cur, dir)) {
        // content on screen still has room - let the browser scroll it natively
        resetAccum()
        return
      }

      e.preventDefault()
      accum += clamp(rawDelta, -MAX_DELTA_PER_EVENT, MAX_DELTA_PER_EVENT)
      armIdleReset()

      if (!animating.current && Math.abs(accum) >= STEP_PX) {
        doStep(dir)
      }
    }

    const onWheel = (e) => {
      if (e.ctrlKey) return // pinch-zoom - never hijack
      handleDelta(e.deltaY, e)
    }

    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      if (touchY == null) return
      const y = e.touches[0].clientY
      const delta = touchY - y // finger moving up == scrolling down
      touchY = y
      if (Math.abs(delta) < 0.5) return
      handleDelta(delta, e)
    }
    const onTouchEnd = () => { touchY = null }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: false })
    window.addEventListener("touchend", onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener("resize", invalidate)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
      clearTimeout(idleTimer)
    }
  }, [count])

  // --- Idle-snap fallback ---
  // Covers input that bypasses the gesture layer above (keyboard paging,
  // scrollbar dragging, assistive tech): if you land mid-transition and
  // stop, this finishes the job for you. Direction-aware: the commit
  // decision is based on which way you were actually moving when you
  // stopped, not just where you landed - scrolling up into the previous
  // page's segment starts near that segment's *top* edge (local close to
  // 1) and only approaches 0 the further up you go, so a direction-blind
  // check would misread that as "still near the forward edge."
  const dirRef = useRef(1) // 1 = last moved down, -1 = last moved up
  const lastYRef = useRef(0)

  useEffect(() => {
    lastYRef.current = window.scrollY
    const onDir = () => {
      const y = window.scrollY
      if (y !== lastYRef.current) dirRef.current = y > lastYRef.current ? 1 : -1
      lastYRef.current = y
    }
    window.addEventListener("scroll", onDir, { passive: true })
    return () => window.removeEventListener("scroll", onDir)
  }, [])

  useEffect(() => {
    let idleTimer

    // local: 0 at the "backward" edge, 1 at the "forward" edge.
    // Commits forward once you've moved SNAP_THRESHOLD past whichever edge
    // you approached from, based on dirRef; otherwise commits backward.
    const pickForward = (local) =>
      dirRef.current >= 0 ? local > SNAP_THRESHOLD : local >= 1 - SNAP_THRESHOLD

    const trySnap = () => {
      if (animating.current) return // gesture layer already mid-step, leave it alone
      const runway = runwayRef.current
      const stage = stageRef.current
      if (!runway || !stage) return
      const seg = 1 / (count - 1)
      const distance = stage.offsetHeight * (count - 1)
      const runwayRect = runway.getBoundingClientRect()
      const runwayTop = window.scrollY + runwayRect.top
      const runwayHeight = runway.offsetHeight
      const vh = window.innerHeight

      // zone 1: between two flip pages
      const v = clamp01(-runwayRect.top / distance)
      if (v > 0.001 && v < 0.999) {
        const segIndex = Math.min(count - 2, Math.max(0, Math.floor(v / seg + 1e-6)))
        const local = (v - segIndex * seg) / seg
        if (local >= 0.02 && local <= 0.98) {
          const targetV = pickForward(local) ? (segIndex + 1) * seg : segIndex * seg
          animateScrollTo(runwayTop + targetV * distance)
          return
        }
      }

      // zone 2: Hero <-> first flip page (top of the runway)
      const heroLow = runwayTop - vh // Hero fills the screen
      const heroLocal = (window.scrollY - heroLow) / vh
      if (heroLocal > 0.02 && heroLocal < 0.98) {
        animateScrollTo(pickForward(heroLocal) ? runwayTop : heroLow)
        return
      }

      // zone 3: last flip page <-> Footer (bottom of the runway)
      const projLow = runwayTop + runwayHeight - vh // last page fills the screen
      const projLocal = (window.scrollY - projLow) / vh
      if (projLocal > 0.02 && projLocal < 0.98) {
        animateScrollTo(pickForward(projLocal) ? projLow + vh : projLow)
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
