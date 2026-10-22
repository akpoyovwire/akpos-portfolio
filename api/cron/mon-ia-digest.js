// Runs once a week (see vercel.json). Emails every recorded Mon IA chat that has not been emailed yet,
// then deletes chats that were emailed long enough ago (the retention time in the privacy policy).
import { timingSafeEqual } from "node:crypto";
import { fetchUnsent, markEmailed, purgeEmailed } from "../../server/monIaStore.js";
import { groupConversations, digestSubject, formatDigestText, formatDigestHtml } from "../../server/monIaDigest.js";
import { sendEmail } from "../../server/monIaEmail.js";
import { PRIVACY_CONFIG } from "../../src/components/sections/ActivityCenter/MyAI/privacyPolicy.js";

const BATCH_SIZE = 400;
const MAX_BATCHES = 5; // at most 5 emails per run

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      console.error("Mon IA digest: CRON_SECRET is not set");
      return res.status(500).json({ error: "Not set up." });
    }
    // Vercel sends  Authorization: Bearer <CRON_SECRET>  automatically when that variable exists
    if (!safeEqual(String(req.headers.authorization || ""), `Bearer ${secret}`)) return res.status(401).json({ error: "Unauthorized." });

    const { SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, DIGEST_TO_EMAIL } = process.env;
    const from = process.env.DIGEST_FROM || "Mon IA <onboarding@resend.dev>";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RESEND_API_KEY || !DIGEST_TO_EMAIL) {
      console.error("Mon IA digest: a required setting is missing");
      return res.status(500).json({ error: "Not set up." });
    }
    const cfg = { url: SUPABASE_URL, key: SUPABASE_SERVICE_KEY };

    let emails = 0;
    let messages = 0;
    try {
      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const rows = await fetchUnsent(cfg, BATCH_SIZE);
        const groups = groupConversations(rows);
        if (!rows.length && batch > 0) break;
        await sendEmail({
          apiKey: RESEND_API_KEY, from, to: DIGEST_TO_EMAIL,
          subject: digestSubject(groups, rows.length), text: formatDigestText(groups, rows.length), html: formatDigestHtml(groups, rows.length),
        });
        emails += 1;
        if (!rows.length) break; // the "nothing new this week" email
        await markEmailed(cfg, rows.map((r) => r.id), new Date().toISOString()); // only after the email really went out
        messages += rows.length;
        if (rows.length < BATCH_SIZE) break;
      }
    } catch (err) {
      console.error("Mon IA digest failed:", err.message);
      return res.status(502).json({ error: "The digest could not be sent.", emails, messages });
    }

    let deletedBefore = null;
    try {
      deletedBefore = await purgeEmailed(cfg, PRIVACY_CONFIG.databaseRetentionDays);
    } catch (err) {
      console.error("Mon IA digest: clean-up failed:", err.message);
    }
    return res.status(200).json({ ok: true, emails, messages, deletedBefore });
  } catch (err) {
    console.error("Mon IA digest crashed:", err?.message);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
