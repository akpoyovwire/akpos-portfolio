import React, { useEffect, useRef } from "react"

/*
  CustomScrollbar
  A small, thin scrollbar on the right edge, modelled on the one on
  pensatori-irrazionali.com:
    - it only shows while the page is scrolling (fades in on scroll, fades out
      a moment after you stop). It also stays up while the mouse is over it
      or you are dragging it, and moving the mouse onto it brings it back.
    - track: thin, short, see-through, vertically centered
    - thumb: near-black, a touch wider than the track

  The browser's own scrollbar is already hidden in index.css, and a native
  scrollbar can't take a custom cursor anyway - so this one is drawn from
  plain divs. That is what lets CustomCursor show the open hand over it.

  - It follows the page's real scroll position (works with Lenis, since Lenis
    keeps window scroll in sync).
  - Drag the thumb, or click anywhere on the track to jump there.
  - While you hover or drag it, the cursor becomes the open hand: the hit area
    carries `data-grab-cursor`, and while dragging <html> gets `data-grabbing`
    (both are read by CustomCursor).

  Mounted from CustomCursor.jsx, so App.jsx needs no changes.

  LOCKED WHILE A POP-UP IS OPEN
  The project-details overlay (Works.jsx) dispatches "lenis:stop" when it opens
  and "lenis:start" when it closes. For that whole window this scrollbar hides
  and stops taking pointer input. It has to: it is z-[998], ABOVE the overlay
  (z-[100]), and dragging it calls window.scrollTo, which still works on an
  overflow-hidden body - so it was a way to scroll the page behind the overlay
  all the way up to the hero while the overlay stayed open.
*/

// ---- look (change here) ----
const TRACK_H = 170 // px, capped to 40% of screen height on short screens
const TRACK_W = 3
const THUMB_H = 44
const THUMB_W = 5
const TRACK_COLOR = "rgba(255, 255, 255, 0.28)" // see-through; lower the last number for more transparent
const THUMB_COLOR = "#0a0a0a"
const EDGE_GAP = 16 // px from the right edge of the screen to the track
const HIT_W = 24 // invisible grab area, wider than the track so it's easy to catch
const HIDE_DELAY = 900 // ms after the last scroll before the bar fades out
const FADE = 300 // ms fade in/out

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function CustomScrollbar() {
  const hitRef = useRef(null)
  const thumbRef = useRef(null)

  useEffect(() => {
    const hit = hitRef.current
    const thumb = thumbRef.current
    if (!hit || !thumb) return

    const root = document.documentElement
    let dragging = false
    let hovering = false
    let hideTimer = null
    let grabOffset = THUMB_H / 2 // pointer's distance from the thumb's top while dragging
    let locked = false // true while a pop-up has the page locked

    const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight)
    const travel = () => Math.max(1, hit.clientHeight - THUMB_H)

    const update = () => {
      const max = maxScroll()
      // nothing to scroll -> no scrollbar
      hit.style.display = max <= 1 ? "none" : "block"
      const p = max ? clamp(window.scrollY / max, 0, 1) : 0
      thumb.style.transform = `translateY(${p * travel()}px)`
    }

    // fade in now; schedule the fade out unless the mouse is on it / dragging
    const show = () => {
      if (locked) return
      hit.style.opacity = "1"
      clearTimeout(hideTimer)
      if (!dragging && !hovering) {
        hideTimer = setTimeout(() => {
          hit.style.opacity = "0"
        }, HIDE_DELAY)
      }
    }
    const onScroll = () => {
      update()
      show()
    }
    const onEnter = () => {
      hovering = true
      show()
    }
    const onLeave = () => {
      hovering = false
      show()
    }

    const scrollToPointer = (clientY) => {
      if (locked) return
      const rect = hit.getBoundingClientRect()
      const top = clamp(clientY - rect.top - grabOffset, 0, travel())
      const p = top / travel()
      // "instant" overrides the global `scroll-behavior: smooth` in index.css,
      // so the page follows the thumb 1:1 while dragging
      window.scrollTo({ top: p * maxScroll(), behavior: "instant" })
      update()
    }

    // tells CustomCursor to switch to / from the open hand (picture only;
    // the hand itself keeps following the mouse)
    const setGrabbing = (on) => {
      if (on) root.setAttribute("data-grabbing", "")
      else root.removeAttribute("data-grabbing")
      window.dispatchEvent(new Event("cursor:refresh"))
    }

    const onDown = (e) => {
      if (locked) return
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault() // no text selection while dragging
      dragging = true
      hit.setPointerCapture(e.pointerId)
      setGrabbing(true)
      show()

      const t = thumb.getBoundingClientRect()
      if (e.clientY >= t.top && e.clientY <= t.bottom) {
        grabOffset = e.clientY - t.top // grabbed the thumb: keep it under the pointer
      } else {
        grabOffset = THUMB_H / 2 // clicked the track: thumb centers on the click
        scrollToPointer(e.clientY)
      }
    }
    const onMove = (e) => {
      if (dragging) scrollToPointer(e.clientY)
    }
    const onUp = (e) => {
      if (!dragging) return
      dragging = false
      if (hit.hasPointerCapture?.(e.pointerId)) hit.releasePointerCapture(e.pointerId)
      setGrabbing(false)
      hovering = hit.matches(":hover")
      show()
    }

    hit.addEventListener("pointerdown", onDown)
    hit.addEventListener("pointerenter", onEnter)
    hit.addEventListener("pointerleave", onLeave)
    hit.addEventListener("pointermove", onMove)
    hit.addEventListener("pointerup", onUp)
    hit.addEventListener("pointercancel", onUp)

    // pop-up open: vanish and ignore the pointer; pop-up closed: back to normal
    const lock = () => {
      locked = true
      dragging = false
      hovering = false
      clearTimeout(hideTimer)
      hit.style.opacity = "0"
      hit.style.pointerEvents = "none"
      if (root.hasAttribute("data-grabbing")) setGrabbing(false)
    }
    const unlock = () => {
      locked = false
      hit.style.pointerEvents = ""
      update()
    }
    window.addEventListener("lenis:stop", lock)
    window.addEventListener("lenis:start", unlock)

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", update)
    // page height changes as images load, pins are built, etc.
    const ro = new ResizeObserver(update)
    ro.observe(document.body)
    update()

    return () => {
      clearTimeout(hideTimer)
      hit.removeEventListener("pointerdown", onDown)
      hit.removeEventListener("pointerenter", onEnter)
      hit.removeEventListener("pointerleave", onLeave)
      hit.removeEventListener("pointermove", onMove)
      hit.removeEventListener("pointerup", onUp)
      hit.removeEventListener("pointercancel", onUp)
      window.removeEventListener("lenis:stop", lock)
      window.removeEventListener("lenis:start", unlock)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", update)
      ro.disconnect()
      root.removeAttribute("data-grabbing")
    }
  }, [])

  return (
    <div
      ref={hitRef}
      data-grab-cursor
      aria-hidden="true"
      className="fixed z-[998]"
      style={{
        display: "none", // shown by update() once the page is scrollable
        opacity: 0, // hidden until you scroll (see show())
        transition: `opacity ${FADE}ms ease`,
        top: "50%",
        right: EDGE_GAP - (HIT_W - TRACK_W) / 2,
        width: HIT_W,
        height: `min(${TRACK_H}px, 40vh)`,
        marginTop: `calc(min(${TRACK_H}px, 40vh) / -2)`,
        touchAction: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: (HIT_W - TRACK_W) / 2,
          width: TRACK_W,
          borderRadius: TRACK_W,
          background: TRACK_COLOR,
        }}
      />
      <div
        ref={thumbRef}
        style={{
          position: "absolute",
          top: 0,
          left: (HIT_W - THUMB_W) / 2,
          width: THUMB_W,
          height: THUMB_H,
          borderRadius: THUMB_W,
          background: THUMB_COLOR,
          willChange: "transform",
        }}
      />
    </div>
  )
}
