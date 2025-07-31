import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Start een outbound-call via ElevenLabs + Twilio.
 * Retourneert { sid } zodat de frontend later kan ophangen.
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

  // Body-velden
  const { klant_naam = "Prospect", klant_telefoon } = req.body as {
    klant_naam?: string;
    klant_telefoon?: string;
  };
  if (!klant_telefoon)
    return res.status(400).json({ error: "klant_telefoon ontbreekt" });

  const {
    ELEVENLABS_API_KEY,
    ELEVENLABS_PHONE_NUM_ID,
    ELEVENLABS_AGENT_ID,
  } = process.env;

  try {
    // Call naar ElevenLabs
    const elRes = await fetch(
      "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          agent_phone_number_id: ELEVENLABS_PHONE_NUM_ID!,
          agent_id: ELEVENLABS_AGENT_ID!,
          to_number: klant_telefoon,
          customer_name: klant_naam,
        }),
      }
    );

    if (!elRes.ok) {
      const text = await elRes.text();
      return res
        .status(elRes.status)
        .json({ error: `ElevenLabs ${elRes.status}: ${text}` });
    }

    //  Response bevat callSid
    const data: { callSid?: string; sid?: string } = await elRes.json();
    return res.status(200).json({ sid: data.callSid ?? data.sid });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}