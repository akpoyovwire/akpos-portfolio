import React, { useEffect, useRef } from "react"

/*
  CustomCursor
  Replaces the OS pointer with the brown hand image, moved by JS instead of
  the browser, so it can lag behind the real mouse. A requestAnimationFrame
  loop eases the displayed position toward the real cursor every frame.

  FOLLOW controls the lag: higher = snappier (closer to the real mouse),
  lower = floatier. Keep this above WaterTrail's FOLLOW (0.14) so the cursor
  itself feels only slightly delayed, while the water trail lags further
  behind it.

  Requires "cursor: none" in CSS (see index.css) wherever this is active,
  otherwise you'd see both the OS pointer and this image.
*/

const FOLLOW = 0.25 
const HOTSPOT_NORMAL = { x: 8, y: 4 } // fingertip on the tilted hand
const HOTSPOT_HOVER = { x: 12.5, y: 1.5 } // fingertip on the upright hand
const SIZE = 30

export default function CustomCursor() {
  const imgRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return // no cursor to move on touch

    const el = imgRef.current
    let target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    let pos = { ...target }
    let hovering = false
    let raf

    const isInteractive = (node) =>
      node.closest?.("a, button, [role='button'], .cursor-pointer")

    const onMove = (e) => {
      target = { x: e.clientX, y: e.clientY }
      const nowHovering = !!isInteractive(e.target)
      if (nowHovering !== hovering) {
        hovering = nowHovering
        el.src = hovering ? "/hand-pointer.svg" : "/hand.svg"
      }
    }

    const tick = () => {
      const hotspot = hovering ? HOTSPOT_HOVER : HOTSPOT_NORMAL
      pos.x += (target.x - pos.x) * FOLLOW
      pos.y += (target.y - pos.y) * FOLLOW
      el.style.transform = `translate(${pos.x - hotspot.x}px, ${pos.y - hotspot.y}px)`
      raf = requestAnimationFrame(tick)
    }

    document.addEventListener("mousemove", onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      document.removeEventListener("mousemove", onMove)
      cancelAnimationFrame(raf)
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
      style={{ willChange: "transform" }}
    />
  )
}
