import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Github, Linkedin, ChevronDown } from "lucide-react";
import { FaMedium } from "react-icons/fa";
import MonIAChat from "../sections/ActivityCenter/MyAI/MonIAChat";
import MonIAModal from "../sections/ActivityCenter/MyAI/MonIAModal";
import { ACTIVITY_LOGO, AI_NAME } from "../sections/ActivityCenter/activityData";
import GoodbyePlayer from "./GoodbyePlayer";
import goodbye from "../../data/goodbyeSong.json";
import "../../styles/footer.css";

const MOBILE_QUERY = "(max-width: 899px)"; // same breakpoint the rest of the site uses

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

// The clock lives in its own component, so ticking every second re-renders only this number,
// not the whole footer (which holds the chat and the song player).
function Clock() {
  const fmt = () => new Date().toLocaleTimeString("en-GB", { hour12: false });
  const [t, setT] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="footer-clock text-center text-4xl bebas-neue-regular mb-6">{t}</div>;
}

// Keeps the bottom of the page in view while the phone cards unfold. It lets go the moment a finger
// touches the screen: scrolling the page from code while a finger / momentum is moving it is what
// made the footer "bounce back down".
function pinToBottom(isTouching) {
  const t0 = performance.now();
  const step = () => {
    if (isTouching()) return;
    window.scrollTo(0, document.documentElement.scrollHeight);
    if (performance.now() - t0 < 850) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const atPageBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 24;

export default function Footer() {
  const footerRef = useRef(null);
  const isMobile = useMedia(MOBILE_QUERY);
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false); // the chat only mounts after the first raise, so it never grabs focus on page load
  const [modalOpen, setModalOpen] = useState(false);

  const openRef = useRef(false);
  const mobileRef = useRef(isMobile);
  const lockUntil = useRef(0);
  const touchingRef = useRef(false);
  const pendingPinRef = useRef(false);
  mobileRef.current = isMobile;

  const change = useCallback((next, { force = false } = {}) => {
    const now = performance.now();
    if (!force && now < lockUntil.current) return;
    if (openRef.current === next) return;
    lockUntil.current = now + 450; // one gesture = one change (trackpad inertia keeps firing)
    openRef.current = next;
    setOpen(next);
    if (next) {
      setEverOpened(true);
      if (mobileRef.current) {
        if (touchingRef.current) pendingPinRef.current = true; // finger still down: pin once it lifts
        else pinToBottom(() => touchingRef.current);
      }
    } else if (!mobileRef.current) {
      // stop the same scroll-up from also dragging the page up
      window.dispatchEvent(new Event("lenis:stop"));
      setTimeout(() => window.dispatchEvent(new Event("lenis:start")), 1000);
    }
  }, []);

  useEffect(() => {
    let touchY = null;
    let acc = 0; // small trackpad nudges add up instead of being thrown away
    let lastWheelT = 0;

    const onWheel = (e) => {
      // wheel over the chat's message list scrolls the list, but only while it can still move that way
      const log = e.target.closest?.(".mon-ia-log");
      if (log) {
        const canUp = log.scrollTop > 0;
        const canDown = log.scrollTop + log.clientHeight < log.scrollHeight - 1;
        if ((e.deltaY < 0 && canUp) || (e.deltaY > 0 && canDown)) return;
      }
      const nowT = performance.now();
      if (nowT - lastWheelT > 220 || Math.sign(e.deltaY) !== Math.sign(acc)) acc = 0;
      lastWheelT = nowT;
      acc += e.deltaY;
      if (!openRef.current && acc > 12 && atPageBottom()) { acc = 0; change(true); }
      else if (openRef.current && acc < -12 && !mobileRef.current) { acc = 0; change(false); }
    };
    const onTouchStart = (e) => { touchingRef.current = true; touchY = e.touches[0].clientY; };
    const onTouchEnd = () => {
      touchingRef.current = false;
      touchY = null;
      if (pendingPinRef.current) {
        pendingPinRef.current = false;
        setTimeout(() => pinToBottom(() => touchingRef.current), 60);
      }
    };
    const onTouchMove = (e) => {
      if (touchY == null || openRef.current) return;
      if (touchY - e.touches[0].clientY > 30 && atPageBottom()) { touchY = null; change(true); }
    };
    const onKey = (e) => {
      if (e.key === "Escape" && openRef.current && !mobileRef.current) return change(false);
      const t = e.target;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName) || t.isContentEditable) return;
      if (["ArrowDown", "PageDown", "End", " "].includes(e.key) && !openRef.current && atPageBottom()) change(true);
    };
    // phone: scrolling back up past the footer folds the cards away again
    const onScroll = () => {
      if (!openRef.current || !mobileRef.current || !footerRef.current) return;
      if (footerRef.current.getBoundingClientRect().top > window.innerHeight * 0.7) change(false, { force: true });
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [change]);

  const contacts = [
    { icon: <Mail size={20} color="#D14836" />, href: "mailto:ogbonakposfficial@gmail.com", slideFrom: "top" },
    { icon: <Github size={20} color="#FFFFFF" />, href: "https://github.com/akpoyovwire", slideFrom: "bottom" },
    { icon: <Linkedin size={20} color="#0A66C2" />, href: "https://www.linkedin.com/in/akpoyovwire/", slideFrom: "top" },
    { icon: <FaMedium size={22} color="#000000" />, href: "https://medium.com/@dahgrate", slideFrom: "bottom" },
  ];

  return (
    <>
      <footer id="footer" ref={footerRef} className={`footer${open ? " is-open" : ""}`}>
        <div className="footer-stage">
          <img src="/images/footer.jpg" alt="" className="footer-bg-img" />

          <div aria-hidden="true" className="footer-wordmark bebas-neue-regular" style={{ fontSize: "clamp(3rem, 16vw, 13rem)" }}>
            AKPOYOVWIRE
          </div>

          <div className="footer-panel">
            {/* the dark glass template that rises (desktop only) */}
            <div className="footer-panel-bg" aria-hidden="true" />

            {/* LEFT: Let's talk (desktop) */}
            {!isMobile && (
              <aside className="footer-side footer-side--chat" data-lenis-prevent aria-label={AI_NAME}>
                {everOpened && <MonIAChat suggestions={false} onOpenPrivacy={() => setModalOpen(true)} />}
              </aside>
            )}

            {/* CENTER: clock, nav, icons, copyright */}
            <div className="footer-center text-[#EDEDF2]">
              <Clock />

              <div className="footer-nav flex flex-col items-center mb-8">
                {["About", "Expertise", "Works", "Activity"].map((tab, idx) => (
                  <React.Fragment key={tab}>
                    <a href={`#${tab.toLowerCase()}`} className="py-2 px-4 hover:text-[#E4572E] transition">
                      {tab}
                    </a>
                    {idx < 3 && <div className="footer-nav-sep w-32 border-t border-[#EDEDF2] mx-auto"></div>}
                  </React.Fragment>
                ))}
              </div>

              <motion.div
                className="footer-icons flex gap-6 mb-8"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                variants={{ visible: { transition: { staggerChildren: 0.2 } } }}
              >
                {contacts.map((link, idx) => (
                  <motion.a
                    key={idx}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#E4572E]"
                    initial={{ opacity: 0, y: link.slideFrom === "top" ? -50 : 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    viewport={{ once: false, amount: 0.4 }}
                    whileHover={{ scale: 1.1 }}
                  >
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}>
                      {link.icon}
                    </motion.div>
                  </motion.a>
                ))}
              </motion.div>

              <div className="text-center text-sm">&copy; {new Date().getFullYear()} AkposWorld. All rights reserved.</div>
            </div>

            {/* RIGHT: goodbye song (desktop) */}
            {!isMobile && (
              <aside className="footer-side footer-side--song" aria-label="Goodbye song">
                <GoodbyePlayer song={goodbye} active={open} />
                <h3 className="footer-song-heading">Sad to see you go</h3>
              </aside>
            )}
          </div>

          {/* PHONE: the Mon IA link and the song unfold INSIDE the image (the image grows with them) */}
          {isMobile && (
            <div className="footer-stack">
              <div className="footer-stack-inner">
                <div className="footer-stack-cards">
                  <button type="button" className="footer-talk" onClick={() => setModalOpen(true)}>
                    <img src={ACTIVITY_LOGO} alt="" aria-hidden="true" className="footer-talk-logo" />
                    <span className="footer-talk-text">
                      <span className="footer-talk-title">{AI_NAME}</span>
                      <span className="footer-talk-sub">Ask me anything about Akpos</span>
                    </span>
                    <ChevronDown size={20} className="footer-talk-arrow" aria-hidden="true" />
                  </button>
                  <GoodbyePlayer song={goodbye} active={open} />
                  <h3 className="footer-song-heading">Sad to see you go</h3>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            className="footer-hint"
            onClick={() => change(true)}
            aria-label="Open the footer panel"
            tabIndex={open ? -1 : 0}
          >
            <ChevronDown size={30} strokeWidth={2.5} />
          </button>
        </div>

      </footer>

      {modalOpen && <MonIAModal activity={{ name: AI_NAME }} onClose={() => setModalOpen(false)} />}
    </>
  );
}