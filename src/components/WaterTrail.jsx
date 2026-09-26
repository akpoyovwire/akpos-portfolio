import React, { useEffect, useRef } from "react"

/*
  WaterTrail
  A transparent, click-through canvas over the whole page. A "follower"
  eases toward the real mouse, so it always trails slightly behind. That
  follower drops expanding rings along its path (a finger dragged through
  water) and drags a soft V-shaped wake behind it (a duck swimming).

  Each ring drop also fires a "water:drop" event, which WaterRipple uses to
  push the hero video around.

  rgb: the ring color as "r,g,b". White suits dark backgrounds. On a bright
  background use something dark, e.g. "31,30,36".
*/

const FOLLOW = 0.14 // 0-1. Lower = more delay behind the mouse
const SPACING = 10 // px the follower travels between ring drops
const RING_LIFE = 1400 // ms a ring lasts
const RING_SIZE = 46 // max ring radius in px
const WAKE_ANGLE = (50.5 * Math.PI) / 180 // the classic duck-wake angle

export default function WaterTrail({ rgb = "255,255,255" }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    // no hover on touch screens, and respect reduced motion
    if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const target = { x: 0, y: 0 }
    const follower = { x: 0, y: 0 }
    let lastDrop = { x: 0, y: 0 }
    let vx = 0
    let vy = 0
    let started = false
    let running = false
    let raf = 0
    const rings = []

    const frame = (now) => {
      const px = follower.x
      const py = follower.y
      follower.x += (target.x - follower.x) * FOLLOW
      follower.y += (target.y - follower.y) * FOLLOW

      // smoothed velocity in px per frame
      vx += (follower.x - px - vx) * 0.2
      vy += (follower.y - py - vy) * 0.2
      const speed = Math.hypot(vx, vy)

      if (Math.hypot(follower.x - lastDrop.x, follower.y - lastDrop.y) >= SPACING) {
        rings.push({ x: follower.x, y: follower.y, born: now })
        lastDrop = { x: follower.x, y: follower.y }
        window.dispatchEvent(
          new CustomEvent("water:drop", { detail: { x: follower.x, y: follower.y } })
        )
      }

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      // expanding rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]
        const t = (now - r.born) / RING_LIFE
        if (t >= 1) {
          rings.splice(i, 1)
          continue
        }
        const grow = 1 - Math.pow(1 - t, 3)
        const alpha = (1 - t) * 0.5
        ctx.lineWidth = 0.5 + 1.5 * (1 - t)
        ctx.strokeStyle = `rgba(${rgb},${alpha})`
        ctx.beginPath()
        ctx.arc(r.x, r.y, 3 + grow * RING_SIZE, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = `rgba(${rgb},${alpha * 0.6})`
        ctx.beginPath()
        ctx.arc(r.x, r.y, 2 + grow * RING_SIZE * 0.6, 0, Math.PI * 2)
        ctx.stroke()
      }

      // V-shaped wake behind the direction of travel
      if (speed > 0.6) {
        const len = Math.min(speed * 9, 140)
        const back = Math.atan2(vy, vx) + Math.PI
        ctx.lineWidth = 1.3
        ctx.lineCap = "round"
        for (const side of [-1, 1]) {
          const a = back + side * WAKE_ANGLE
          const ex = follower.x + Math.cos(a) * len
          const ey = follower.y + Math.sin(a) * len
          const g = ctx.createLinearGradient(follower.x, follower.y, ex, ey)
          g.addColorStop(0, `rgba(${rgb},0.45)`)
          g.addColorStop(1, `rgba(${rgb},0)`)
          ctx.strokeStyle = g
          ctx.beginPath()
          ctx.moveTo(follower.x, follower.y)
          ctx.lineTo(ex, ey)
          ctx.stroke()
        }
      }

      const settled = Math.hypot(target.x - follower.x, target.y - follower.y) < 0.5
      if (rings.length === 0 && settled) {
        running = false // nothing left to draw, so stop the loop
        return
      }
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => {
      target.x = e.clientX
      target.y = e.clientY
      if (!started) {
        follower.x = target.x
        follower.y = target.y
        lastDrop = { x: target.x, y: target.y }
        started = true
      }
      if (!running) {
        running = true
        raf = requestAnimationFrame(frame)
      }
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    window.addEventListener("resize", resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("resize", resize)
    }
  }, [rgb])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40 w-full h-full"
    />
  )
}
