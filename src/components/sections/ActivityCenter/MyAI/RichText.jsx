import React from "react";
import { linkify, toParagraphs } from "./monIaClient";

// Plain text with clickable links. Built from React elements (never raw HTML), so text can't inject anything.
export default function RichText({ text }) {
  return toParagraphs(text).map((paragraph, i) => (
    <p key={i}>
      {linkify(paragraph).map((t, j) =>
        t.type === "link" ? (
          <a key={j} href={t.href} target="_blank" rel="noopener noreferrer">
            {t.text}
          </a>
        ) : (
          <React.Fragment key={j}>{t.text}</React.Fragment>
        )
      )}
    </p>
  ));
}
