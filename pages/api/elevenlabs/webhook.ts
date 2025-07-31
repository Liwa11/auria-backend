// pages/api/elevenlabs/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createHmac, timingSafeEqual } from "crypto";
import getRaw from "raw-body";

export const config = { api: { bodyParser: false } }; // <- we lezen zelf de raw body

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ───────── allow CORS/OPTIONS ─────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).end("Method not allowed");

  /* ---------- signature controle ---------- */
  const sigHeader = (req.headers["elevenlabs-signature"] ?? "") as string;   // ✔ juiste header
  const [tsPart, v0Part] = sigHeader.split(",");
  const timestamp = tsPart?.replace(/^t=/, "");
  const sig        = v0Part?.replace(/^v0=/, "");

  if (!timestamp || !sig) return res.status(400).end("Bad signature format");

  const rawBody = await getRaw(req);
  const payloadToSign = `${timestamp}.${rawBody.toString()}`;

  const calcHmac = createHmac("sha256", process.env.ELEVENLABS_WEBHOOK_SECRET!)
                    .update(payloadToSign)
                    .digest("hex");

  if (
    calcHmac.length !== sig.length ||
    !timingSafeEqual(Buffer.from(calcHmac, "hex"), Buffer.from(sig, "hex"))
  ) {
    console.log("signature mismatch");               // ← tijdelijk loggen
    return res.status(401).end("invalid signature");
  }

  /* ---------- payload verwerken ---------- */
  const payload = JSON.parse(rawBody.toString());

  if (payload.event_type !== "conversation_completed") {
    return res.status(200).json({ ignored: payload.event_type });
  }

  // hier zit o.a. payload.transcript_text, payload.call_sid, payload.result_code …
  // → schrijf naar Supabase of wat je maar wilt

  return res.status(200).json({ ok: true });
}