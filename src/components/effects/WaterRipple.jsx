import React, { useEffect, useRef } from "react"
import { gsap } from "gsap"

/*
  WaterRipple
  Turns a video OR a static image into "water": pass type="video" (default)
  or type="image". Behaves like water either way.
    - Every click drops a "stone": big rings that spread and slowly calm down.
    - Mouse movement (via the "water:drop" event from WaterTrail) leaves
      small, short-lived ripples along the path.

  The media is drawn onto a <canvas> with a WebGL shader. For each active
  ripple, the shader shifts every pixel a little along the direction from the
  ripple's center, following a sine wave that travels outward and fades.

  The plain <video>/<img> stays underneath, so if WebGL is unavailable it
  just shows normally.

  --- Idle cost fix (this revision) ---
  Previously the render loop ran on every rAF tick for as long as this
  component was on screen at all, whether or not any ripple was actually
  active - and every one of those frames did a full-resolution texImage2D
  re-upload of the video frame to the GPU. With no ripple active, the
  shader's own math (offset = 0, shade = 0) makes its output pixel-for-pixel
  identical to the plain <video> already playing underneath it, so almost
  all of that work was being spent to redraw something already on screen.
  That constant background cost is what was starving scroll/paint on both
  desktop and mobile (mobile especially, since it has no mouse - no
  WaterTrail ripples - so the loop ran 100% of the time for 0% of the
  visual benefit outside an occasional tap).

  Now the loop (and the canvas itself) only runs while at least one ripple
  is within its life window. The rest of the time the canvas is hidden and
  the always-playing <video>/<img> shows through directly - same visual
  result, none of the cost.
*/

/*
  --- Shared ticker ---
  The render loop runs on GSAP's shared ticker (the one Lenis is driven from
  in App.jsx) instead of its own requestAnimationFrame loop. Same idle-stop as
  before: it is only on the ticker while a ripple is alive, and removed when
  none is (or while the canvas is off-screen).
*/

// ---- how many ripples can exist at once ----
const MAX_CLICKS = 8 // click ripples alive at the same time; a 9th click reuses the oldest slot
const MAX_TRAIL = 10 // mouse-trail ripples alive at the same time; same reuse rule
const TOTAL = MAX_CLICKS + MAX_TRAIL // slots sent to the shader. More = more work per pixel on the GPU

// ---- click ripples (the "stone dropped in water") ----
const DURATION = 6.0 // seconds a click ripple lives; it fades out over its last 1.5s
const SPEED = 300.0 // how fast the ring spreads outward, in px per second
const STRENGTH = 20.0 // how far the picture is pushed at the ring, in px. Bigger = stronger warp
const WAVE_FREQ = 0.1 // how tight the waves are. Distance between crests = 2π / this (~63px). Higher = thinner, more packed rings
const TAIL = 0.006 // how quickly the waves die off BEHIND the leading ring. Higher = only the front ring shows; lower = many rings trail behind it
const SHINE = 0.02 // how much wave crests brighten and troughs darken the picture. 0 = pure warping, no highlights

// ---- mouse-trail ripples (small ones left behind your cursor) ----
const TRAIL_DURATION = 2 // seconds a trail ripple lives (short, so the trail stays light)
const TRAIL_SPEED = 100.0 // how fast a trail ring spreads, px per second (slower than clicks)
const TRAIL_POWER = 0.45 // strength of a trail ripple compared to a click one (0.45 = 45%)

const VERTEX = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D u_media;
uniform vec2 u_res;
uniform vec2 u_mediaRes;
uniform float u_dpr;
uniform vec4 u_ripples[${TOTAL}]; // x, y, age in seconds (-1 = unused), 1 if trail

const float DURATION = ${DURATION.toFixed(1)};
const float SPEED = ${SPEED.toFixed(1)};
const float STRENGTH = ${STRENGTH.toFixed(1)};
const float WAVE_FREQ = ${WAVE_FREQ.toFixed(4)};
const float TAIL = ${TAIL.toFixed(4)};
const float SHINE = ${SHINE.toFixed(4)};
const float TRAIL_DURATION = ${TRAIL_DURATION.toFixed(1)};
const float TRAIL_SPEED = ${TRAIL_SPEED.toFixed(1)};
const float TRAIL_POWER = ${TRAIL_POWER.toFixed(2)};

void main() {
  vec2 px = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;

  vec2 offset = vec2(0.0);
  float shade = 0.0;

  for (int i = 0; i < ${TOTAL}; i++) {
    vec4 r = u_ripples[i];
    float age = r.z;
    if (age < 0.0) continue;

    float trail = r.w;
    float dur = mix(DURATION, TRAIL_DURATION, trail);
    float speed = mix(SPEED, TRAIL_SPEED, trail);
    float power = mix(1.0, TRAIL_POWER, trail);
    float decay = mix(0.5, 1.5, trail);

    vec2 d = px - r.xy;
    float dist = length(d);
    float behind = age * speed - dist;
    if (behind <= 0.0) continue;

    float edge = smoothstep(0.0, 40.0, behind);
    float tail = exp(-behind * TAIL);
    float life = exp(-age * decay) * (1.0 - smoothstep(dur - 1.5, dur, age));
    float amp = STRENGTH * power * edge * tail * life / (1.0 + dist * 0.004);

    float wave = sin(behind * WAVE_FREQ);
    offset += (d / max(dist, 0.001)) * wave * amp;
    shade += wave * amp;
  }

  vec2 uv = (px + offset) / u_res;

  float canvasAspect = u_res.x / u_res.y;
  float mediaAspect = u_mediaRes.x / u_mediaRes.y;
  vec2 scale = canvasAspect > mediaAspect
    ? vec2(1.0, mediaAspect / canvasAspect)
    : vec2(canvasAspect / mediaAspect, 1.0);
  uv = (uv - 0.5) * scale + 0.5;

  vec4 color = texture2D(u_media, uv);
  color.rgb *= 1.0 + shade * SHINE;
  gl_FragColor = vec4(color.rgb, 1.0);
}
`

export default function WaterRipple({ src, type = "video" }) {
  const canvasRef = useRef(null)
  const mediaRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const media = mediaRef.current

    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    if (!gl) return

    const compile = (glType, source) => {
      const shader = gl.createShader(glType)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("WaterRipple shader error:", gl.getShaderInfoLog(shader))
        return null
      }
      return shader
    }

    const vs = compile(gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    if (!vs || !fs) return

    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("WaterRipple link error:", gl.getProgramInfoLog(program))
      return
    }
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, "a_pos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const uMedia = gl.getUniformLocation(program, "u_media")
    const uRes = gl.getUniformLocation(program, "u_res")
    const uMediaRes = gl.getUniformLocation(program, "u_mediaRes")
    const uDpr = gl.getUniformLocation(program, "u_dpr")
    const uRipples = gl.getUniformLocation(program, "u_ripples")
    gl.uniform1i(uMedia, 0)

    const startTimes = new Array(TOTAL).fill(-Infinity)
    const positions = new Float32Array(TOTAL * 2)
    const uniformData = new Float32Array(TOTAL * 4)
    let nextClick = 0
    let nextTrail = 0

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let cssW = 1
    let cssH = 1

    const resize = () => {
      cssW = canvas.clientWidth || 1
      cssH = canvas.clientHeight || 1
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    let visible = true
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) wake()
    })
    intersectionObserver.observe(canvas)

    const inside = (rect, x, y) =>
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

    // canvas starts hidden - nothing is rippling yet, so there is nothing
    // for it to show that the plain, always-playing media isn't already
    // showing underneath it
    canvas.style.opacity = "0"
    let active = false
    const setActive = (v) => {
      if (v === active) return
      active = v
      canvas.style.opacity = v ? "1" : "0"
      if (v) wake()
    }

    const hasActiveRipples = (now) => {
      for (let i = 0; i < TOTAL; i++) {
        const isTrail = i >= MAX_CLICKS
        const life = isTrail ? TRAIL_DURATION : DURATION
        const age = now - startTimes[i]
        if (age >= 0 && age <= life) return true
      }
      return false
    }

    const addClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      if (!inside(rect, e.clientX, e.clientY)) return
      startTimes[nextClick] = performance.now() / 1000
      positions[nextClick * 2] = e.clientX - rect.left
      positions[nextClick * 2 + 1] = e.clientY - rect.top
      nextClick = (nextClick + 1) % MAX_CLICKS
      setActive(true)
    }

    const addTrail = (e) => {
      const rect = canvas.getBoundingClientRect()
      const { x, y } = e.detail
      if (!inside(rect, x, y)) return
      const slot = MAX_CLICKS + nextTrail
      startTimes[slot] = performance.now() / 1000
      positions[slot * 2] = x - rect.left
      positions[slot * 2 + 1] = y - rect.top
      nextTrail = (nextTrail + 1) % MAX_TRAIL
      setActive(true)
    }

    document.addEventListener("click", addClick)
    window.addEventListener("water:drop", addTrail)

    const mediaReady = () =>
      type === "image"
        ? media.complete && media.naturalWidth > 0
        : media.readyState >= 2 && media.videoWidth > 0

    const mediaSize = () =>
      type === "image"
        ? [media.naturalWidth, media.naturalHeight]
        : [media.videoWidth, media.videoHeight]

    let running = false
    const render = () => {
      const now = performance.now() / 1000

      // nothing left to animate - stop uploading/drawing frames and let the
      // plain media underneath show through instead of paying for a redraw
      // that would look identical to it
      if (!hasActiveRipples(now)) {
        setActive(false)
        running = false
        gsap.ticker.remove(render)
        return
      }

      for (let i = 0; i < TOTAL; i++) {
        const isTrail = i >= MAX_CLICKS
        const life = isTrail ? TRAIL_DURATION : DURATION
        const age = now - startTimes[i]
        uniformData[i * 4] = positions[i * 2]
        uniformData[i * 4 + 1] = positions[i * 2 + 1]
        uniformData[i * 4 + 2] = age <= life ? age : -1
        uniformData[i * 4 + 3] = isTrail ? 1 : 0
      }

      const [mw, mh] = mediaSize()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media)
      gl.uniform2f(uRes, cssW, cssH)
      gl.uniform2f(uMediaRes, mw, mh)
      gl.uniform1f(uDpr, dpr)
      gl.uniform4fv(uRipples, uniformData)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      if (!visible) {
        running = false // leave the ticker while off-screen
        gsap.ticker.remove(render)
      }
    }
    const wake = () => {
      // only worth running if there's an active ripple to actually show
      if (!running && active && mediaReady()) {
        running = true
        gsap.ticker.add(render)
      }
    }
    // in case a ripple starts while media isn't ready yet
    let readyPoll = setInterval(() => {
      if (mediaReady()) {
        clearInterval(readyPoll)
        wake()
      }
    }, 100)

    return () => {
      gsap.ticker.remove(render)
      clearInterval(readyPoll)
      document.removeEventListener("click", addClick)
      window.removeEventListener("water:drop", addTrail)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [type])

  return (
    <>
      {type === "image" ? (
        <img
          ref={mediaRef}
          src={src}
          alt=""
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <video
          ref={mediaRef}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={src} type="video/mp4" />
        </video>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0, transition: "opacity 0.15s ease" }}
      />
    </>
  )
}
