/*  /pages/api/elevenlabs/initiate-call.js  */

/* 1) 100 % CORS-afhandeling (v0 dashboard) */
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  /* 2) Payload check */
  const { klant_naam = "Prospect", klant_telefoon } = req.body;
  if (!klant_telefoon)
    return res.status(400).json({ error: "klant_telefoon ontbreekt" });

  /* 3) Verplichte env-variabelen  */
  const {
    ELEVENLABS_API_KEY,
    ELEVENLABS_PHONE_NUM_ID,
    ELEVENLABS_AGENT_ID,
  } = process.env;

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_PHONE_NUM_ID || !ELEVENLABS_AGENT_ID)
    return res
      .status(500)
      .json({ error: "Mis API-key, phone_number_id of agent_id in env" });

  /* 4) Outbound-call rechtstreeks via ElevenLabs */
  try {
    const elRes = await fetch(
      "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          /**  let op → ElevenLabs verwacht **xi-api-key**  */
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          phone_number_id: ELEVENLABS_PHONE_NUM_ID,
          agent_id: ELEVENLABS_AGENT_ID,
          customer: {
            number: klant_telefoon,
            name: klant_naam,
          },
        }),
      }
    );

    if (!elRes.ok) {
      const text = await elRes.text();
      return res
        .status(elRes.status)
        .json({ error: `ElevenLabs ${elRes.status}: ${text}` });
    }

    const data = await elRes.json(); // bevat call_sid, etc.
    return res.status(200).json({ message: "Gesprek gestart", data });
  } catch (e) {
    console.error("ElevenLabs outbound-error →", e);
    return res.status(500).json({ error: e.message });
  }
}
