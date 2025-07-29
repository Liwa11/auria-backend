import twilio from "twilio";
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export default async function handler(req, res) {
  // CORS + method-check ong unchanged …

  const { klant_naam, klant_telefoon } = req.body;

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // ① stream live audio naar ElevenLabs
  twiml
    .start()
    .stream({ url: process.env.ELEVENLABS_WSS });

  // ② optionele eerste zin (vertragings-fallback)
  twiml.say(
    { voice: "Polly.Rachel" },
    `Hallo ${klant_naam}, één moment terwijl ik verbinding maak.`
  );

  try {
    const call = await client.calls.create({
      to: klant_telefoon,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: twiml.toString(),
    });

    return res.status(200).json({ message: "Gesprek gestart", sid: call.sid });
  } catch (err) {
    console.error("Twilio error", err?.code, err?.message);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}