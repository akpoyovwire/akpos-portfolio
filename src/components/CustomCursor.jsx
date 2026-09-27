import React, { useEffect, useRef, useState } from "react"

/*
  CustomCursor
  Desktop/trackpad (pointer: fine): the brown hand eases toward the real
  mouse every frame (see FOLLOW), and swaps to the upright hand over
  links/buttons.

  Touch (pointer: coarse): there is no mouse to follow, so instead the
  cursor jumps straight to wherever the finger taps - "period", no lerp,
  no lingering at a stale position. It was previously disabled outright on
  touch, which is what left it stuck rendering at its default CSS position
  (fixed top-0 left-0, the top-left corner) forever, since nothing ever
  moved it. It now stays hidden until the first tap, then appears exactly
  there and follows every subsequent tap.
*/

const FOLLOW = 0.2
const HOTSPOT_NORMAL = { x: 8, y: 4 } // fingertip on the tilted hand
const HOTSPOT_HOVER = { x: 12.5, y: 1.5 } // fingertip on the upright hand
const SIZE = 30

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
    let hovering = false
    let raf = null
    let running = false

    const isInteractive = (node) =>
      node.closest?.("a, button, [role='button'], .cursor-pointer")

    const tick = () => {
      const hotspot = hovering ? HOTSPOT_HOVER : HOTSPOT_NORMAL
      pos.x += (target.x - pos.x) * FOLLOW
      pos.y += (target.y - pos.y) * FOLLOW
      el.style.transform = `translate(${pos.x - hotspot.x}px, ${pos.y - hotspot.y}px)`

      // once fully caught up there's nothing left to animate - stop
      // scheduling frames rather than writing the same transform forever
      if (Math.hypot(target.x - pos.x, target.y - pos.y) < 0.1) {
        running = false
        return
      }
      raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      setVisible(true)
      target = { x: e.clientX, y: e.clientY }
      const nowHovering = !!isInteractive(e.target)
      if (nowHovering !== hovering) {
        hovering = nowHovering
        el.src = hovering ? "/hand-pointer.svg" : "/hand.svg"
      }
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    document.addEventListener("mousemove", onMove, { passive: true })
    return () => {
      document.removeEventListener("mousemove", onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
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
  )
}
