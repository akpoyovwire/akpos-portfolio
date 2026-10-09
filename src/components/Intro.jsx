import React, { useEffect, useRef } from "react"
import { gsap } from "gsap"

/*
  Intro
  Full-screen opening sequence. Dark stage -> one line is written in cursive
  by a slanted "pen" sweeping left to right, white, settling in behind the
  pen with an engraved look. Two seconds after the last letter, everything
  blurs away and the screen fades out, revealing the hero underneath. Click
  anywhere to speed it up.

  Background is the details overlay's #17161b, fully opaque (0% transparent).
  There is deliberately no backdrop blur any more: at 100% opacity nothing
  behind it can show through, so the blur drew nothing - but the browser still
  re-blurred the playing hero video behind it on every frame, which is a big
  part of why the writing stuttered.

  Why the writing is smooth now
  Before, one SVG held the engraved text (blur + shadow filter), the rainbow
  text, and both moving clip-paths, and every frame the pen moved the browser
  re-ran the engraved filter over the whole line. Now the engraved white text
  lives in its OWN layer that is painted once and kept (a GPU layer); the pen
  only moves a CSS clip-path over it. Only the cheap, filter-free rainbow text
  is redrawn per frame.

  Needs the Parisienne font. Add this to index.html <head>:
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Parisienne&display=swap" rel="stylesheet">
*/

const LINE = "I am the man, I suffered, I was there."
const FONT = "'Parisienne', 'Snell Roundhand', 'Brush Script MT', cursive"
const FONT_SIZE = 65
const LINE_Y = 340 // baseline (viewBox units)
const VIEW_W = 1400
const VIEW_H = 640
const BAND_TOP = 90 // how far above the baseline the pen window reaches
const BAND_H = 150

// ---- tuning ----
const TRAIL = 120 // width of the rainbow zone behind the pen
const SLANT = -14 // lean of the pen edge, matches the cursive slant
const SECONDS_PER_CHAR = 0.085 // writing speed
const HOLD_AFTER = 0.5// seconds the finished text stays before vanishing

// violet (trailing edge) -> red (pen tip), so each letter goes red -> violet -> white
const RAINBOW = ["#8b5cff", "#3b82ff", "#22d3ee", "#34d399", "#facc15", "#fb923c", "#ff3b3b"]

const cy = LINE_Y - BAND_TOP + BAND_H / 2
const SKEW = `translate(0 ${cy}) skewX(${SLANT}) translate(0 ${-cy})`

export default function Intro({ onDone }) {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const whiteLayerRef = useRef(null)
  const whiteSvgRef = useRef(null)
  const rbSvgRef = useRef(null)
  const tlRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doneRef.current()
      return
    }

    let cancelled = false
    let ctx

    const build = () => {
      if (cancelled || !stageRef.current) return
      ctx = gsap.context(() => {
        const tl = gsap.timeline({ delay: 0.5, onComplete: () => doneRef.current() })
        tlRef.current = tl

        const whiteLayer = whiteLayerRef.current
        const textEl = whiteSvgRef.current.querySelector("#intro-text")
        const rbRect = rbSvgRef.current.querySelector("#intro-rb-rect")
        const grad = rbSvgRef.current.querySelector("#intro-rb-grad")

        const bb = textEl.getBBox()
        const minX = bb.x - 10
        const maxX = bb.x + bb.width + 10
        const travel = maxX - minX + TRAIL + 40

        // The white text's reveal edge: a slanted line, written as a CSS
        // clip-path in % of the stage, so it follows the same lean as the
        // rainbow's SVG clip (skewX(SLANT) around the band's centre).
        const k = Math.tan((SLANT * Math.PI) / 180)
        const y1 = LINE_Y - BAND_TOP
        const y2 = y1 + BAND_H
        const px = (x) => ((x / VIEW_W) * 100).toFixed(3) + "%"
        const py = (y) => ((y / VIEW_H) * 100).toFixed(3) + "%"
        const whiteClip = (right) => {
          const xTop = right + k * (y1 - cy)
          const xBot = right + k * (y2 - cy)
          return `polygon(-10% ${py(y1)}, ${px(xTop)} ${py(y1)}, ${px(xBot)} ${py(y2)}, -10% ${py(y2)})`
        }

        const place = (p) => {
          const pen = minX + travel * p
          whiteLayer.style.clipPath = whiteClip(pen - TRAIL)
          rbRect.setAttribute("x", pen - TRAIL)
          grad.setAttribute("x1", pen - TRAIL)
          grad.setAttribute("x2", pen)
        }
        place(0)

        const proxy = { p: 0 }
        tl.to(proxy, {
          p: 1,
          duration: LINE.length * SECONDS_PER_CHAR,
          ease: "none",
          onUpdate: () => place(proxy.p),
        })

        // the vanish: blur + fade the writing, then fade the whole stage
        tl.to(
          stageRef.current,
          { filter: "blur(18px)", opacity: 0, scale: 1.08, duration: 1.2, ease: "power2.in" },
          `+=${HOLD_AFTER}`
        ).to(rootRef.current, { opacity: 0, duration: 0.9, ease: "power1.out" }, "-=0.6")
      }, rootRef)
    }

    const fontsReady =
      document.fonts && document.fonts.load
        ? Promise.race([
            document.fonts.load(`${FONT_SIZE}px "Parisienne"`),
            new Promise((r) => setTimeout(r, 2500)),
          ])
        : Promise.resolve()
    fontsReady.catch(() => {}).then(build)

    return () => {
      cancelled = true
      if (ctx) ctx.revert()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      onClick={() => tlRef.current && tlRef.current.timeScale(6)}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      // fully opaque: 0% transparency
      style={{ backgroundColor: "#17161b" }}
    >
      <div
        ref={stageRef}
        role="img"
        aria-label={LINE}
        className="relative w-[min(92vw,1400px)] select-none"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      >
        {/* LAYER 1 - engraved white text. Painted once (own GPU layer); only
            its clip-path moves. Hidden until the pen starts. */}
        <div
          ref={whiteLayerRef}
          className="absolute inset-0"
          style={{ clipPath: "inset(0 100% 0 0)", willChange: "transform" }}
        >
          <svg ref={whiteSvgRef} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block w-full h-full" aria-hidden="true">
            <defs>
              {/* engraved look: dark shadow inside the top-left edges, thin light lip at the bottom-right */}
              <filter id="intro-engrave" x="-10%" y="-40%" width="120%" height="190%" colorInterpolationFilters="sRGB">
                <feComponentTransfer in="SourceAlpha" result="inverted">
                  <feFuncA type="table" tableValues="1 0" />
                </feComponentTransfer>
                <feGaussianBlur in="inverted" stdDeviation="1.6" result="invBlur" />
                <feOffset in="invBlur" dx="2" dy="3" result="invOff" />
                <feFlood floodColor="#0a0a0c" floodOpacity="0.25" result="dark" />
                <feComposite in="dark" in2="invOff" operator="in" result="shadowRaw" />
                <feComposite in="shadowRaw" in2="SourceAlpha" operator="in" result="innerShadow" />
                <feMerge result="engraved">
                  <feMergeNode in="SourceGraphic" />
                  <feMergeNode in="innerShadow" />
                </feMerge>
                <feDropShadow in="engraved" dx="0.8" dy="1.4" stdDeviation="0.4" floodColor="#ffffff" floodOpacity="0.3" />
              </filter>
            </defs>
            <text
              id="intro-text"
              x={VIEW_W / 2}
              y={LINE_Y}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize={FONT_SIZE}
              fill="#ffffff"
              filter="url(#intro-engrave)"
            >
              {LINE}
            </text>
          </svg>
        </div>

        {/* LAYER 2 - the rainbow zone at the pen. No filter, so redrawing it
            every frame is cheap. */}
        <svg
          ref={rbSvgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="intro-rb-grad" gradientUnits="userSpaceOnUse" x1="-9999" y1="0" x2="-9000" y2="0">
              {RAINBOW.map((c, k) => (
                <stop key={c} offset={k / (RAINBOW.length - 1)} stopColor={c} />
              ))}
            </linearGradient>
            <clipPath id="intro-clip-rb">
              <rect
                id="intro-rb-rect"
                x={-9999}
                y={LINE_Y - BAND_TOP}
                width={TRAIL}
                height={BAND_H}
                transform={SKEW}
              />
            </clipPath>
          </defs>
          <g clipPath="url(#intro-clip-rb)">
            <text
              x={VIEW_W / 2}
              y={LINE_Y}
              textAnchor="middle"
              fontFamily={FONT}
              fontSize={FONT_SIZE}
              fill="url(#intro-rb-grad)"
            >
              {LINE}
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}
