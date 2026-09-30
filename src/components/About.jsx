import React, { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(ScrollTrigger, SplitText)

/*
  About
  A single pinned section that holds its ground while four parts (Who I Am /
  What I Do / How I Think / What I Build) reveal one after another as the
  user scrolls. Headings enter with scaled/rotated words that settle into
  place, paragraphs reveal line by line, and the image crossfades alongside.
  Everything is scrubbed to scroll position (GSAP SplitText + ScrollTrigger).
*/

const PARTS = [
  {
    id: "who-i-am",
    label: "[ Who I Am ]",
    title: "Who I Am",
    image: "/whoami.jpg",
    body: "I am a technology-driven problem solver with a curiosity that extends beyond a single discipline. I develop, secure, research and explore technology to understand problems and turn ideas into meaningful solutions. My work sits at the intersection of software development, cybersecurity, artificial intelligence, research and entrepreneurship.",
  },
  {
    id: "what-i-do",
    label: "[ What I Do ]",
    title: "What I Do",
    image: "/whatido.jpg",
    body: "I build digital solutions, explore intelligent systems, investigate security challenges and work on ideas that have the potential to create practical value. Alongside technology, I write, present, teach and communicate ideas, because solving a problem is only part of the process; being able to explain the solution matters too.",
  },
  {
    id: "how-i-think",
    label: "[ How I Think ]",
    title: "How I Think",
    image: "/howithink.jpg",
    body: "I am driven by problems. I like understanding how things work, questioning how they can work better and finding ways to turn possibilities into something tangible. I approach challenges from different angles, combining technical knowledge, creativity, research and critical thinking rather than limiting myself to one way of solving a problem.",
  },
  {
    id: "what-i-build",
    label: "[ What I Build ]",
    title: "What I Build",
    image: "/whatibuild.jpg",
    body: "Everything I work on is part of a larger pursuit: creating technology that is useful, secure and capable of solving real problems. From software and cybersecurity to AI, research and entrepreneurial ideas, I am continually turning curiosity into projects, projects into experience and experience into solutions.",
  },
]

const HOLD = 1.4 // relative time each part sits fully settled and readable
const MOVE = 1 // relative time each transition between parts takes

export default function About() {
  const wrapperRef = useRef(null)
  const stageRef = useRef(null)
  const imageRefs = useRef([])
  const labelRef = useRef(null)
  const counterRef = useRef(null)
  const headingRefs = useRef([])
  const paraRefs = useRef([])
  const tickFillRefs = useRef([])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
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

      // paragraphs: hide every part except the first (this was missing,
      // which is why all the paragraphs were stacked on top of each other)
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
          end: "bottom bottom",
          scrub: 1,
          pin: stageRef.current,
        },
      })

      tl.to({}, { duration: HOLD }) // part 0 sits and reads

      PARTS.forEach((_, i) => {
        if (i === 0) return
        const label = `part-${i}`
        tl.addLabel(label)
          // outgoing image + paragraph
          .to(imageRefs.current[i - 1], { autoAlpha: 0, scale: 1.1, duration: MOVE }, label)
          .to(paraSplits[i - 1].lines, { autoAlpha: 0, y: -16, duration: MOVE * 0.6 }, label)
          // outgoing heading: words exit upward, clipped by the h3's overflow-hidden
          .to(
            headingSplits[i - 1].words,
            { yPercent: -120, rotate: -8, autoAlpha: 0, stagger: 0.04, duration: MOVE * 0.6, ease: "power2.in" },
            label
          )
          // label crossfade + counter/tick update
          .to(labelRef.current, { autoAlpha: 0, duration: MOVE * 0.3 }, label)
          .call(() => {
            labelRef.current.textContent = PARTS[i].label
            counterRef.current.textContent = `0${i + 1} / 0${PARTS.length}`
          }, null, `${label}+=${MOVE * 0.3}`)
          .to(labelRef.current, { autoAlpha: 1, duration: MOVE * 0.3 }, `${label}+=${MOVE * 0.3}`)
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
            `${label}+=${MOVE * 0.3}`
          )
          // incoming paragraph, line by line
          .to(
            paraSplits[i].lines,
            { autoAlpha: 1, y: 0, duration: MOVE * 0.8, stagger: 0.08 },
            `${label}+=${MOVE * 0.3}`
          )
          .to({}, { duration: HOLD }) // this part sits and reads
      })
    }, wrapperRef)

    return () => {
      ctx.revert()
    }
  }, [])

  return (
    <section
      id="about"
      ref={wrapperRef}
      className="relative z-10"
      style={{ height: `${PARTS.length * 130}vh` }}
    >
      <div ref={stageRef} className="h-screen w-full overflow-hidden flex items-center">
        {/* one grid only: wider image column, text column beside it */}
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-12 px-6 items-center">
          {/* IMAGE COLUMN */}
          <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl bg-[#2C2F34]">
            {PARTS.map((p, i) => (
              <div key={p.id} ref={(el) => (imageRefs.current[i] = el)} className="absolute inset-0">
                <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            ))}

            <div
              ref={counterRef}
              className="absolute bottom-4 left-4 text-xs tracking-[0.3em] text-white bebas-neue-regular"
            >
              01 / 0{PARTS.length}
            </div>
          </div>

          {/* TEXT COLUMN */}
          <div className="relative">
            <p
              ref={labelRef}
              className="text-xs tracking-[0.35em] uppercase text-[#E4572E] mb-4 bebas-neue-regular"
            >
              {PARTS[0].label}
            </p>

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

            <div className="relative min-h-[280px]">
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
