import React, { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
import CustomScrollbar from "./CustomScrollbar"

/*
  CustomCursor
  Desktop/trackpad (pointer: fine): the brown hand eases toward the real
  mouse every frame (see FOLLOW). It has three looks:
    normal  - the tilted hand
    pointer - the upright pointing hand, over links/buttons
    grab    - the OPEN hand (five fingers spread), over the custom scrollbar
              and while dragging it. It is only a different picture: the hand
              keeps following the mouse freely the whole time, never frozen.

  Frame loop: the easing runs on GSAP's shared ticker (the same one Lenis is
  driven from in App.jsx) instead of its own requestAnimationFrame loop, so
  scroll and cursor are updated in the same frame, in order. It is only on the
  ticker while the hand is actually catching up to the mouse, and removed once
  settled (same idle-stop as before).

  Touch (pointer: coarse): there is no mouse to follow, so instead the
  cursor jumps straight to wherever the finger taps - "period", no lerp,
  no lingering at a stale position. It stays hidden until the first tap, then
  appears exactly there and follows every subsequent tap.

  <CustomScrollbar /> is rendered from here so App.jsx doesn't need to change.
*/

const FOLLOW = 0.2
const HOTSPOT_NORMAL = { x: 8, y: 4 } // fingertip on the tilted hand
const HOTSPOT_HOVER = { x: 12.5, y: 1.5 } // fingertip on the upright hand
const HOTSPOT_GRAB = { x: 15, y: 16 } // middle of the palm on the open hand
const SIZE = 30

const SRC = {
  normal: "/hand.svg",
  pointer: "/hand-pointer.svg",
  grab: "/hand-open.svg",
}
const HOTSPOT = { normal: HOTSPOT_NORMAL, pointer: HOTSPOT_HOVER, grab: HOTSPOT_GRAB }

export default function CustomCursor() {
  const imgRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = imgRef.current
    const isCoarse = window.matchMedia("(pointer: coarse)").matches

    if (isCoarse) {
      // Touch: moves to each tap/drag point with a short CSS transition -
      // smooth motion, but fast enough (120ms) that it never reads as a
      // delay the way the desktop easing (FOLLOW) deliberately does.
      el.style.transition = "transform 0.12s ease-out"
      const place = (x, y) => {
        setVisible(true)
        el.style.transform = `translate(${x - HOTSPOT_NORMAL.x}px, ${y - HOTSPOT_NORMAL.y}px)`
      }
      const onTouchStart = (e) => {
        const t = e.touches[0]
        if (t) place(t.clientX, t.clientY)
      }
      const onTouchMove = (e) => {
        const t = e.touches[0]
        if (t) place(t.clientX, t.clientY)
      }
      document.addEventListener("touchstart", onTouchStart, { passive: true })
      document.addEventListener("touchmove", onTouchMove, { passive: true })
      return () => {
        document.removeEventListener("touchstart", onTouchStart)
        document.removeEventListener("touchmove", onTouchMove)
      }
    }

    // Desktop/trackpad: ease toward the real mouse every frame
    el.style.transition = "none"
    let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    let pos = { ...target }
    let mode = "normal" // "normal" | "pointer" | "grab"
    let lastTarget = null
    let running = false

    // load the other two hands up front so the first swap never flashes
    ;[SRC.pointer, SRC.grab].forEach((s) => {
      const img = new Image()
      img.src = s
    })

    const isInteractive = (node) =>
      node?.closest?.("a, button, [role='button'], .cursor-pointer")

    const modeFor = (node) => {
      // dragging the scrollbar keeps the open hand even if the mouse leaves it
      if (document.documentElement.hasAttribute("data-grabbing")) return "grab"
      if (node?.closest?.("[data-grab-cursor]")) return "grab"
      if (isInteractive(node)) return "pointer"
      return "normal"
    }

    const tick = () => {
      const hotspot = HOTSPOT[mode]
      pos.x += (target.x - pos.x) * FOLLOW
      pos.y += (target.y - pos.y) * FOLLOW
      el.style.transform = `translate(${pos.x - hotspot.x}px, ${pos.y - hotspot.y}px)`

      // once fully caught up there's nothing left to animate - leave the
      // shared ticker rather than writing the same transform forever
      if (Math.hypot(target.x - pos.x, target.y - pos.y) < 0.1) {
        running = false
        gsap.ticker.remove(tick)
      }
    }

    const kick = () => {
      if (!running) {
        running = true
        gsap.ticker.add(tick)
      }
    }

    const applyMode = (next) => {
      if (next === mode) return
      mode = next
      el.src = SRC[mode]
      kick() // re-place now, the hotspot changed
    }

    const onMove = (e) => {
      setVisible(true)
      target = { x: e.clientX, y: e.clientY }
      lastTarget = e.target
      applyMode(modeFor(e.target))
      kick()
    }

    // the scrollbar fires this when a drag starts/ends, when no mouse move
    // happens to tell us the look should change
    const onRefresh = () => {
      applyMode(modeFor(lastTarget))
      kick()
    }

    // "pointermove", not "mousemove": the scrollbar cancels its pointerdown
    // (to stop text selection), and browsers then stop sending mousemove for
    // the rest of the drag - which is what made the hand stay behind while
    // you dragged. pointermove keeps firing the whole time.
    document.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("cursor:refresh", onRefresh)
    return () => {
      document.removeEventListener("pointermove", onMove)
      window.removeEventListener("cursor:refresh", onRefresh)
      gsap.ticker.remove(tick)
    }
  }, [])

  return (
    <>
      <img
        ref={imgRef}
        src="/hand.svg"
        alt=""
        aria-hidden="true"
        width={SIZE}
        height={SIZE}
        className="fixed top-0 left-0 z-[999] pointer-events-none"
        style={{ willChange: "transform", opacity: visible ? 1 : 0 }}
      />
      <CustomScrollbar />
    </>
  )
}
