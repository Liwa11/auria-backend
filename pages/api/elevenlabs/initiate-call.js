// pages/api/elevenlabs/initiate-call.js
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export default async function handler(req, res) {
  // CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  res.setHeader("Access-Control-Allow-Origin", "*");

  const { klant_naam, klant_telefoon } = req.body;
  if (!klant_naam || !klant_telefoon)
    return res.status(400).json({ message: "Missing data" });

  try {
    // TwiML met ConversationRelay → ElevenLabs WSS
    const twiml = `
      <Response>
        <Connect>
          <ConversationRelay
            url="${process.env.ELEVENLABS_WSS}"
            welcomeGreeting="Hallo ${klant_naam}, ik ben de AI-assistent."
          />
        </Connect>
      </Response>`;

    const call = await twilioClient.calls.create({
      to: klant_telefoon,                 // klant
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml
    });

    // (optioneel) operator stil laten meeluisteren
    await twilioClient.calls.create({
      to: process.env.OPERATOR_NUMBER,    // jij
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: `<Response><Dial><Conference muted="true">${call.sid}</Conference></Dial></Response>`
    });

    return res.status(200).json({ message: "Gesprek gestart", sid: call.sid });
  } catch (err) {
    console.error("Twilio/ElevenLabs error", err?.message || err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}