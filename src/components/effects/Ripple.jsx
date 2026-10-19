import { useEffect } from "react";

export default function Ripple() {
  useEffect(() => {
    const addRipple = (e) => {
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    };
    document.addEventListener("click", addRipple);
    return () => document.removeEventListener("click", addRipple);
  }, []);

  return null;
}
