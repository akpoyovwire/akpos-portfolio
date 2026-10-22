import React, { useEffect, useRef } from "react";

// The "i" panel: tells the visitor what something is, how it works and what it was built with.
// info = { title, intro, sections: [{ heading, paragraphs?, list? }], action?: { label, onClick } }
// It is drawn inside the screen that opened it (not on document.body), so the custom cursor stays on top.
export default function InfoDialog({ open, info, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === "Escape") {
        // close only this panel, not the screen underneath it
        e.preventDefault();
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll("button, a[href]");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || !info) return null;

  return (
    <div className="activity-info-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panelRef} className="activity-info-panel" role="dialog" aria-modal="true" aria-labelledby="activity-info-title">
        <header className="activity-info-head">
          <h3 id="activity-info-title" className="activity-info-title">{info.title}</h3>
          <button ref={closeRef} type="button" className="activity-info-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="activity-info-body">
          {info.intro && <p className="activity-info-intro">{info.intro}</p>}
          {info.sections?.map((s) => (
            <section key={s.heading} className="activity-info-section">
              <h4>{s.heading}</h4>
              {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
              {s.list && (
                <ul>
                  {s.list.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
          {info.action && (
            <button
              type="button"
              className="activity-info-action"
              onClick={() => {
                onClose();
                info.action.onClick();
              }}
            >
              {info.action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}