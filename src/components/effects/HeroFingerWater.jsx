import React, { useEffect, useRef } from "react"
import { gsap } from "gsap"

/*
  HeroFingerWater
  A realistic "finger dragged through water" for the HERO VIDEO ONLY.
  (Everywhere else on the site your normal circular WaterTrail is untouched.)

  It lives inside the hero section, on its own transparent canvas, and reacts to the mouse
  only while the mouse is over the hero. What it draws, in the order you see it:

    - foam specks       tiny bubbles along the path that pop and drift
    - the bow wake      two CURVED arms that follow the path of the finger (so a turn bends the wake),
                        built the way a real Kelvin wake is: the arms spread ~19.5 degrees from the path
    - cross waves       short arcs between the two arms, like the ones behind a boat
    - splash            a few droplets thrown up when the finger moves fast, falling back under gravity

  The lines are a bright crest with only a faint dark edge, so they read on light and dark cubes
  without leaving any dark smear. No rings or circles are drawn at the fingertip.

  It also fires "water:drop" along the path, exactly like WaterTrail does, so WaterRipple keeps
  bending the real hero video underneath. WaterTrail skips the hero (excludeId="home"), so those
  events come from here while you are on the hero, and from WaterTrail everywhere else.

  Frame loop: GSAP's shared ticker (same one Lenis runs on). It is on the ticker only while something
  is moving, and it is switched off while the hero is off screen.
*/

const FOLLOW = 0.2 // 0-1. Lower = the finger lags further behind the mouse
const HIST_STEP = 3 // px between recorded path points
const HIST_LIFE = 1500 // ms the path is remembered (the wake fades as it ages)
const ARM_LEN = 240 // px of path the wake arms follow back from the finger
const KELVIN = Math.tan((19.5 * Math.PI) / 180) // how fast the arms spread per px of path
const DROP_SPACING = 14 // px between "water:drop" events for the video ripple
const WAVELET_SPACING = 9 // px between expanding wavelets
const WAVELET_LIFE = 1700 // ms
const WAVELET_SPEED = 150 // px per second
const MAX_WAVELETS = 64
const MAX_FOAM = 70
const MAX_SPLASH = 40
const GRAVITY = 1100 // px per second squared

export default function HeroFingerWater({ light = "255,255,255", dark = "6,14,28" }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    // ---- where the hero is. Measured when the layout changes, never per mouse move ----
    let W = 1
    let H = 1
    let pageLeft = 0
    let pageTop = 0
    const measure = () => {
      const r = canvas.getBoundingClientRect()
      W = Math.max(1, r.width)
      H = Math.max(1, r.height)
      pageLeft = r.left + window.scrollX
      pageTop = r.top + window.scrollY
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(canvas)

    let visible = true
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (!visible) stop()
    })
    io.observe(canvas)

    const target = { x: 0, y: 0 }
    const f = { x: 0, y: 0 } // the finger
    let vx = 0
    let vy = 0
    let started = false
    let running = false
    let lastDrop = { x: 0, y: 0 }
    let lastWavelet = { x: 0, y: 0 }
    let lastSplash = 0
    const hist = []
    const wavelets = []
    const foam = []
    const splash = []

    const stroke2 = (draw, darkStyle, darkW, lightStyle, lightW) => {
      ctx.lineWidth = darkW
      ctx.strokeStyle = darkStyle
      draw()
      ctx.lineWidth = lightW
      ctx.strokeStyle = lightStyle
      draw()
    }

    const frame = () => {
      const now = performance.now()
      const px = f.x
      const py = f.y
      f.x += (target.x - f.x) * FOLLOW
      f.y += (target.y - f.y) * FOLLOW
      vx += (f.x - px - vx) * 0.25
      vy += (f.y - py - vy) * 0.25
      const speed = Math.hypot(vx, vy)
      const heading = Math.atan2(vy, vx)
      const inside = f.x >= 0 && f.x <= W && f.y >= 0 && f.y <= H

      if (inside && speed > 0.7) {
        const h = hist[hist.length - 1]
        if (!h || Math.hypot(f.x - h.x, f.y - h.y) >= HIST_STEP) {
          hist.push({ x: f.x, y: f.y, t: now })
          if (hist.length > 160) hist.shift()
        }
        if (Math.hypot(f.x - lastDrop.x, f.y - lastDrop.y) >= DROP_SPACING) {
          lastDrop = { x: f.x, y: f.y }
          window.dispatchEvent(
            new CustomEvent("water:drop", {
              detail: { x: f.x + pageLeft - window.scrollX, y: f.y + pageTop - window.scrollY },
            })
          )
        }
        // foam specks along the channel
        if (Math.random() < 0.55 && foam.length < MAX_FOAM) {
          const side = (Math.random() - 0.5) * 2
          foam.push({
            x: f.x - Math.cos(heading) * 6 + -Math.sin(heading) * side * 7,
            y: f.y - Math.sin(heading) * 6 + Math.cos(heading) * side * 7,
            dx: (Math.random() - 0.5) * 0.25,
            dy: (Math.random() - 0.5) * 0.25,
            r: 0.8 + Math.random() * 1.6,
            born: now,
          })
        }
        // splash when the finger is fast
        if (speed > 4.2 && now - lastSplash > 70 && splash.length < MAX_SPLASH) {
          lastSplash = now
          const n = 2 + Math.floor(Math.random() * 3)
          for (let i = 0; i < n; i++) {
            const a = heading + (Math.random() - 0.5) * 1.6
            const v = 80 + Math.random() * 190
            splash.push({
              x: f.x,
              y: f.y,
              vx: Math.cos(a) * v * 0.5 + (Math.random() - 0.5) * 60,
              vy: -(120 + Math.random() * 230),
              r: 0.9 + Math.random() * 1.7,
              born: now,
              life: 520 + Math.random() * 280,
            })
          }
        }
      } else {
        lastDrop = { x: f.x, y: f.y }
        lastWavelet = { x: f.x, y: f.y }
      }
      while (hist.length && now - hist[0].t > HIST_LIFE) hist.shift()

      ctx.clearRect(0, 0, W, H)
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      // ---- the bow wake: curved arms that follow the path ----
      if (hist.length > 3) {
        const pts = [] // from the finger backwards: {x, y, nx, ny, s, k}
        let s = 0
        let prev = { x: f.x, y: f.y }
        for (let i = hist.length - 1; i >= 0; i--) {
          const p = hist[i]
          s += Math.hypot(prev.x - p.x, prev.y - p.y)
          prev = p
          if (s > ARM_LEN) break
          const newer = hist[i + 1] || f
          const older = hist[i - 1] || p
          let tx = newer.x - older.x
          let ty = newer.y - older.y
          const tl = Math.hypot(tx, ty) || 1
          tx /= tl
          ty /= tl
          const k = (1 - s / ARM_LEN) * Math.max(0, 1 - (now - p.t) / HIST_LIFE)
          pts.push({ x: p.x, y: p.y, tx, ty, nx: -ty, ny: tx, s, k })
        }

        const armPoint = (p, side, scale) => ({
          x: p.x + p.nx * side * p.s * KELVIN * scale,
          y: p.y + p.ny * side * p.s * KELVIN * scale,
        })

        for (const scale of [1, 0.72]) {
          const strength = scale === 1 ? 1 : 0.55
          for (const side of [-1, 1]) {
            for (let i = 2; i < pts.length; i += 2) {
              const a = armPoint(pts[i - 2], side, scale)
              const b = armPoint(pts[i], side, scale)
              const k = pts[i].k * strength
              if (k <= 0.01) continue
              stroke2(
                () => {
                  ctx.beginPath()
                  ctx.moveTo(a.x, a.y)
                  ctx.lineTo(b.x, b.y)
                  ctx.stroke()
                },
                `rgba(${dark},${0.1 * k})`,
                1 + 1.6 * k,
                `rgba(${light},${0.8 * k})`,
                0.6 + 1.6 * k
              )
            }
          }
        }

        // cross waves between the arms
        for (let i = 6; i < pts.length; i += 7) {
          const p = pts[i]
          const L = armPoint(p, -1, 1)
          const R = armPoint(p, 1, 1)
          const width = p.s * KELVIN
          const cx = p.x - p.tx * width * 0.55
          const cy = p.y - p.ty * width * 0.55
          const k = p.k
          if (k <= 0.02) continue
          stroke2(
            () => {
              ctx.beginPath()
              ctx.moveTo(L.x, L.y)
              ctx.quadraticCurveTo(cx, cy, R.x, R.y)
              ctx.stroke()
            },
            `rgba(${dark},${0.07 * k})`,
            1.6,
            `rgba(${light},${0.42 * k})`,
            1
          )
        }
      }

      // ---- foam specks ----
      for (let i = foam.length - 1; i >= 0; i--) {
        const p = foam[i]
        const age = now - p.born
        if (age > 900) {
          foam.splice(i, 1)
          continue
        }
        p.x += p.dx
        p.y += p.dy
        const k = 1 - age / 900
        ctx.fillStyle = `rgba(${light},${0.7 * k})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (0.6 + 0.4 * k), 0, Math.PI * 2)
        ctx.fill()
      }

      // ---- splash droplets ----
      for (let i = splash.length - 1; i >= 0; i--) {
        const d = splash[i]
        const age = now - d.born
        if (age > d.life) {
          splash.splice(i, 1)
          continue
        }
        const sec = age / 1000
        const x = d.x + d.vx * sec
        const y = d.y + d.vy * sec + 0.5 * GRAVITY * sec * sec
        const k = 1 - age / d.life
        ctx.fillStyle = `rgba(${light},${0.95 * k})`
        ctx.beginPath()
        ctx.arc(x, y, d.r, 0, Math.PI * 2)
        ctx.fill()
      }

      const settled = Math.hypot(target.x - f.x, target.y - f.y) < 0.5
      if (!hist.length && !wavelets.length && !foam.length && !splash.length && settled) stop()
    }

    function stop() {
      if (!running) return
      running = false
      gsap.ticker.remove(frame)
      ctx.clearRect(0, 0, W, H)
    }

    const onMove = (e) => {
      if (!visible) return
      const x = e.clientX + window.scrollX - pageLeft
      const y = e.clientY + window.scrollY - pageTop
      if (x < 0 || x > W || y < 0 || y > H) return
      target.x = x
      target.y = y
      if (!started) {
        f.x = x
        f.y = y
        lastDrop = { x, y }
        lastWavelet = { x, y }
        started = true
      }
      if (!running) {
        running = true
        gsap.ticker.add(frame)
      }
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    return () => {
      gsap.ticker.remove(frame)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener("mousemove", onMove)
    }
  }, [light, dark])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}