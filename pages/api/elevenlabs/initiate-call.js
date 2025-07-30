/* /pages/api/elevenlabs/initiate-call.js */

export default async function handler(req, res) {
  /* ───────── CORS ───────── */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  /* ───────── payload ───────── */
  const { klant_naam = "Prospect", klant_telefoon } = req.body;
  if (!klant_telefoon)
    return res.status(400).json({ error: "klant_telefoon ontbreekt" });

  /* ───────── ElevenLabs outbound call ───────── */
  try {
    const elResp = await fetch(
      "https://api.elevenlabs.io/v1/telephony/call/outbound",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ELEVENLABS_API_KEY}`,
        },
        body: JSON.stringify({
          phone_number_id: process.env.ELEVENLABS_PHONE_NUM_ID,
          agent_id: process.env.ELEVENLABS_AGENT_ID,
          customer: {
            number: klant_telefoon,
            name: klant_naam,
          },
        }),
      }
    );

    if (!elResp.ok) {
      const text = await elResp.text();
      throw new Error(
        `ElevenLabs ${elResp.status}: ${text.substring(0, 200)}`
      );
    }

    const data = await elResp.json(); // bevat call_sid e.d.
    return res.status(200).json({ message: "Gesprek gestart", data });
  } catch (err) {
    console.error("Outbound-call error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
