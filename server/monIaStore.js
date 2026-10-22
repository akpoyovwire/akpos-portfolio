// Saves and reads Mon IA's recorded conversations in Supabase, using the server-side SECRET key.
// That key can read and write everything, so it only ever lives in server environment variables.
// fetchImpl is injectable so this can be tested without the internet.
const TABLE = "mon_ia_messages";

function headers(key, extra = {}) {
  // the older service_role key is a JWT (starts with eyJ) and goes in both headers; the newer
  // sb_secret_ key goes in apikey only
  return { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json", ...extra };
}
const endpoint = (cfg, query = "") => `${cfg.url.replace(/\/+$/, "")}/rest/v1/${TABLE}${query}`;

async function request(cfg, url, init, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// one recorded exchange. Never stores IP address or device details.
export async function insertMessage(cfg, row, fetchImpl = fetch, timeoutMs = 3000) {
  const body = {
    conversation_id: row.conversationId,
    question: row.question,
    answer: row.answer,
    kind: row.kind,
    policy_version: row.policyVersion,
  };
  const res = await request(cfg, endpoint(cfg), { method: "POST", headers: headers(cfg.key, { Prefer: "return=minimal" }), body: JSON.stringify(body) }, fetchImpl, timeoutMs);
  if (!res.ok) throw new Error(`Supabase insert failed: HTTP ${res.status}`);
  return true;
}

// oldest messages that have not been emailed yet
export async function fetchUnsent(cfg, limit = 400, fetchImpl = fetch, timeoutMs = 10000) {
  const query = `?emailed_at=is.null&order=created_at.asc,id.asc&limit=${limit}&select=id,conversation_id,created_at,question,answer,kind`;
  const res = await request(cfg, endpoint(cfg, query), { method: "GET", headers: headers(cfg.key) }, fetchImpl, timeoutMs);
  if (!res.ok) throw new Error(`Supabase read failed: HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Supabase read returned something unexpected");
  return rows;
}

export async function markEmailed(cfg, ids, whenIso, fetchImpl = fetch, timeoutMs = 10000) {
  if (!ids.length) return 0;
  if (!ids.every((id) => Number.isInteger(id))) throw new Error("ids must be whole numbers");
  const res = await request(cfg, endpoint(cfg, `?id=in.(${ids.join(",")})`),
    { method: "PATCH", headers: headers(cfg.key, { Prefer: "return=minimal" }), body: JSON.stringify({ emailed_at: whenIso }) }, fetchImpl, timeoutMs);
  if (!res.ok) throw new Error(`Supabase update failed: HTTP ${res.status}`);
  return ids.length;
}

// delete chats that were emailed more than `days` days ago (never deletes anything not yet emailed)
export async function purgeEmailed(cfg, days, now = new Date(), fetchImpl = fetch, timeoutMs = 10000) {
  const cutoff = new Date(now.getTime() - days * 86400000).toISOString();
  const query = `?emailed_at=not.is.null&emailed_at=lt.${encodeURIComponent(cutoff)}`;
  const res = await request(cfg, endpoint(cfg, query), { method: "DELETE", headers: headers(cfg.key, { Prefer: "return=minimal" }) }, fetchImpl, timeoutMs);
  if (!res.ok) throw new Error(`Supabase delete failed: HTTP ${res.status}`);
  return cutoff;
}
