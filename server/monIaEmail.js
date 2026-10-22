// Sends one email through Resend's HTTP API (no extra package needed).
export class EmailError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "EmailError";
    this.status = status;
  }
}

export async function sendEmail({ apiKey, from, to, subject, text, html }, fetchImpl = fetch, timeoutMs = 15000) {
  if (!apiKey || !from || !to || !subject) throw new EmailError(0, "Missing email settings");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, text, html }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json())?.message || ""; } catch { /* no body */ }
      throw new EmailError(res.status, `Resend refused the email (HTTP ${res.status}) ${detail}`.trim());
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data.id || null };
  } finally {
    clearTimeout(timer);
  }
}
