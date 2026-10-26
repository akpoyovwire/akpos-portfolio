import React, { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { MAP_W, MAP_H, COLORS, EDGES, NODES } from "./mapData"

/*
  MapBackground
  The map behind Expertise / Works / Activity, drawn on a <canvas> from the data in mapData.js (a hard-coded copy
  of section-map-bg.svg). Same picture as before - same lines, same nodes, same "cover" fit - but it now DRAWS ITSELF:

    1. It starts at the node nearest the middle. Lines grow outward from it, node to node, each one lighting up
       as it is drawn and then settling back to its normal faint colour.
    2. Every node pops in and sends out a ring (a "ping") the moment a line reaches it.
    3. When the whole map is drawn, on a computer a few small signals keep travelling along the lines (and ping
       the nodes they reach). On a phone it simply stays as the finished picture, which costs nothing.

  IT ONLY WORKS WHILE YOU CAN SEE IT
  The animation clock only runs - and the frame loop is only on GSAP's ticker - while ALL of these are true:
    - the canvas is on screen (IntersectionObserver; this also handles a layer that is still sliding in),
    - the layer is not covered by the next section (the `paused` prop from StackLayer in App.jsx),
    - no pop-up is open (the page is locked: <html> has Lenis' "lenis-stopped" class, or an Activity pop-up exists),
    - the browser tab is visible.
  Otherwise it stops dead and keeps the picture it has. When it comes back it carries on where it left off.
  Once it is fully drawn and there are no signals (phones, reduced motion) it draws one last frame and stops for good.

  Tuning: SPEED (how fast lines grow), GLOW (how bright a fresh line is), SIGNALS (how many travellers).
*/

const SPEED = 420 // map units per second that a line grows (the map is 1600 wide: lower = slower, longer draw)
const GLOW = 2.5 // a fresh line is this many times brighter than normal, then fades back
const GLOW_FADE = 0.9 // seconds that fade takes
const POP = 0.5 // seconds a node takes to pop in
const PING = 1.0 // seconds a node's ring takes to spread and fade
const SIGNALS = 20 // travelling dots after the map is drawn (computers only)
const SIGNAL_SPEED = 220 // map units per second

const RGB = COLORS.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])
const rgba = (c, a) => `rgba(${RGB[c][0]},${RGB[c][1]},${RGB[c][2]},${a})`
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const easeOut = (u) => 1 - (1 - u) * (1 - u)
const easeBack = (u) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2)
}

/* ---------- the plan: WHEN each line and node appears (worked out once, shared by every instance) ---------- */
const keyOf = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`
const nodeIndex = new Map(NODES.map((n, i) => [keyOf(n[0], n[1]), i]))
const edgeEnds = EDGES.map((e) => [nodeIndex.get(keyOf(e[0], e[1])), nodeIndex.get(keyOf(e[4], e[5]))])
const edgeLen = EDGES.map((e) => Math.hypot(e[4] - e[0], e[5] - e[1]) * 1.06) // a curve is a touch longer than its chord
const adjacency = NODES.map(() => [])
edgeEnds.forEach(([a, b], i) => {
  adjacency[a].push(i)
  adjacency[b].push(i)
})

function makePlan() {
  const n = NODES.length
  const arrival = new Array(n).fill(Infinity) // when a line first reaches this node
  const start = new Array(EDGES.length).fill(0)
  const from = new Array(EDGES.length).fill(0) // which end the line grows from
  const done = new Set()

  const dijkstra = (root, t0) => {
    arrival[root] = t0
    const open = new Set([root])
    while (open.size) {
      let cur = -1
      open.forEach((i) => {
        if (cur < 0 || arrival[i] < arrival[cur]) cur = i
      })
      open.delete(cur)
      adjacency[cur].forEach((ei) => {
        if (done.has(ei)) return
        const [a, b] = edgeEnds[ei]
        const other = a === cur ? b : a
        done.add(ei)
        start[ei] = arrival[cur]
        from[ei] = cur
        const end = arrival[cur] + edgeLen[ei] / SPEED
        if (end < arrival[other]) {
          arrival[other] = end
          open.add(other)
        }
      })
    }
  }

  // root = the node nearest the middle of the map
  const nearestUnvisited = () => {
    let best = -1
    let bd = Infinity
    for (let i = 0; i < n; i++) {
      if (arrival[i] !== Infinity) continue
      const d = Math.hypot(NODES[i][0] - MAP_W / 2, NODES[i][1] - MAP_H / 2)
      if (d < bd) { bd = d; best = i }
    }
    return best
  }
  dijkstra(nearestUnvisited(), 0)
  // anything not joined to the main network starts a little later, nearest the middle first
  let extra = 0
  let r
  while ((r = nearestUnvisited()) >= 0) {
    const t0 = 0.8 + extra * 0.5
    extra += 1
    dijkstra(r, t0)
  }
  // an edge whose two ends were both reached by other lines still grows from the earlier end
  EDGES.forEach((_, ei) => {
    if (!done.has(ei)) {
      const [a, b] = edgeEnds[ei]
      from[ei] = arrival[a] <= arrival[b] ? a : b
      start[ei] = Math.min(arrival[a], arrival[b])
    }
  })
  let total = 0
  EDGES.forEach((_, ei) => { total = Math.max(total, start[ei] + edgeLen[ei] / SPEED) })
  arrival.forEach((a) => { if (a !== Infinity) total = Math.max(total, a) })
  return { arrival, start, from, total }
}
const PLAN = makePlan()
const FINISHED = PLAN.total + Math.max(GLOW_FADE, POP, PING) + 0.05

/* ---------- drawing ---------- */
function drawMap(ctx, t, view, pings) {
  const { dpr, s, ox, oy, w, h } = view
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w * dpr, h * dpr)
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy) // map units -> screen pixels, "cover" fit
  ctx.lineCap = "round"
  ctx.lineWidth = 1

  // lines
  for (let i = 0; i < EDGES.length; i++) {
    const e = EDGES[i]
    const dur = edgeLen[i] / SPEED
    const u = clamp((t - PLAN.start[i]) / dur, 0, 1)
    if (u <= 0) continue
    const p = easeOut(u)
    const flip = PLAN.from[i] !== edgeEnds[i][0]
    const x0 = flip ? e[4] : e[0]
    const y0 = flip ? e[5] : e[1]
    const x1 = flip ? e[0] : e[4]
    const y1 = flip ? e[1] : e[5]
    const cx = e[2]
    const cy = e[3]
    const glow = 1 - clamp((t - PLAN.start[i] - dur) / GLOW_FADE, 0, 1)
    ctx.strokeStyle = rgba(e[6], Math.min(0.9, e[7] * (1 + GLOW * glow)))
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    // the part of the curve from its start up to p (de Casteljau): control point is pulled back by the same factor
    const q = 1 - p
    ctx.quadraticCurveTo(x0 + (cx - x0) * p, y0 + (cy - y0) * p, q * q * x0 + 2 * q * p * cx + p * p * x1, q * q * y0 + 2 * q * p * cy + p * p * y1)
    ctx.stroke()
  }

  // nodes
  for (let i = 0; i < NODES.length; i++) {
    const nd = NODES[i]
    const a = PLAN.arrival[i]
    if (a === Infinity) continue
    const k = clamp((t - a) / POP, 0, 1)
    if (k <= 0) continue
    const x = nd[0]
    const y = nd[1]
    ctx.fillStyle = rgba(nd[4], nd[5] * k)
    ctx.beginPath()
    ctx.arc(x, y, Math.max(0.01, nd[2] * easeBack(k)), 0, Math.PI * 2)
    ctx.fill()
    if (nd[3]) {
      ctx.lineWidth = 0.6
      ctx.strokeStyle = rgba(nd[4], nd[6] * k)
      ctx.beginPath()
      ctx.arc(x, y, nd[3] * (0.4 + 0.6 * k), 0, Math.PI * 2)
      ctx.stroke()
    }
    // the ping: one thin ring that spreads out and fades, the moment the line arrives
    const q = (t - a) / PING
    if (q > 0 && q < 1) {
      ctx.lineWidth = 0.8
      ctx.strokeStyle = rgba(nd[4], 0.4 * (1 - q))
      ctx.beginPath()
      ctx.arc(x, y, (nd[3] || nd[2] * 2.4) * (1 + 2.6 * easeOut(q)), 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // pings caused later by travelling signals reaching a node: [nodeIndex, startTime]
  if (pings && pings.length) {
    ctx.lineWidth = 0.8
    for (let i = 0; i < pings.length; i++) {
      const [ni, t0] = pings[i]
      const q = (t - t0) / PING
      if (q < 0 || q > 1) continue
      const nd = NODES[ni]
      ctx.strokeStyle = rgba(nd[4], 0.35 * (1 - q))
      ctx.beginPath()
      ctx.arc(nd[0], nd[1], (nd[3] || nd[2] * 2.4) * (1 + 2.2 * easeOut(q)), 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

function pointOnEdge(ei, fromNode, p) {
  const e = EDGES[ei]
  const flip = fromNode !== edgeEnds[ei][0]
  const x0 = flip ? e[4] : e[0]
  const y0 = flip ? e[5] : e[1]
  const x1 = flip ? e[0] : e[4]
  const y1 = flip ? e[1] : e[5]
  const q = 1 - p
  return [q * q * x0 + 2 * q * p * e[2] + p * p * x1, q * q * y0 + 2 * q * p * e[3] + p * p * y1]
}

export default function MapBackground({ paused = false }) {
  const canvasRef = useRef(null)
  const pausedRef = useRef(paused)
  const kickRef = useRef(() => {})

  // the layer got covered / uncovered: re-check whether the loop should run
  useEffect(() => {
    pausedRef.current = paused
    kickRef.current()
  }, [paused])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext("2d")
    if (!ctx) return undefined

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const lite = window.matchMedia("(pointer: coarse)").matches // phones / tablets
    const ambient = !lite && !reduced // travelling signals after the map is drawn
    const maxDpr = lite ? 1.25 : 1.5

    const view = { dpr: 1, s: 1, ox: 0, oy: 0, w: 1, h: 1 }
    let t = reduced ? FINISHED : 0 // the animation clock (seconds); only advances while the map is on screen
    let running = false
    let visible = false
    let modalOpen = false
    let finishedStatic = false // everything drawn and nothing left to animate: stop for good
    let lastNow = 0
    let lastDraw = 0
    let base = null // the finished map, drawn once, reused every frame by the signals
    const pings = []
    const signals = []
    let nextSpawn = 0

    const html = document.documentElement
    const isModalOpen = () =>
      html.classList.contains("lenis-stopped") || Boolean(document.querySelector(".activity-modal"))

    /* ----- size ----- */
    const resize = () => {
      const w = canvas.clientWidth || 1
      const h = canvas.clientHeight || 1
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      view.dpr = dpr
      view.w = w
      view.h = h
      view.s = Math.max(w / MAP_W, h / MAP_H) // background-size: cover
      view.ox = (w - MAP_W * view.s) / 2
      view.oy = (h - MAP_H * view.s) / 2
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      base = null
      paint()
    }

    const ensureBase = () => {
      if (base) return base
      base = document.createElement("canvas")
      base.width = canvas.width
      base.height = canvas.height
      drawMap(base.getContext("2d"), FINISHED, view, null)
      return base
    }

    /* ----- one frame ----- */
    const paint = () => {
      if (t >= FINISHED && ambient) {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(ensureBase(), 0, 0)
        drawSignals()
      } else {
        drawMap(ctx, Math.min(t, FINISHED), view, null)
      }
    }

    /* ----- travelling signals (computers only, after the map is drawn) ----- */
    const spawnSignal = () => {
      const node = Math.floor(Math.random() * NODES.length)
      const list = adjacency[node]
      if (!list.length) return
      signals.push({ node, edge: list[Math.floor(Math.random() * list.length)], u: 0, hops: 3 + Math.floor(Math.random() * 5) })
    }
    const stepSignals = (dt) => {
      if (signals.length < SIGNALS && t >= nextSpawn) {
        spawnSignal()
        nextSpawn = t + 0.1 + Math.random() * 0.2
      }
      for (let i = signals.length - 1; i >= 0; i--) {
        const sg = signals[i]
        sg.u += (SIGNAL_SPEED * dt) / edgeLen[sg.edge]
        if (sg.u >= 1) {
          const [a, b] = edgeEnds[sg.edge]
          const arrived = sg.node === a ? b : a
          pings.push([arrived, t])
          if (pings.length > 24) pings.shift()
          sg.hops -= 1
          const options = adjacency[arrived].filter((ei) => ei !== sg.edge)
          if (sg.hops <= 0 || !options.length) { signals.splice(i, 1); continue }
          sg.node = arrived
          sg.edge = options[Math.floor(Math.random() * options.length)]
          sg.u = 0
        }
      }
    }
    const drawSignals = () => {
      ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy)
      // pings from signals reaching a node
      ctx.lineWidth = 0.8
      for (let i = 0; i < pings.length; i++) {
        const [ni, t0] = pings[i]
        const q = (t - t0) / PING
        if (q < 0 || q > 1) continue
        const nd = NODES[ni]
        ctx.strokeStyle = rgba(nd[4], 0.35 * (1 - q))
        ctx.beginPath()
        ctx.arc(nd[0], nd[1], (nd[3] || nd[2] * 2.4) * (1 + 2.2 * easeOut(q)), 0, Math.PI * 2)
        ctx.stroke()
      }
      // the travellers: a bright head with a short fading tail
      for (let i = 0; i < signals.length; i++) {
        const sg = signals[i]
        const colour = EDGES[sg.edge][6]
        for (let k = 0; k < 7; k++) {
          const p = clamp(sg.u - k * 0.035, 0, 1)
          const [x, y] = pointOnEdge(sg.edge, sg.node, p)
          ctx.fillStyle = rgba(colour, 0.85 * (1 - k / 7))
          ctx.beginPath()
          ctx.arc(x, y, 1.9 * (1 - k * 0.1), 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    /* ----- the loop ----- */
    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.1, (now - lastNow) / 1000) // after a stall, do not jump ahead
      lastNow = now
      if (lite && now - lastDraw < 30) return // phones: 30 frames a second is plenty for a faint background
      lastDraw = now
      t += dt
      if (t >= FINISHED && ambient) stepSignals(dt)
      paint()
      if (t >= FINISHED && !ambient) {
        // drawn, nothing else to animate: one last frame is on the canvas, so stop for good
        finishedStatic = true
        evaluate()
      }
    }

    const shouldRun = () => visible && !pausedRef.current && !modalOpen && !document.hidden && !finishedStatic

    function evaluate() {
      const go = shouldRun()
      if (go && !running) {
        running = true
        lastNow = performance.now()
        gsap.ticker.add(tick)
      } else if (!go && running) {
        running = false
        gsap.ticker.remove(tick)
      }
    }
    kickRef.current = evaluate

    /* ----- things that can switch it off ----- */
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        evaluate()
      },
      { threshold: 0 }
    )
    io.observe(canvas)

    const checkModal = () => {
      const open = isModalOpen()
      if (open !== modalOpen) {
        modalOpen = open
        evaluate()
      }
    }
    const onLock = () => setTimeout(checkModal, 0)
    window.addEventListener("lenis:stop", onLock)
    window.addEventListener("lenis:start", onLock)
    const mo = new MutationObserver(checkModal) // Lenis adds / removes "lenis-stopped" on <html>
    mo.observe(html, { attributes: true, attributeFilter: ["class"] })
    // Activity pop-ups may not lock the page: look for one now and then, but only while the map is on screen
    const poll = setInterval(() => { if (visible) checkModal() }, 400)
    const onVis = () => evaluate()
    document.addEventListener("visibilitychange", onVis)

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    modalOpen = isModalOpen()
    resize()

    return () => {
      gsap.ticker.remove(tick)
      kickRef.current = () => {}
      io.disconnect()
      mo.disconnect()
      ro.disconnect()
      clearInterval(poll)
      window.removeEventListener("lenis:stop", onLock)
      window.removeEventListener("lenis:start", onLock)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}