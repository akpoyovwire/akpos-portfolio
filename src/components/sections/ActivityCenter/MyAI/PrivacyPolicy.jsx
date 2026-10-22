import React from "react";
import RichText from "./RichText";
import { POLICY_SECTIONS, PRIVACY_CONFIG, PRIVACY_VERSION } from "./privacyPolicy";

// The full Privacy Policy and terms for Mon IA. The words live in privacyPolicy.js.
export default function PrivacyPolicy() {
  return (
    <article className="mon-ia-policy">
      <p className="mon-ia-policy-meta">
        Last updated: {PRIVACY_CONFIG.lastUpdated} · Version {PRIVACY_VERSION}
      </p>
      {POLICY_SECTIONS.map((s) => (
        <section key={s.id} className="mon-ia-policy-section" aria-labelledby={`policy-${s.id}`}>
          <h3 id={`policy-${s.id}`} className="mon-ia-policy-heading">
            {s.heading}
          </h3>
          {s.paragraphs.map((p, i) => (
            <RichText key={i} text={p} />
          ))}
          {s.list && (
            <ul>
              {s.list.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {s.after?.map((p, i) => (
            <RichText key={`a${i}`} text={p} />
          ))}
        </section>
      ))}
    </article>
  );
}
