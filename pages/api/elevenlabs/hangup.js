import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* POST  /api/elevenlabs/hangup   { call_sid: "CA…" } */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { call_sid } = req.body;
  if (!call_sid) return res.status(400).json({ error: "call_sid ontbreekt" });

  try {
    await client.calls(call_sid).update({ status: "completed" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}