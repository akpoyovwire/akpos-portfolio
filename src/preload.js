// src/preload.js
// Warms the browser's cache while the intro is writing, so by the time the site appears the images are
// already downloaded AND decoded, and the hero video already has its first seconds buffered.
//
// How it fits the intro (see Intro.jsx / App.jsx):
//   - Intro calls preloadAssets() the moment the pen starts. Network work does not touch the main
//     thread, and images are decoded with img.decode() (off the main thread), 3 at a time, so the
//     writing stays smooth.
//   - If everything is ready when the line finishes (it normally is), nothing changes. If not, the intro
//     simply holds on the finished signature until it is (hard cap: DEADLINE_MS), THEN fades out.
//     So the visitor never sees pictures popping in after the intro.
//   - After the site is up, prefetchIdle() quietly fetches the rest (games, listening room art).

const DEADLINE_MS = 7000; // never keep the visitor waiting longer than this, whatever the connection

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

// fetched later, while the visitor looks around
const IDLE = [
  "/images/ai.jpg", "/images/listen.jpg", "/images/play.jpg", "/images/quiz.jpg",
  "/images/rps.jpg", "/images/tictac.jpg", "/images/wordon.jpg",
  "/icons/hand-rock.svg", "/icons/hand-scissors.svg", "/icons/hand-open.svg",
];

let videoEl = null;
let started = null;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
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

function loadVideo(src) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = src;
    videoEl = v; // keep a reference so the buffered data is not thrown away before the hero mounts
    v.addEventListener("canplaythrough", () => resolve(), { once: true });
    v.addEventListener("error", () => resolve(), { once: true });
    v.load();
  });
}

/** Starts (once) and returns a promise that ALWAYS resolves: when everything is ready, or at the deadline. */
export function preloadAssets() {
  if (started) return started;
  const work = Promise.all([pool(CRITICAL, 3, loadImage), loadVideo(VIDEO)]);
  const cap = new Promise((r) => setTimeout(r, DEADLINE_MS));
  started = Promise.race([work, cap]).catch(() => {});
  return started;
}

/** Let go of the preload video once the real hero video has taken over. */
export function releasePreload() {
  if (!videoEl) return;
  videoEl.removeAttribute("src");
  videoEl.load();
  videoEl = null;
}

/** Quietly fetch everything else when the browser has nothing better to do. */
export function prefetchIdle() {
  const run = async () => {
    let extra = [];
    try {
      const [{ default: room }, { default: bye }] = await Promise.all([
        import("./data/listeningRoom.json"),
        import("./data/goodbyeSong.json"),
      ]);
      extra = [
        ...room.tracks.flatMap((t) => [t.artwork, t.artistImage]),
        bye.artwork,
      ].filter(Boolean);
    } catch { /* data files optional */ }
    await pool([...IDLE, ...extra], 2, loadImage);
    // the pop-up code (split out of the main bundle) - fetched now so opening one is instant
    import("./components/sections/ActivityCenter/PlayModal").catch(() => {});
    import("./components/sections/ActivityCenter/ListeningRoom/ListeningRoomModal").catch(() => {});
    import("./components/sections/ActivityCenter/MyAI/MonIAModal").catch(() => {});
  };
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}