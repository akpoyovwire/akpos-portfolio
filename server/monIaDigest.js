// Turns recorded messages into the weekly email. Pure functions: easy to test.
export const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const TZ = "Africa/Lagos"; // Port Harcourt time (WAT)
export const formatWhen = (iso) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const KIND_LABEL = { answer: "", age: " [age rule]", refuse: " [refused]", private: " [private-question rule]" };

// group rows into conversations (oldest first), keeping each conversation's messages in order
export function groupConversations(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.conversation_id)) map.set(r.conversation_id, { id: r.conversation_id, messages: [] });
    map.get(r.conversation_id).messages.push({ at: r.created_at, question: r.question, answer: r.answer, kind: r.kind || "answer" });
  }
  const groups = [...map.values()];
  for (const g of groups) g.messages.sort((a, b) => new Date(a.at) - new Date(b.at));
  return groups.sort((a, b) => new Date(a.messages[0].at) - new Date(b.messages[0].at));
}

export function digestSubject(groups, messageCount) {
  if (!messageCount) return "Mon IA weekly digest: no new conversations";
  return `Mon IA weekly digest: ${groups.length} conversation${groups.length === 1 ? "" : "s"}, ${messageCount} message${messageCount === 1 ? "" : "s"}`;
}

export function formatDigestText(groups, messageCount) {
  if (!messageCount) return "No new Mon IA conversations since the last digest.";
  const lines = [`Mon IA conversations since the last digest: ${groups.length} conversation(s), ${messageCount} message(s). Times are Port Harcourt time.`, ""];
  groups.forEach((g, i) => {
    lines.push(`--- Conversation ${i + 1} (${g.id.slice(0, 8)}) ---`);
    for (const m of g.messages) {
      lines.push(`[${formatWhen(m.at)}]${KIND_LABEL[m.kind] ?? ""}`, `Visitor: ${m.question}`, `Mon IA: ${m.answer}`, "");
    }
  });
  lines.push("This digest contains visitors' messages. Delete it when you no longer need it (the privacy policy says emailed copies are kept for up to 12 months).");
  return lines.join("\n");
}

export function formatDigestHtml(groups, messageCount) {
  if (!messageCount) return "<p>No new Mon IA conversations since the last digest.</p>";
  const parts = [`<p>Mon IA conversations since the last digest: <b>${groups.length}</b> conversation(s), <b>${messageCount}</b> message(s). Times are Port Harcourt time.</p>`];
  groups.forEach((g, i) => {
    parts.push(`<h3 style="margin:24px 0 8px">Conversation ${i + 1} <small style="color:#777">(${escapeHtml(g.id.slice(0, 8))})</small></h3>`);
    for (const m of g.messages) {
      parts.push(
        `<div style="margin:0 0 14px;padding:10px 12px;border-left:3px solid #e4572e;background:#f6f6f7">` +
          `<div style="color:#777;font-size:12px">${escapeHtml(formatWhen(m.at))}${escapeHtml(KIND_LABEL[m.kind] ?? "")}</div>` +
          `<div><b>Visitor:</b> ${escapeHtml(m.question).replace(/\n/g, "<br>")}</div>` +
          `<div style="margin-top:6px"><b>Mon IA:</b> ${escapeHtml(m.answer).replace(/\n/g, "<br>")}</div></div>`
      );
    }
  });
  parts.push(`<p style="color:#777;font-size:12px">This digest contains visitors' messages. Delete it when you no longer need it.</p>`);
  return parts.join("\n");
}
