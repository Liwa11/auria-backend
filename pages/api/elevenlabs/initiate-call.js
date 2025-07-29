/* /pages/api/elevenlabs/initiate-call.js */
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export default async function handler(req, res) {
  /* ---------- CORS ---------- */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  /* OPTIONS = pre-flight → direct OK */
  if (req.method === "OPTIONS") return res.status(200).end();

  /* alleen POST toelaten */
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  /* ---------- payload ---------- */
  const { klant_naam, klant_telefoon } = req.body;
  if (!klant_naam || !klant_telefoon) {
    return res.status(400).json({ message: "Missing klant data" });
  }

  /* ---------- TwiML ---------- */
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const vr = new VoiceResponse();

  /* live stream naar ElevenLabs AI */
  vr.start().stream({
    url: process.env.ELEVENLABS_WSS,
    track: "both"          // verplicht
  });

  /* korte aankondiging zodat er meteen geluid is */
  vr.say(
    { voice: "Polly.Rachel" },
    `Hallo ${klant_naam}, één moment terwijl ik verbinding maak.`
  );

  try {
    /* klant bellen */
    const call = await twilioClient.calls.create({
      to: klant_telefoon,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: vr.toString(),
    });

    /* optioneel: operator stil meeluisteren */
    await twilioClient.calls.create({
      to: process.env.OPERATOR_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: `<Response><Dial><Conference muted="true">${call.sid}</Conference></Dial></Response>`,
    });

    return res.status(200).json({ message: "Gesprek gestart", sid: call.sid });
  } catch (err) {
    console.error("Twilio/ElevenLabs error", err?.code, err?.message);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
}