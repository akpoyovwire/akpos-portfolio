import React from "react";
// react-icons/si is already used by Works.jsx, so this adds no new weight.
import { SiJavascript, SiReact, SiNodedotjs, SiPython, SiSupabase, SiVercel, SiGooglegemini } from "react-icons/si";
// lucide-react is already a dependency of the site (used for the plain "DB" and "API" badges)
import { Database, Plug } from "lucide-react";

// id -> real logo. They are all drawn in clean white (see .activity-tool in the CSS).
const TOOLS = {
  javascript: { label: "JavaScript", Icon: SiJavascript, round: true }, // square logo, cropped to a circle inside the grey badge
  react: { label: "React", Icon: SiReact },
  nodejs: { label: "Node.js", Icon: SiNodedotjs },
  python: { label: "Python", Icon: SiPython },
  supabase: { label: "Supabase", Icon: SiSupabase },
  vercel: { label: "Vercel", Icon: SiVercel },
  db: { label: "Open Trivia DB (question database)", Icon: Database, iconProps: { size: "1em" } },
  api: { label: "API (live data)", Icon: Plug, iconProps: { size: "1em" } },
    gemini: { label: "Gemini (AI quiz)", Icon: SiGooglegemini },
};

// Small row of tool logos (top-left of a card). Pass ids from the TOOLS list above.
export default function ToolBadges({ tools = [] }) {
  if (!tools.length) return <span />; // keeps the card's logo pinned to the right
  return (
    <span className="activity-tools" role="list" aria-label="Built with">
      {tools.map((id) => {
        const tool = TOOLS[id];
        if (!tool) return null;
        const { Icon } = tool;
        return (
          <span key={id} role="listitem" className="activity-tool" title={tool.label}>
            {tool.round ? (
              <span className="activity-tool-round">
                <Icon aria-label={tool.label} />
              </span>
            ) : (
              <Icon aria-label={tool.label} {...tool.iconProps} />
            )}
          </span>
        );
      })}
    </span>
  );
}
