// src/preload.js
// Warms the browser's cache while the intro is writing, so by the time the site appears the images are
// already downloaded AND decoded, and the hero video is fully buffered and ready to go.
//
// Three tiers, so the intro is never held up by things the visitor doesn't need yet:
//   1. CRITICAL (+ the hero video)  - needed the moment the intro ends. The intro waits for these (hard cap below).
//   2. SECOND   - Activity cards, game art, listening-room art, artist images. Starts right after tier 1,
//                 never blocks the intro, low network priority.
//   3. IDLE     - pop-up code, then the listening-room audio. Starts when the site is up and the browser is idle.
//
// THE HERO VIDEO
//   This file now owns the one and only hero <video> element. It is created when the intro starts (so it
//   downloads and buffers during the writing), parked invisibly, and held paused. The intro fires
//   "hero:video-start" about 0.4s before it finishes fading, so the video is already ~0.4s in when you see
//   it. WaterRipple adopts this same element (acquireHeroVideo) instead of making a second one, so there is
//   no second download, no second decode and no restart.

const DEADLINE_MS = 4500; // the intro never waits longer than this for tier 1, whatever the connection
const VIDEO_WAIT_MS = 4000; // ...and never longer than this for the video to be playable
const PRELOAD_AUDIO = true; // set false to skip priming the listening-room audio

// needed the moment the intro ends
const CRITICAL = [
  "/map/section-map-bg.svg",
  "/logos/logo.svg",
  "/images/profile.jpg",
  "/images/whoami.jpg",
  "/images/whatido.jpg",
  "/images/howithink.jpg",
  "/images/whatibuild.jpg",
  "/icons/hand.svg",
  "/icons/hand-pointer.svg",
  "/icons/hand-open.svg",
  "/images/aiexp.jpg",
  "/images/devexp.jpg",
  "/images/resexp.jpg",
  "/images/rhetexp.jpg",
  "/images/secexp.jpg",
  "/images/duetdays.jpg",
  "/logos/duetdays-logo.png",
  "/logos/app-placeholder.png",
  "/images/footer.jpg",
];
const VIDEO = "/videos/herovid2.mp4";

// tier 2: Activity Center cards + game art (the same list the Activity data uses)
const SECOND = [
  "/images/play.jpg", "/images/listen.jpg", "/images/ai.jpg",
  "/images/tictac.jpg", "/images/rps.jpg", "/images/wordon.jpg", "/images/quiz.jpg",
  "/logos/logo.png",
  "/icons/hand-rock.svg", "/icons/hand-scissors.svg",
];

const started_ = new Set(); // every image URL we already asked for, so nothing is fetched twice
const audioKeep = []; // primed <audio> elements, kept so the browser doesn't drop what it buffered

function lean() {
  const c = navigator.connection;
  return !!c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""));
}

function loadImage(src, low) {
  if (started_.has(src)) return Promise.resolve();
  started_.add(src);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    if (low) img.fetchPriority = "low";
    img.src = src;
    const done = () => resolve();
    if (img.decode) {
      img.decode().then(done, () => {
        if (img.complete) done();
        else { img.onload = done; img.onerror = done; }
      });
    } else {
      img.onload = done;
      img.onerror = done;
    }
  });
}

async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

/* ---------------- the hero video ---------------- */

let videoEl = null;
let started = null; // the preloadAssets() promise
let introRunning = false; // true once preloadAssets() has run (i.e. the intro is playing)
let videoStarted = false; // true once the intro has said "go"
let retryWired = false;

function parking() {
  let p = document.getElementById("hero-video-parking");
  if (!p) {
    p = document.createElement("div");
    p.id = "hero-video-parking";
    p.setAttribute("aria-hidden", "true");
    Object.assign(p.style, {
      position: "fixed", left: "0", top: "0", width: "2px", height: "2px",
      overflow: "hidden", opacity: "0", pointerEvents: "none", zIndex: "-1",
    });
    document.body.appendChild(p);
  }
  return p;
}

function tryPlay(v) {
  const p = v.play();
  if (p && p.catch) {
    p.catch(() => {
      // iOS Low Power Mode (or a strict autoplay policy) can refuse. Try again on the first touch/key.
      if (retryWired) return;
      retryWired = true;
      const evs = ["pointerdown", "touchstart", "keydown"];
      const retry = () => {
        retryWired = false;
        evs.forEach((e) => window.removeEventListener(e, retry));
        v.play().catch(() => {});
      };
      evs.forEach((e) => window.addEventListener(e, retry, { passive: true }));
    });
  }
}

/** The one hero <video>. Created on first call; WaterRipple moves it into the hero. */
export function acquireHeroVideo(src = VIDEO) {
  if (!videoEl) {
    const v = document.createElement("video");
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("muted", "");
    v.disablePictureInPicture = true;
    v.preload = "auto";
    v.tabIndex = -1;
    v.setAttribute("aria-hidden", "true");
    v.src = src;
    parking().appendChild(v);
    v.load();
    videoEl = v;
    // if the intro never ran (reduced motion), nothing will fire the start signal: just play
    if (!introRunning) tryPlay(v);
  }
  return videoEl;
}

/** True when the hero video is allowed to be playing (intro said go, or there is no intro). */
export function heroVideoMayPlay() {
  return videoStarted || !introRunning;
}

/** The intro calls this (via the "hero:video-start" event) ~0.4s before it finishes fading. */
export function startHeroVideo() {
  videoStarted = true;
  if (videoEl) tryPlay(videoEl);
}
if (typeof window !== "undefined") window.addEventListener("hero:video-start", startHeroVideo);

function waitVideo(v) {
  return new Promise((resolve) => {
    if (v.readyState >= 4) return resolve();
    let t;
    const fin = () => { clearTimeout(t); resolve(); };
    v.addEventListener("canplaythrough", fin, { once: true });
    v.addEventListener("error", fin, { once: true });
    t = setTimeout(fin, VIDEO_WAIT_MS);
  });
}

/* ---------------- data-driven assets (listening room, goodbye song) ---------------- */

async function dataAssets() {
  const images = [];
  const audio = [];
  const [room, bye] = await Promise.allSettled([
    import("./data/listeningRoom.json"),
    import("./data/goodbyeSong.json"),
  ]);
  if (room.status === "fulfilled") {
    for (const t of room.value.default.tracks || []) {
      images.push(t.artwork, t.artistImage);
      audio.push(t.audio);
    }
  }
  if (bye.status === "fulfilled") {
    const b = bye.value.default || {};
    images.push(b.artwork);
    if (typeof b.audio === "string") audio.push(b.audio);
  }
  return { images: images.filter(Boolean), audio: audio.filter(Boolean) };
}

function primeAudio(src) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "auto";
    a.src = src;
    audioKeep.push(a);
    let t;
    const fin = () => { clearTimeout(t); resolve(); };
    a.addEventListener("canplaythrough", fin, { once: true });
    a.addEventListener("error", fin, { once: true });
    t = setTimeout(fin, 20000);
    a.load();
  });
}

/* ---------------- public API (same names App.jsx already uses) ---------------- */

/** Starts (once) and returns a promise that ALWAYS resolves: when tier 1 + video are ready, or at the deadline. */
export function preloadAssets() {
  if (started) return started;
  introRunning = true;
  const v = acquireHeroVideo(); // starts downloading right now
  const work = Promise.all([
    pool(CRITICAL, 3, (s) => loadImage(s, false)),
    lean() ? Promise.resolve() : waitVideo(v),
  ]);
  const cap = new Promise((r) => setTimeout(r, DEADLINE_MS));
  started = Promise.race([work, cap]).catch(() => {});

  // tier 2 carries on in the background as soon as tier 1 is in; it never holds the intro
  const second = async () => {
    const { images } = await dataAssets();
    await pool([...SECOND, ...images], 2, (s) => loadImage(s, true));
  };
  work.then(second, second).catch(() => {});
  return started;
}

/** Kept so App.jsx doesn't change. The hero video is the live one now, so it is never torn down here. */
export function releasePreload() {}

/** Tier 3: when the site is up and the browser is idle - pop-up code first, then the audio. */
export function prefetchIdle() {
  const run = async () => {
    import("./components/sections/ActivityCenter/PlayModal").catch(() => {});
    import("./components/sections/ActivityCenter/ListeningRoom/ListeningRoomModal").catch(() => {});
    import("./components/sections/ActivityCenter/MyAI/MonIAModal").catch(() => {});
    const { images, audio } = await dataAssets();
    await pool([...SECOND, ...images], 2, (s) => loadImage(s, true)); // no-ops for anything tier 2 already asked for
    if (PRELOAD_AUDIO && !lean()) await pool(audio, 1, primeAudio);
  };
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}