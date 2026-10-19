import React, { useEffect, useRef } from "react"
import { gsap } from "gsap"

/*
  Intro
  Full-screen opening sequence. Dark stage -> one line is written in cursive
  by a slanted "pen" sweeping left to right, white, settling in behind the
  pen with an engraved look. Two seconds after the last letter, everything
  blurs away and the screen fades out, revealing the hero underneath. Click
  anywhere to speed it up.

  NEW: the logo "a" is SIGNED above the line, in white, at the same moment the
  line is being written (same start, same finish). When the line is done it
  holds for a beat, then the logo is UNSIGNED - erased stroke by stroke in the
  same order it was drawn, like the alejandroha.com intro - while the writing
  blurs away.

  How the signature works
  The logo is one continuous pen stroke (right tip -> down-left diagonal ->
  round the left loop -> over the top -> down through the crossing -> tail),
  so it is a single SVG <path> with fill none. It is drawn with
  stroke-dasharray / stroke-dashoffset: the dash is as long as the path, and
  the offset slides from "all hidden" to "all shown" (sign) and then on to
  "all hidden again from the start" (unsign). No filter, no mask, no extra
  layer to repaint - just a thin stroke, so it adds almost nothing to the
  per-frame cost. It sits OUTSIDE the stage that blurs away, so the unsign
  stays crisp while the writing dissolves. It lives in the same timeline as
  the writing, so the click-to-speed-up still speeds up both together.

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
const SECONDS_PER_CHAR = 0.07 // writing speed
const HOLD_AFTER = 0.4// seconds the finished text stays before vanishing
const SIGN_SECONDS = 1.4       // new — signature speed, no longer tied to the text

// ---- signature (logo) tuning ----
const SIG_COLOR = "#ffffff" // same white as the written line
const SIG_HEIGHT = 180 // logo height in viewBox units (width follows the logo's proportions)
const SIG_TOP = 70 // distance from the top of the stage; the line starts around y=285
const SIG_STROKE = 10 // pen thickness, in the logo's own 512x402 units (~5.4 on screen)
const SIG_UNSIGN_SECONDS = 1 // how long the erase takes

// The logo's centre-line as one stroke, traced from logo.png (512 x 402).
const SIG_W = 512
const SIG_H = 402
const SIG_PATH =
  "M477.0 82.0C474.9 83.5 468.3 88.0 464.2 90.8C460.1 93.7 456.4 96.3 452.5 99.0C448.6 101.7 444.7 104.4 440.8 107.1C436.9 109.8 433.0 112.5 429.1 115.3C425.2 118.0 421.3 120.7 417.4 123.4C413.5 126.1 409.6 128.8 405.7 131.5C401.8 134.3 398.1 137.2 394.2 139.9C390.3 142.6 386.2 145.1 382.3 147.8C378.4 150.5 374.6 153.3 370.7 156.0C366.8 158.7 362.8 161.3 358.9 164.1C355.0 166.8 351.2 169.7 347.3 172.3C343.3 174.8 338.9 176.8 335.0 179.4C331.1 182.0 327.4 184.8 323.8 187.8C320.2 190.8 317.1 194.7 313.3 197.5C309.5 200.2 305.1 202.0 301.1 204.6C297.1 207.1 293.3 210.0 289.4 212.8C285.5 215.5 281.7 218.2 277.8 220.9C273.9 223.6 269.9 226.3 266.0 229.0C262.1 231.7 258.3 234.5 254.4 237.2C250.5 239.9 246.5 242.6 242.6 245.3C238.7 248.0 234.8 250.8 231.0 253.5C227.1 256.2 223.2 258.9 219.3 261.6C215.3 264.3 211.4 267.0 207.5 269.7C203.6 272.4 199.8 275.2 195.9 277.9C191.9 280.6 188.0 283.3 184.1 285.9C180.2 288.6 176.2 291.2 172.3 293.9C168.4 296.6 164.5 299.4 160.6 302.1C156.7 304.7 152.7 307.3 148.7 310.0C144.8 312.6 140.9 315.3 137.0 318.0C133.1 320.7 129.2 323.4 125.2 326.1C121.3 328.7 117.2 331.2 113.2 333.8C109.2 336.3 105.2 338.8 101.1 341.3C97.1 343.7 93.0 346.2 88.9 348.5C84.7 350.8 80.4 352.9 76.2 355.1C72.0 357.3 68.0 359.8 63.6 361.7C59.3 363.6 54.8 365.5 50.2 366.5C45.6 367.5 40.3 368.9 36.1 367.8C31.9 366.7 27.2 363.7 25.1 360.1C22.9 356.5 23.3 350.8 23.0 346.1C22.7 341.4 22.8 336.6 23.2 331.9C23.7 327.2 24.8 322.5 25.8 317.9C26.8 313.2 28.1 308.7 29.3 304.1C30.6 299.5 31.8 294.9 33.3 290.4C34.8 285.9 36.5 281.5 38.2 277.0C39.9 272.6 41.7 268.2 43.5 263.8C45.4 259.5 47.4 255.1 49.3 250.8C51.3 246.5 53.2 242.1 55.4 237.9C57.5 233.7 60.0 229.6 62.2 225.4C64.5 221.2 66.6 217.0 69.0 212.9C71.3 208.7 73.9 204.7 76.4 200.7C78.9 196.7 81.5 192.7 84.1 188.7C86.7 184.8 89.4 180.8 92.1 177.0C94.9 173.1 97.7 169.2 100.5 165.5C103.4 161.7 106.3 157.9 109.3 154.2C112.2 150.5 115.2 146.8 118.2 143.1C121.3 139.5 124.3 135.8 127.4 132.2C130.6 128.7 133.9 125.3 137.2 121.8C140.4 118.4 143.5 114.8 146.9 111.4C150.2 108.0 153.8 104.9 157.3 101.7C160.7 98.4 164.0 95.0 167.6 91.8C171.1 88.6 174.8 85.7 178.5 82.6C182.1 79.6 185.7 76.5 189.5 73.5C193.2 70.6 197.0 67.8 200.9 65.0C204.7 62.2 208.6 59.5 212.6 56.9C216.5 54.2 220.5 51.6 224.5 49.1C228.6 46.6 232.6 44.2 236.8 41.9C240.9 39.6 245.2 37.4 249.5 35.4C253.8 33.4 258.1 31.4 262.5 29.8C267.0 28.1 271.5 26.6 276.1 25.5C280.7 24.4 285.4 23.3 290.1 23.0C294.8 22.7 299.8 22.4 304.3 23.5C308.8 24.6 313.7 26.5 317.1 29.5C320.5 32.4 323.0 37.0 324.9 41.2C326.7 45.5 327.3 50.4 328.1 55.0C329.0 59.7 329.7 64.4 330.0 69.1C330.3 73.8 330.2 78.6 330.0 83.4C329.8 88.1 329.3 92.8 329.0 97.6C328.7 102.3 328.3 107.0 327.9 111.8C327.5 116.5 326.9 121.2 326.5 125.9C326.0 130.7 325.4 135.4 325.0 140.1C324.6 144.9 324.3 149.6 324.0 154.3C323.7 159.1 323.2 163.8 323.0 168.5C322.8 173.3 322.9 178.0 322.7 182.8C322.6 187.5 322.4 192.3 322.3 197.0C322.1 201.8 321.9 206.5 322.0 211.3C322.1 216.0 322.7 220.8 323.0 225.5C323.3 230.2 323.5 235.0 324.0 239.7C324.6 244.4 325.2 249.1 326.1 253.8C326.9 258.4 328.0 263.1 329.0 267.7C330.1 272.3 331.1 277.0 332.4 281.5C333.7 286.1 335.1 290.7 336.7 295.1C338.3 299.6 340.1 304.0 342.0 308.3C343.9 312.7 346.0 317.0 348.1 321.2C350.3 325.4 352.5 329.6 355.0 333.7C357.5 337.7 360.1 341.7 363.1 345.4C366.1 349.1 369.4 352.5 372.8 355.8C376.2 359.1 379.6 362.5 383.4 365.3C387.3 368.1 391.4 370.5 395.7 372.4C400.0 374.4 404.6 376.0 409.3 376.8C413.9 377.6 418.7 377.8 423.4 377.5C428.1 377.2 433.0 376.6 437.4 375.2C441.9 373.8 446.3 371.6 450.3 369.1C454.3 366.7 457.9 363.5 461.5 360.3C465.0 357.2 468.5 353.9 471.6 350.3C474.7 346.8 477.4 343.1 480.3 339.0C483.2 335.0 487.6 328.2 489.0 326.0"
const SIG_SCALE = SIG_HEIGHT / SIG_H
const SIG_X = VIEW_W / 2 - (SIG_W * SIG_SCALE) / 2
const SIG_TRANSFORM = `translate(${SIG_X.toFixed(2)} ${SIG_TOP}) scale(${SIG_SCALE.toFixed(4)})`

// violet (trailing edge) -> red (pen tip), so each letter goes red -> violet -> white
const RAINBOW = ["#8b5cff", "#3b82ff", "#22d3ee", "#34d399", "#facc15", "#fb923c", "#ff3b3b"]

const cy = LINE_Y - BAND_TOP + BAND_H / 2
const SKEW = `translate(0 ${cy}) skewX(${SLANT}) translate(0 ${-cy})`

export default function Intro({ onDone, onVanish }) {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const whiteLayerRef = useRef(null)
  const whiteSvgRef = useRef(null)
  const rbSvgRef = useRef(null)
  const sigPathRef = useRef(null)
  const tlRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const vanishRef = useRef(onVanish)
  vanishRef.current = onVanish
  const animsRef = useRef([]) // compositor (WAAPI) animations for the vanish

  const speedUp = () => {
    if (tlRef.current) tlRef.current.timeScale(6)
    animsRef.current.forEach((a) => a.updatePlaybackRate(6))
  }

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
        // While the intro plays, a long frame (page finishing loading, GC,
        // video decode) must NOT make the animation jump ahead to "catch up".
        // With lagSmoothing(100, 16), any gap over 100ms is treated as one
        // normal 16ms frame, so a hitch is absorbed instead of skipped.
        // App.jsx sets lagSmoothing(0) for Lenis, so it is restored when done.
        gsap.ticker.lagSmoothing(100, 16)
        const tl = gsap.timeline({
          delay: 0.1,
          onComplete: () => {
            gsap.ticker.lagSmoothing(0)
          },
        })
        tlRef.current = tl

        const whiteLayer = whiteLayerRef.current
        const textEl = whiteSvgRef.current.querySelector("#intro-text")
        const rbRect = rbSvgRef.current.querySelector("#intro-rb-rect")
        const grad = rbSvgRef.current.querySelector("#intro-rb-grad")
        const sig = sigPathRef.current

        const bb = textEl.getBBox()
        const minX = bb.x - 10
        const maxX = bb.x + bb.width + 10
        const travel = maxX - minX + TRAIL

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

        // Signature starts fully hidden (dash = whole path, pushed out of view).
        // Measured here so it is exact at any screen size.
        const sigLen = sig.getTotalLength()
        gsap.set(sig, {
          attr: { "stroke-dasharray": `${sigLen} ${sigLen}` },
          strokeDashoffset: sigLen,
          opacity: 1,
        })

        const writeDur = LINE.length * SECONDS_PER_CHAR
        const proxy = { p: 0 }
        tl.to(proxy, {
          p: 1,
          duration: writeDur,
          ease: "power1.out",
          onUpdate: () => place(proxy.p),
        })

        // SIGN: same start and same finish as the writing, so the logo is
        // being signed at the very moment the line is being written. A soft
        // in/out ease makes it feel like a hand, not a ruler.
        tl.to(
          sig,
          { strokeDashoffset: 0, duration: SIGN_SECONDS, ease: "power1.out" },
          0
        )

        // the vanish starts HOLD_AFTER seconds after the last letter
        tl.addLabel("vanish", writeDur + HOLD_AFTER)

        // UNSIGN: the dash slides on past the end, so the stroke is erased
        // from its starting tip onward - in the order it was drawn.
        tl.to(
          sig,
          { strokeDashoffset: -sigLen, duration: SIG_UNSIGN_SECONDS, ease: "power2.inOut" },
          "vanish"
        )
        // a round cap leaves a tiny dot at the very end; remove it
        tl.set(sig, { opacity: 0 }, `vanish+=${SIG_UNSIGN_SECONDS}`)

        // THE VANISH runs on the browser's compositor (Web Animations API),
        // not on the main thread: blur + opacity + scale are compositor
        // properties, so even if the page behind boots up and blocks the main
        // thread right now, this fade keeps playing at full frame rate.
        const startVanish = () => {
          const stage = stageRef.current
          const root = rootRef.current
          if (!stage || !root) return
          stage.style.willChange = "transform, opacity, filter"
          const a1 = stage.animate(
            [
              { filter: "blur(0px)", opacity: 1, transform: "scale(1)" },
              { filter: "blur(18px)", opacity: 0, transform: "scale(1.08)" },
            ],
            { duration: 1200, easing: "cubic-bezier(0.55, 0.085, 0.68, 0.53)", fill: "forwards" }
          )
          const a2 = root.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 900,
            delay: 600,
            easing: "ease-out",
            fill: "forwards",
          })
          a2.onfinish = () => doneRef.current()
          animsRef.current = [a1, a2]
        }
        tl.call(startVanish, null, "vanish")

        // The rest of the site (hero, About, video, cursor effects...) is
        // mounted only once the signature has finished erasing, so none of
        // its start-up work can stutter the writing or the signing.
        tl.call(() => vanishRef.current && vanishRef.current(), null, `vanish+=${SIG_UNSIGN_SECONDS}`)
      }, rootRef)
    }

    const fontsReady =
      document.fonts && document.fonts.load
        ? Promise.race([
            document.fonts.load(`${FONT_SIZE}px "Parisienne"`),
            new Promise((r) => setTimeout(r, 2500)),
          ])
        : Promise.resolve()

    // Start only once the page has SETTLED. The browser finishes loading the
    // hero video, ~20 images and webfonts right as the page loads, and that
    // is a heavy burst of main-thread work. If the pen is already moving
    // when it lands, you see a freeze halfway through. Waiting for it
    // means the burst happens on the calm dark screen instead. Capped at
    // 3s so a slow connection never leaves the screen empty for long.
    let onLoad
    let capTimer
    const pageSettled = new Promise((resolve) => {
      const finish = () => requestAnimationFrame(() => requestAnimationFrame(resolve))
      if (document.readyState === "complete") {
        finish()
      } else {
        onLoad = finish
        window.addEventListener("load", onLoad, { once: true })
        capTimer = setTimeout(finish, 3000)
      }
    })

    Promise.all([fontsReady.catch(() => {}), pageSettled]).then(build)

    return () => {
      cancelled = true
      if (onLoad) window.removeEventListener("load", onLoad)
      clearTimeout(capTimer)
      gsap.ticker.lagSmoothing(0)
      animsRef.current.forEach((a) => a.cancel())
      if (ctx) ctx.revert()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      onClick={speedUp}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      // fully opaque: 0% transparency
      style={{ backgroundColor: "#18171b" }}
    >
      {/* Frame: fixes the size. The stage (writing) and the signature are
          siblings inside it, so the writing's blur-away never touches the
          signature - it erases itself crisply. */}
      <div
        role="img"
        aria-label={LINE}
        className="relative w-[min(92vw,1400px)] select-none"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      >
        <div ref={stageRef} className="absolute inset-0">
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
                
              >
                {LINE}
              </text>
            </svg>
          </div>

          {/* LAYER 2 - the rainbow zone at the pen. No filter, so redrawing it
              every frame is cheap. */}
         <svg
  ref={rbSvgRef}
  style={{ willChange: "transform" }}
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

        {/* LAYER 3 - the signature. One white stroke, no filter. Drawn and
            erased with stroke-dashoffset. Hidden (opacity 0) until the
            timeline has measured and primed it, so there is no first-frame flash. */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ willChange: "transform" }}
          aria-hidden="true"
        >
          <g transform={SIG_TRANSFORM}>
            <path
              ref={sigPathRef}
              d={SIG_PATH}
              fill="none"
              stroke={SIG_COLOR}
              strokeWidth={SIG_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0 }}
            />
          </g>
        </svg>
      </div>
    </div>
  )
}
