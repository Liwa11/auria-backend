import type { NextApiRequest, NextApiResponse } from "next";
import twilio from "twilio";

/**
 * Zet een lopende call (Twilio sid) op status "completed".
 * Wordt aangeroepen door de Beëindig-knop in de frontend.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { sid } = req.body as { sid?: string };
  if (!sid) return res.status(400).json({ error: "sid missing" });

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  try {
    await client.calls(sid).update({ status: "completed" });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}