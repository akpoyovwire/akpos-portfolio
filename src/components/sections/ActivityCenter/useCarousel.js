import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

// Same feel as the Works carousel: arrows, trackpad glide, blue-to-orange scrubber.
const WHEEL_SPEED = 5;
const WHEEL_GLIDE = 0.12;

export default function useCarousel() {
  const trackRef = useRef(null);
  const sliderRef = useRef(null);
  const knobRef = useRef(null);
  const dragging = useRef(false);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [overflowing, setOverflowing] = useState(false);

  const sync = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflowing(max > 4);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
    const p = max > 0 ? el.scrollLeft / max : 0;
    if (knobRef.current) knobRef.current.style.left = `calc(${p * 100}% - 8px)`;
  };

  // keep arrows / knob in step with the scroll position (batched per frame)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          sync();
        });
      }
    };
    sync();
    const el = trackRef.current;
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // two-finger trackpad swipe (and shift+wheel): glide toward a target
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let target = el.scrollLeft;
    let pos = el.scrollLeft;
    let running = false;

    const tick = () => {
      pos += (target - pos) * WHEEL_GLIDE;
      if (Math.abs(target - pos) < 0.5) {
        pos = target;
        running = false;
        gsap.ticker.remove(tick);
      }
      el.scrollLeft = pos;
    };

    const onWheel = (e) => {
      const horizontalIntent = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!horizontalIntent) return;
      e.preventDefault();
      e.stopPropagation();
      if (!running) target = pos = el.scrollLeft;
      const raw = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1;
      const max = el.scrollWidth - el.clientWidth;
      target = Math.min(max, Math.max(0, target + raw * unit * WHEEL_SPEED));
      if (!running) {
        running = true;
        gsap.ticker.add(tick);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      gsap.ticker.remove(tick);
    };
  }, []);

  const setFromClientX = (clientX) => {
    const rect = sliderRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const el = trackRef.current;
    el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
  };

  // dragging the scrubber knob scrubs the carousel
  useEffect(() => {
    const onMove = (e) => dragging.current && setFromClientX(e.clientX);
    const onUp = () => (dragging.current = false);
    const onTouchMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      setFromClientX(e.touches[0].clientX);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const scrollByPage = (dir) => {
    const el = trackRef.current;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const onSliderMouseDown = (e) => {
    dragging.current = true;
    setFromClientX(e.clientX);
  };
  const onSliderTouchStart = (e) => {
    dragging.current = true;
    setFromClientX(e.touches[0].clientX);
  };

  return { trackRef, sliderRef, knobRef, atStart, atEnd, overflowing, scrollByPage, onSliderMouseDown, onSliderTouchStart };
}
