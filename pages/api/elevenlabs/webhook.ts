/* /pages/api/elevenlabs/webhook.ts
 *
 * Ontvangt POST-call events van ElevenLabs.
 * ───────────────────────────────────────── */

import { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

// Next .js moet de raw body doorgeven
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ↩︎ alleen POST accepteren
  if (req.method !== "POST") return res.status(405).end("method not allowed");

  // ── 1️⃣  lees raw body ──────────────────────────────────────────
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);

  // ── 2️⃣  HMAC-handtekening controleren  ─────────────────────────
  const sigHeader = req.headers["x-elevenlabs-signature"] as string | undefined;
  if (!sigHeader) return res.status(400).end("no signature");

  const theirSig = sigHeader.replace("SHA256=", "");
  const ourSig  = crypto
      .createHmac("sha256", process.env.ELEVENLABS_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

  if (ourSig !== theirSig) return res.status(401).end("invalid signature");

  // ── 3️⃣  JSON parsen & doen wat je wilt  ────────────────────────
  const event = JSON.parse(rawBody.toString("utf8"));

  /*
    event: {
      callSid:      "CAxxxx",
      conversation: { id: "conv_…" },
      result:       "interested" | "not_interested" | …
      transcript:   "volledige tekst …"
    }
  */

  console.log("🚀  Post-call webhook binnen:", event);

  // → hier kun je:
  //   • resultaatcode naar DB schrijven
  //   • transcript opslaan
  //   • e-mail/Slack sturen
  //   • etc.
  //   Doe dat eventueel als async fire-and-forget zodat webhook
  //   snel kan terugkeren (EL timeout 20 s).

  return res.status(200).json({ ok: true });
}