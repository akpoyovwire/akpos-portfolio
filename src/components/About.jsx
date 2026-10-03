import React, { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(ScrollTrigger, SplitText)

/*
  About
  One pinned section. Four parts (Who I Am / What I Do / How I Think /
  What I Build) reveal one after another, and ONLY as the user scrolls.
  Nothing here plays on its own: the timeline is scrubbed by scroll position.

  HOLD and MOVE are not seconds. They are relative lengths on the timeline,
  and the whole timeline is stretched over the section's scroll distance:
    HOLD = how much scrolling a part stays settled and readable
    MOVE = how much scrolling the change between two parts takes
  Smaller HOLD = less scrolling needed to get through the section.

  SNAP
  `scrub: true` alone means the timeline sits at EXACTLY wherever scroll is,
  with zero catch-up: stop scrolling mid-transition and it just freezes
  there, requiring you to manually scroll every remaining pixel to finish
  it. The `snap` block below fixes that - once scrolling stops, it glides
  the rest of the way to the nearest "settled" point on its own.

  It deliberately does NOT snap to the existing `part-1`/`part-2`/`part-3`
  labels. Those mark where a transition STARTS, not where it ends - snapping
  to them can pull you backward to the beginning of a reveal instead of
  forward to its finish. Instead, a `settled-i` label is added right where
  each part's hold already begins (the exact same instant the trailing
  `.to({}, {duration: HOLD})` below already started at - this is additive,
  it does not shift any existing tween's timing by even a frame), and snap
  targets those instead.

  WHY SETUP WAITS FOR FONTS
  SplitText measures and splits this text against whatever font is ACTIVE
  at the moment it runs. If a custom webfont (Bebas Neue, etc.) is still
  loading when that happens, the split is built on the fallback font's
  metrics - then the instant the real font swaps in, every word/line span's
  size changes and the browser has to re-lay-out the whole section. That
  reflow landing mid-scroll is exactly what makes a first pass through this
  section feel stiff compared to every pass after (by then the font's
  cached, so there's nothing left to swap). Waiting for
  `document.fonts.ready` before building anything means the split - and the
  pin/scroll-distance math built on top of it - is correct from the first
  frame, not just after the first scroll happens to force a re-measure.
*/

const PARTS = [
  {
    id: "who-i-am",
    title: "Who I Am",
    image: "/whoami.jpg",
    body: "I am a technology-driven problem solver with a curiosity that extends beyond a single discipline. I develop, secure, research and explore technology to understand problems and turn ideas into meaningful solutions. My work sits at the intersection of software development, cybersecurity, artificial intelligence, research and entrepreneurship. P.S. I am currently Learning Artificial Intelligence and Machine Learning from Mr James Ebuka, a renowned AI/ML expert and mentor.",
  },
  {
    id: "what-i-do",
    title: "What I Do",
    image: "/whatido.jpg",
    body: "I fix problems. I build solutions. I make the world a better place through technology, by exploring intelligent systems, investigating security challenges and working on ideas that have the potential to create practical value. Alongside technology, I write, present, teach and communicate ideas, because solving a problem is only part of the process; being able to explain the solution matters too.",
  },
  {
    id: "how-i-think",
    title: "How I Think",
    image: "/howithink.jpg",
    body: "I am driven by problems. I like understanding how things work, questioning how they can work better and finding ways to turn possibilities into something tangible. I approach challenges from different angles, combining technical knowledge, creativity, research and critical thinking rather than limiting myself to one way of solving a problem.",
  },
  {
    id: "what-i-build",
    title: "What I Build",
    image: "/whatibuild.jpg",
    body: "Everything I work on is part of a larger pursuit: creating technology that is useful, secure and capable of solving real problems. From software and cybersecurity to AI, research and entrepreneurial ideas, I am continually turning curiosity into projects, projects into experience and experience into solutions.",
  },
]

// Hero -> About "settle". See the ScrollTrigger just above the tl below.
// Set to false to go back to the old behaviour (nothing settles before the pin).
const SETTLE_ON_APPROACH = true

const HOLD = 0.6 // scroll spent resting on a part
const MOVE = 1 // scroll spent changing from one part to the next

export default function About() {
  const wrapperRef = useRef(null)
  const stageRef = useRef(null)
  const imageRefs = useRef([])
  const counterRefs = useRef([])
  const headingRefs = useRef([])
  const paraRefs = useRef([])
  const tickFillRefs = useRef([])

  useLayoutEffect(() => {
    let ctx
    let cancelled = false

    const setup = () => {
      if (cancelled) return

      ctx = gsap.context(() => {
        const headingSplits = headingRefs.current.map(
          (el) => new SplitText(el, { type: "words" })
        )
        const paraSplits = paraRefs.current.map(
          (el) => new SplitText(el, { type: "lines" })
        )

        // --- initial state: only part 0 visible and settled ---
        imageRefs.current.forEach((el, i) =>
          gsap.set(el, { autoAlpha: i === 0 ? 1 : 0, scale: i === 0 ? 1 : 1.08 })
        )

        counterRefs.current.forEach((el, i) =>
          gsap.set(el, { autoAlpha: i === 0 ? 1 : 0 })
        )

        headingSplits.forEach((split, i) => {
          gsap.set(split.words, {
            yPercent: 120,
            rotate: 8,
            scale: 1.4,
            autoAlpha: 0,
            transformOrigin: "left bottom",
          })
          if (i === 0)
            gsap.set(split.words, { yPercent: 0, rotate: 0, scale: 1, autoAlpha: 1 })
        })

        paraSplits.forEach((split, i) => {
          gsap.set(split.lines, { autoAlpha: 0, y: 24 })
          if (i === 0) gsap.set(split.lines, { autoAlpha: 1, y: 0 })
        })

        tickFillRefs.current.forEach((el, i) =>
          gsap.set(el, { scaleX: i === 0 ? 1 : 0 })
        )

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: "top top",
            // A fixed px/vh scroll distance, not "bottom bottom" of a
            // manually height-set wrapper. GSAP's pin builds its own spacer
            // sized to this duration; if the wrapper ALSO carries a hardcoded
            // height (as it did before), the two numbers aren't guaranteed to
            // match, and whichever is taller wins as empty, contentless space
            // - which is exactly the gap between About and Tools. Deriving
            // "end" from the pin's own duration and nothing else removes that
            // second, conflicting source of height entirely.
            end: () => `+=${(PARTS.length - 1) * window.innerHeight}`,
            scrub: true,
            pin: stageRef.current,
            invalidateOnRefresh: true, // recompute "end" correctly on resize/refresh
            // Once the user stops scrolling, glide to the nearest "settled"
            // point instead of freezing wherever they happened to stop.
            // `snapTo` is a function (not a static array) because it has to
            // read `tl.labels`/`tl.duration()` AFTER the timeline below is
            // fully built - at the moment this ScrollTrigger is constructed,
            // `tl` is still empty (0 duration). By the time GSAP actually
            // calls this function (only once the user stops scrolling), the
            // closure sees the finished timeline.
            snap: {
              snapTo: (progress) => {
                const dur = tl.duration()
                if (!dur) return progress
                const times = Array.from({ length: PARTS.length }, (_, i) => tl.labels[`settled-${i}`]).filter(
                  (t) => t !== undefined
                )
                if (!times.length) return progress
                const target = progress * dur
                const nearest = times.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
                return nearest / dur
              },
              duration: { min: 0.2, max: 0.6 },
              ease: "power1.inOut",
            },
          },
        })

        // HERO -> ABOUT SETTLE
        // The snap inside the timeline's ScrollTrigger above only works once
        // the pin has STARTED (About's top at the top of the screen). Before
        // that, while About is still sliding up into view, nothing snaps - so
        // if scrolling stops there (easy on a phone, where a flick just ends
        // wherever momentum runs out) a strip of the hero stays on screen
        // above About. This second trigger covers exactly that stretch, from
        // "About's top enters the screen" to "About's top reaches the top
        // (= where the pin starts)". It snaps to one end or the other, in the
        // direction you were scrolling: down finishes onto About, up goes back
        // to the hero. It makes no tweens and touches nothing in the timeline.
        if (SETTLE_ON_APPROACH) {
          ScrollTrigger.create({
            trigger: wrapperRef.current,
            start: "top bottom",
            end: "top top",
            snap: {
              snapTo: [0, 1],
              duration: { min: 0.2, max: 0.6 },
              ease: "power1.inOut",
            },
            invalidateOnRefresh: true,
          })
        }

        tl.addLabel("settled-0").to({}, { duration: HOLD }) // part 0 sits and reads

        PARTS.forEach((_, i) => {
          if (i === 0) return
          const label = `part-${i}`
          const mid = `${label}+=${MOVE * 0.3}`

          tl.addLabel(label)
            // outgoing image + paragraph + heading
            .to(imageRefs.current[i - 1], { autoAlpha: 0, scale: 1.1, duration: MOVE }, label)
            .to(paraSplits[i - 1].lines, { autoAlpha: 0, y: -16, duration: MOVE * 0.6 }, label)
            .to(
              headingSplits[i - 1].words,
              { yPercent: -120, rotate: -8, autoAlpha: 0, stagger: 0.04, duration: MOVE * 0.6, ease: "power2.in" },
              label
            )
            // counter: crossfade between stacked "0X / 04" labels.
            // (Tweens reverse correctly when scrolling back up. The old
            // .call() that rewrote the text did not, which is what left
            // "02 / 04" showing on the first image.)
            .to(counterRefs.current[i - 1], { autoAlpha: 0, duration: MOVE * 0.3 }, label)
            .to(counterRefs.current[i], { autoAlpha: 1, duration: MOVE * 0.3 }, mid)
            // progress rail
            .to(tickFillRefs.current[i], { scaleX: 1, duration: MOVE }, label)
            // incoming image
            .fromTo(
              imageRefs.current[i],
              { autoAlpha: 0, scale: 1.08 },
              { autoAlpha: 1, scale: 1, duration: MOVE },
              label
            )
            // incoming heading, starts after the outgoing one has cleared
            .to(
              headingSplits[i].words,
              { yPercent: 0, rotate: 0, scale: 1, autoAlpha: 1, stagger: 0.06, duration: MOVE, ease: "power3.out" },
              mid
            )
            // incoming paragraph, line by line
            .to(
              paraSplits[i].lines,
              { autoAlpha: 1, y: 0, duration: MOVE * 0.8, stagger: 0.08 },
              mid
            )
            // marks "this part has arrived, HOLD starts now" for the snap
            // config above. Placed with no position argument, same as the
            // HOLD tween right after it - so it lands at the exact same
            // instant that tween already started at. Purely a named marker;
            // nothing about playback changes.
            .addLabel(`settled-${i}`)
            .to({}, { duration: HOLD }) // this part sits and reads
        })
      }, wrapperRef)
    }

    // Wait for webfonts before building anything - see the file header for
    // why. Falls back to running immediately if the Font Loading API isn't
    // available (old Safari/older WebViews).
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setup)
    } else {
      setup()
    }

    return () => {
      cancelled = true
      if (ctx) ctx.revert()
    }
  }, [])

  return (
    <section
      id="about"
      ref={wrapperRef}
      className="relative z-10"
    >
      <div ref={stageRef} className="h-screen w-full overflow-hidden flex items-center">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-12 px-6 items-center">
          {/* IMAGE COLUMN */}
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl bg-[#2C2F34]">
            {PARTS.map((p, i) => (
              <div key={p.id} ref={(el) => (imageRefs.current[i] = el)} className="absolute inset-0">
                <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            ))}

            <div className="absolute bottom-4 left-4 h-4 w-28 text-xs tracking-[0.3em] text-white bebas-neue-regular">
              {PARTS.map((p, i) => (
                <span
                  key={p.id}
                  ref={(el) => (counterRefs.current[i] = el)}
                  className="absolute left-0 top-0 whitespace-nowrap"
                >
                  {`0${i + 1} / 0${PARTS.length}`}
                </span>
              ))}
            </div>
          </div>

          {/* TEXT COLUMN */}
          <div className="relative">
            {/* progress rail: one tick per part, fills in as you reach it */}
            <div className="flex gap-2 mb-6">
              {PARTS.map((p, i) => (
                <span key={p.id} className="h-[3px] w-8 rounded-full bg-white/20 overflow-hidden">
                  <span
                    ref={(el) => (tickFillRefs.current[i] = el)}
                    className="block h-full w-full bg-[#E4572E] origin-left"
                  />
                </span>
              ))}
            </div>

            <div className="relative min-h-[320px]">
              {PARTS.map((p, i) => (
                <div key={p.id} className="absolute inset-0 flex flex-col justify-center">
                  <h3
                    ref={(el) => (headingRefs.current[i] = el)}
                    className="text-3xl md:text-5xl bebas-neue-regular text-zinc-100 mb-5 overflow-hidden"
                  >
                    {p.title}
                  </h3>
                  <p
                    ref={(el) => (paraRefs.current[i] = el)}
                    className="text-zinc-200 leading-relaxed max-w-md"
                  >
                    {p.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
